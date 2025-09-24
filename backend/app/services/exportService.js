const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const archiver = require('archiver');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const Album = require('../models/Album');
const Photo = require('../models/Photo');
const AlbumExport = require('../models/AlbumExport');
const UserAlbumPermission = require('../models/UserAlbumPermission');
const s3Storage = require('../utils/s3Storage');
const config = require('../config');

// In-memory queue (simple FIFO)
const jobQueue = [];
let workerStarted = false;

const EXPORT_CONFIG = {
  progressUpdateIntervalMs: (config.exports && config.exports.progressUpdateIntervalMs) || 1000,
  maxPhotosPerExport: (config.exports && config.exports.maxPhotosPerExport) || 5000,
  maxTotalBytes: (config.exports && config.exports.maxTotalBytes) || (6 * 1024 * 1024 * 1024),
  // New streaming configuration
  concurrentDownloads: parseInt(process.env.EXPORT_CONCURRENT_DOWNLOADS || '3', 10), // Reduced from 5 to 3
  batchSize: parseInt(process.env.EXPORT_BATCH_SIZE || '5', 10), // Reduced from 10 to 5
  streamTimeout: parseInt(process.env.EXPORT_STREAM_TIMEOUT_MS || '60000', 10), // Increased to 60s
  maxRetries: parseInt(process.env.EXPORT_MAX_RETRIES || '3', 10)
};

// Debug logging removed per request.

async function enqueueExport({ albumId, photoIds, userId }) {
  // Permissions check
  const hasAccess = await UserAlbumPermission.hasPermission(userId, albumId, 'download');
  if (!hasAccess) {
    throw new Error('Access denied');
  }

  let photos;
  if (photoIds && photoIds.length > 0) {
    photos = await Promise.all(photoIds.map(id => Photo.findById(id)));
    photos = photos.filter(p => p && p.album_id === albumId);
  } else {
    photos = await Photo.findByAlbum(albumId);
  }

  if (!photos.length) throw new Error('No photos found for export');

  const totalPhotos = photos.length;
  if (totalPhotos > EXPORT_CONFIG.maxPhotosPerExport) {
    throw new Error('Export too large (photo count exceeds limit)');
  }

  const totalBytes = photos.reduce((sum, p) => sum + (p.file_size || 0), 0);
  if (totalBytes > EXPORT_CONFIG.maxTotalBytes) {
    throw new Error('Export too large (total bytes exceeds limit)');
  }

  // Dedup existing export (same size & photo count) if ready OR in progress
  const existing = await AlbumExport.findExistingQueuedOrProcessing(albumId, totalPhotos, totalBytes);
  if (existing && existing.status === 'ready') {
    return existing; // immediate reuse
  }
  if (existing && ['queued','processing'].includes(existing.status)) {
    return existing; // return that job so client can poll
  }

  const album = await Album.findById(albumId);
  const sanitizedTitle = (album?.title || 'album').replace(/[^a-zA-Z0-9_-]/g, '_');
  const exportObjectKey = `${albumId}/exports/${Date.now()}_${sanitizedTitle}.zip`;

  const exportRow = await AlbumExport.create({
    album_id: albumId,
    status: 'queued',
    object_key: exportObjectKey,
    total_photos: totalPhotos,
    total_bytes: totalBytes
  });

  jobQueue.push({ exportId: exportRow.id, albumId, photoIds: photos.map(p => p.id) });

  startWorkerLoop();
  return exportRow;
}

async function processJob(job) {
  console.log(`📋 Processing export job ${job.exportId} for album ${job.albumId} (${job.photoIds.length} photos)`);
  
  const exportRow = await AlbumExport.findById(job.exportId);
  if (!exportRow) {
    console.error(`❌ Export row not found: ${job.exportId}`);
    return;
  }
  if (exportRow.status !== 'queued') {
    console.warn(`⚠️ Export ${job.exportId} already processed (status: ${exportRow.status})`);
    return; // Already processed or cancelled
  }

  console.log(`🔄 Setting export ${job.exportId} to processing status`);
  await AlbumExport.patch(exportRow.id, { status: 'processing', started_at: new Date().toISOString() });

  const photos = await Promise.all(job.photoIds.map(id => Photo.findById(id)));
  const validPhotos = photos.filter(Boolean);

  let processedPhotos = 0;
  let processedBytes = 0;
  let failedPhotos = 0;
  const totalBytes = validPhotos.reduce((sum, p) => sum + (p.file_size || 0), 0);
  const totalPhotos = validPhotos.length;

  const hash = crypto.createHash('sha256');
  
  // Create progress tracking transform
  const progressTap = new Transform({
    transform(chunk, enc, cb) {
      processedBytes += chunk.length;
      hash.update(chunk);
      cb(null, chunk);
    }
  });

  const archive = archiver('zip', { 
    store: false, // Enable compression for better space efficiency
    level: 1,     // Fast compression level
    forceLocalTime: true,
    comment: `Gallery Export - ${totalPhotos} photos`
  });

  // Increase max listeners to prevent memory leak warnings
  archive.setMaxListeners(50);

  // Enhanced archive event handling
  archive.on('entry', (entry) => {
    if (entry.type === 'file') {
      processedPhotos += 1;
    }
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('Archive warning (file not found):', err);
      failedPhotos += 1;
    } else {
      throw err;
    }
  });

  archive.on('error', async (err) => {
    console.error('Archive error during export:', err.message);
    try {
      await AlbumExport.patch(exportRow.id, { 
        status: 'failed', 
        error: `Archive error: ${err.message}` 
      });
    } catch (_) {}
  });

  // Use managed multipart upload with streaming
  const managedUpload = new Upload({
    client: s3Storage.s3Client,
    params: {
      Bucket: s3Storage.bucket,
      Key: exportRow.object_key,
      Body: archive.pipe(progressTap),
      ContentType: 'application/zip',
      Metadata: {
        'total-photos': totalPhotos.toString(),
        'export-id': exportRow.id
      }
    },
    // Configure multipart upload for better streaming
    partSize: 10 * 1024 * 1024, // 10MB parts
    queueSize: 4, // Allow 4 concurrent part uploads
    leavePartsOnError: false
  });

  const uploadPromise = managedUpload.done();

  // Progress update interval
  const interval = setInterval(async () => {
    try {
      const progressPercent = Math.min(
        Math.floor((processedPhotos / totalPhotos) * 85) + // 85% for file processing
        Math.floor((processedBytes / totalBytes) * 15),    // 15% for upload progress
        100
      );
      
      await AlbumExport.patch(exportRow.id, {
        processed_photos: processedPhotos,
        processed_bytes: processedBytes,
        // percent: progressPercent, // Temporarily removed - calculated in model
        eta_seconds: estimateEta(totalBytes, processedBytes, exportRow.started_at)
      });
    } catch (e) {
      console.warn('Progress update failed:', e.message);
    }
  }, EXPORT_CONFIG.progressUpdateIntervalMs);

  try {
    // Process photos in batches with controlled concurrency
    await processPhotosInBatches(archive, validPhotos);
    
    // Finalize archive
    await archive.finalize();
    await uploadPromise;
    
    clearInterval(interval);
    
    const checksum = hash.digest('hex');
    const successfulPhotos = processedPhotos;
    
    // Mark as completed
    await AlbumExport.patch(exportRow.id, {
      status: 'ready',
      processed_photos: successfulPhotos,
      processed_bytes: processedBytes,
      // percent: 100, // Temporarily removed - calculated in model
      checksum,
      completed_at: new Date().toISOString(),
      eta_seconds: 0,
      error: failedPhotos > 0 ? `${failedPhotos} photos failed to process` : null
    });
    
    console.log(`Export ${exportRow.id} completed: ${successfulPhotos}/${totalPhotos} photos (${failedPhotos} failed)`);
    
  } catch (err) {
    clearInterval(interval);
    console.error('Export job failed:', err);
    
    try {
      await AlbumExport.patch(exportRow.id, { 
        status: 'failed', 
        error: `Export failed: ${err.message}`,
        processed_photos: processedPhotos
      });
    } catch (_) {}
    
    // Clean up failed upload
    try {
      await s3Storage.deleteFile(exportRow.object_key);
    } catch (_) {}
  }
}

async function processPhotosInBatches(archive, photos) {
  const { batchSize, concurrentDownloads } = EXPORT_CONFIG;
  
  // Process photos in batches to prevent memory overflow
  for (let i = 0; i < photos.length; i += batchSize) {
    const batch = photos.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(photos.length/batchSize)} (${batch.length} photos)`);
    
    // Process each batch with controlled concurrency
    const promises = batch.map((photo, index) => 
      processPhotoWithRetry(archive, photo, index < concurrentDownloads)
    );
    
    // Wait for current batch to complete before moving to next
    await Promise.allSettled(promises);
    
    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < photos.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

async function processPhotoWithRetry(archive, photo, immediate = false) {
  const maxRetries = EXPORT_CONFIG.maxRetries;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add delay for non-immediate processing to spread load
      if (!immediate && attempt === 1) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      }
      
      await processPhotoStream(archive, photo);
      return; // Success
      
    } catch (error) {
      lastError = error;
      console.warn(`Photo ${photo.id} attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`Photo ${photo.id} failed after ${maxRetries} attempts:`, lastError?.message);
  throw lastError;
}

async function processPhotoStream(archive, photo) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout processing photo ${photo.id}`));
    }, EXPORT_CONFIG.streamTimeout);
    
    const cleanup = () => clearTimeout(timeoutId);
    
    try {
      const key = photo.file_path;
      const getCmd = new GetObjectCommand({ 
        Bucket: s3Storage.bucket, 
        Key: key 
      });
      
      s3Storage.s3Client.send(getCmd)
        .then(obj => {
          const bodyStream = obj.Body;
          
          // Generate unique filename
          const fileExt = photo.filename.split('.').pop() || 'jpg';
          const base = (photo.original_name || photo.filename).replace(/\.[^/.]+$/, '');
          const uniqueName = `${base}_${photo.id.substring(0,8)}.${fileExt}`;
          
          // Add to archive with stream
          const entry = archive.append(bodyStream, { 
            name: uniqueName,
            date: photo.created_at ? new Date(photo.created_at) : new Date()
          });
          
          // Handle stream events
          bodyStream.on('error', (err) => {
            cleanup();
            reject(new Error(`Stream error for photo ${photo.id}: ${err.message}`));
          });
          
          entry.on('close', () => {
            cleanup();
            resolve();
          });
          
          entry.on('error', (err) => {
            cleanup();
            reject(new Error(`Archive entry error for photo ${photo.id}: ${err.message}`));
          });
          
        })
        .catch(err => {
          cleanup();
          reject(new Error(`S3 fetch error for photo ${photo.id}: ${err.message}`));
        });
        
    } catch (err) {
      cleanup();
      reject(new Error(`Process error for photo ${photo.id}: ${err.message}`));
    }
  });
}

function estimateEta(totalBytes, processedBytes, startedAt) {
  if (!processedBytes || !startedAt) return null;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000; // seconds
  const rate = processedBytes / elapsed; // bytes/sec
  if (rate <= 0) return null;
  const remaining = totalBytes - processedBytes;
  return Math.max(0, Math.round(remaining / rate));
}

function startWorkerLoop() {
  if (workerStarted) return;
  workerStarted = true;
  console.log('🏗️ Starting export worker loop...');
  (async function loop() {
    while (true) {
      const job = jobQueue.shift();
      if (!job) {
        // console.log('⏳ Worker waiting for jobs...'); // Too verbose
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      console.log(`🚀 Worker processing job: ${job.exportId}`);
      await processJob(job);
      console.log(`✅ Worker finished job: ${job.exportId}`);
    }
  })();
}

async function getExport(exportId) {
  return await AlbumExport.findById(exportId);
}

async function cleanupOldExports() {
  if (!config.exports || !config.exports.cleanup || !config.exports.cleanup.enabled) return;
  const ttlHours = config.exports.cleanup.ttlHours || 72;
  const cutoff = new Date(Date.now() - ttlHours * 3600 * 1000).toISOString();
  // Fetch ready exports older than cutoff and delete objects
  const { data, error } = await require('../config/database').supabaseAdmin
    .from('album_exports')
    .select('*')
    .eq('status', 'ready')
    .lt('completed_at', cutoff);
  if (error) {
    console.warn('Cleanup fetch error:', error.message);
    return;
  }
  if (!data || !data.length) return;
  for (const row of data) {
    try {
      await s3Storage.deleteFile(row.object_key);
      await AlbumExport.patch(row.id, { status: 'cancelled', error: 'Cleaned up (TTL exceeded)' });
    } catch (e) {
      console.warn('Cleanup delete failed:', e.message);
    }
  }
}

module.exports = {
  enqueueExport,
  getExport,
  startWorkerLoop,
  cleanupOldExports
};
