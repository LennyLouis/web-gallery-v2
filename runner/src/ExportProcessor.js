const archiver = require('archiver');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand: GetObjectForUrl } = require('@aws-sdk/client-s3');
const { supabase, s3Client, s3PublicClient, bucket } = require('./database');
const config = require('./config');

/**
 * Main export processing service
 * Handles the creation of ZIP files from photo collections
 */
class ExportProcessor {
  constructor() {
    this.activeJobs = new Set();
  }

  /**
   * Process the next batch of queued exports
   */
  async processNextBatch() {
    try {
      // Fetch pending exports from database
      const pendingExports = await this.supabase
        .from('album_exports')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(this.config.maxConcurrentJobs);

      if (!pendingExports.data || pendingExports.data.length === 0) {
        return;
      }

      console.log(`📋 Found ${pendingExports.data.length} pending export(s)`);

      // Process each export
      for (const exportData of pendingExports.data) {
        await this.processExport(exportData);
      }
    } catch (error) {
      console.error('❌ Failed to fetch pending exports:', {
        message: error.message,
        details: error.stack || error.toString()
      });
    }
  }

  /**
   * Process a single export job
   */
  async processExport(exportData) {
    const jobId = exportData.id;
    this.activeJobs.add(jobId);

    try {
      console.log(`🚀 Starting export ${jobId} (${exportData.total_photos} photos)`);

      // Update status to processing
      await this.updateExportStatus(jobId, {
        status: 'processing',
        started_at: new Date().toISOString()
      });

      // Parse photo IDs from JSONB
      const photoIds = Array.isArray(exportData.photo_ids) 
        ? exportData.photo_ids 
        : JSON.parse(exportData.photo_ids || '[]');
        
      if (photoIds.length === 0) {
        throw new Error('No photo IDs specified');
      }

      // Fetch photo metadata
      const photos = await this.fetchPhotoMetadata(photoIds);
      console.log(`📊 Retrieved metadata for ${photos.length}/${photoIds.length} photos`);

      // Create ZIP file and upload to S3
      const zipInfo = await this.createAndUploadZip(exportData, photos);

      // Generate signed download URL (valid for 12 hours)
      const expiresAt = new Date(Date.now() + (config.downloadUrlExpiryHours * 60 * 60 * 1000));
      const downloadUrl = await getSignedUrl(s3PublicClient, 
        new GetObjectForUrl({
          Bucket: bucket,
          Key: exportData.object_key
        }), 
        { expiresIn: config.downloadUrlExpiryHours * 3600 }
      );

      // Mark as ready
      await this.updateExportStatus(jobId, {
        status: 'ready',
        processed_photos: photos.length,
        processed_bytes: zipInfo.size,
        download_url: downloadUrl,
        expires_at: expiresAt.toISOString(),
        checksum: zipInfo.checksum,
        completed_at: new Date().toISOString()
      });

      console.log(`✅ Export ${jobId} completed successfully (${zipInfo.size} bytes)`);

    } catch (error) {
      console.error(`❌ Export ${jobId} failed:`, error.message);
      
      await this.updateExportStatus(jobId, {
        status: 'failed',
        error: error.message
      }).catch(() => {}); // Don't fail if status update fails

    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Fetch photo metadata from database
   */
  async fetchPhotoMetadata(photoIds) {
    const { data: photos, error } = await supabase
      .from('photos')
      .select('id, album_id, filename, original_name, file_size')
      .in('id', photoIds);

    if (error) {
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    return photos || [];
  }

  /**
   * Create ZIP archive and upload to S3
   */
  async createAndUploadZip(exportData, photos) {
    return new Promise(async (resolve, reject) => {
      try {
        const { PassThrough } = require('stream');
        
        // Create a PassThrough stream for S3 upload
        const uploadStream = new PassThrough();
        
        const archive = archiver('zip', {
          zlib: { level: config.compressionLevel },
          forceLocalTime: true,
          comment: `Gallery Export - ${photos.length} photos`
        });

        // Pipe archive to upload stream
        archive.pipe(uploadStream);

        archive.setMaxListeners(100); // Prevent memory leak warnings

        let totalSize = 0;
        let checksum = require('crypto').createHash('sha256');

        archive.on('entry', (entry) => {
          if (config.enableDetailedLogs) {
            console.log(`📁 Added: ${entry.name}`);
          }
        });

        archive.on('error', (err) => {
          reject(new Error(`Archive error: ${err.message}`));
        });

        // Set up S3 upload
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucket,
            Key: exportData.object_key,
            Body: uploadStream,
            ContentType: 'application/zip',
            Metadata: {
              'export-id': exportData.id,
              'total-photos': photos.length.toString(),
              'created-by': 'web-gallery-runner'
            }
          },
          partSize: 10 * 1024 * 1024, // 10MB parts
          queueSize: 4
        });

        // Track upload progress
        archive.on('data', (chunk) => {
          totalSize += chunk.length;
          checksum.update(chunk);
        });

        // Start upload
        const uploadPromise = upload.done();

        // Add photos to archive in batches
        await this.addPhotosToArchive(archive, photos);

        // Finalize archive
        console.log(`📦 Finalizing archive for export ${exportData.id}...`);
        await archive.finalize();

        // Wait for upload to complete
        await uploadPromise;

        resolve({
          size: totalSize,
          checksum: checksum.digest('hex')
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add photos to archive in controlled batches
   */
  async addPhotosToArchive(archive, photos) {
    for (let i = 0; i < photos.length; i += config.maxPhotosPerBatch) {
      const batch = photos.slice(i, i + config.maxPhotosPerBatch);
      console.log(`📸 Processing batch ${Math.floor(i / config.maxPhotosPerBatch) + 1}/${Math.ceil(photos.length / config.maxPhotosPerBatch)} (${batch.length} photos)`);

      // Process batch with limited concurrency
      const promises = batch.map((photo, index) => 
        this.addPhotoToArchive(archive, photo, index < config.maxConcurrentDownloads)
      );

      await Promise.allSettled(promises);

      // Small delay between batches
      if (i + config.maxPhotosPerBatch < photos.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Add a single photo to the archive
   */
  async addPhotoToArchive(archive, photo) {
    try {
      const s3Key = `${photo.album_id}/pictures/${photo.filename}`;
      
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key
      });

      const response = await Promise.race([
        s3Client.send(command),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), config.downloadTimeoutMs)
        )
      ]);

      if (!response.Body) {
        throw new Error('No response body');
      }

      // Generate unique filename
      const fileExtension = photo.filename.split('.').pop() || 'jpg';
      const baseName = (photo.original_name || photo.filename).replace(/\.[^/.]+$/, '');
      const uniqueFilename = `${baseName}_${photo.id.substring(0, 8)}.${fileExtension}`;

      // Add to archive
      const { Readable } = require('stream');
      let bodyStream = response.Body;
      
      if (!(bodyStream instanceof Readable)) {
        bodyStream = Readable.fromWeb(response.Body);
      }

      archive.append(bodyStream, { name: uniqueFilename });

    } catch (error) {
      console.error(`⚠️ Failed to add photo ${photo.id}:`, error.message);
      // Add error file instead
      archive.append(`Error: ${error.message}`, { name: `ERROR_${photo.filename}.txt` });
    }
  }

  /**
   * Update export status in database
   */
  async updateExportStatus(exportId, updates) {
    const { error } = await supabase
      .from('album_exports')
      .update(updates)
      .eq('id', exportId);

    if (error) {
      throw new Error(`Failed to update export status: ${error.message}`);
    }
  }
}

module.exports = ExportProcessor;