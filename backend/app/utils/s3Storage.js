const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

class S3Storage {
  constructor() {
    this.s3Client = new S3Client({
      endpoint: config.storage.s3.endpoint,
      region: config.storage.s3.region,
      credentials: {
        accessKeyId: config.storage.s3.accessKeyId,
        secretAccessKey: config.storage.s3.secretAccessKey,
      },
      forcePathStyle: config.storage.s3.forcePathStyle,
    });

    // Client S3 séparé pour les URLs signées avec endpoint public
    this.s3PublicClient = new S3Client({
      endpoint: config.storage.s3.publicEndpoint,
      region: config.storage.s3.region,
      credentials: {
        accessKeyId: config.storage.s3.accessKeyId,
        secretAccessKey: config.storage.s3.secretAccessKey,
      },
      forcePathStyle: config.storage.s3.forcePathStyle,
    });

    this.bucket = config.storage.s3.bucket;
  }

  // Uploader un fichier
  async uploadFile(buffer, key, contentType = 'application/octet-stream') {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      return {
        key,
        url: `${config.storage.s3.endpoint}/${this.bucket}/${key}`
      };
    } catch (error) {
      console.error('S3 Upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Uploader un stream (pour les gros fichiers/archives)
  async uploadStream(stream, key, contentType = 'application/octet-stream') {
    try {
      const { Upload } = require('@aws-sdk/lib-storage');
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream,
          ContentType: contentType,
        },
        // Configuration optimisée pour les gros fichiers
        partSize: 10 * 1024 * 1024, // 10MB parts
        queueSize: 4, // 4 uploads simultanés
        leavePartsOnError: false,
      });

      // Gestion du progress (optionnel)
      upload.on('httpUploadProgress', (progress) => {
        if (progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          console.log(`📤 Upload progress for ${key}: ${percent}% (${progress.loaded}/${progress.total} bytes)`);
        }
      });

      const result = await upload.done();

      return {
        key,
        url: result.Location || `${config.storage.s3.endpoint}/${this.bucket}/${key}`,
        etag: result.ETag
      };
    } catch (error) {
      console.error('S3 Stream upload error:', error);
      throw new Error(`Failed to upload stream: ${error.message}`);
    }
  }

  // Supprimer un fichier
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('S3 Delete error:', error);
      return false;
    }
  }

  // Générer une URL signée pour téléchargement (utilise l'endpoint public)
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3PublicClient, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('S3 GetSignedUrl error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  // URL publique pour les previews (utilise l'endpoint public)
  getPublicUrl(key) {
    return `${config.storage.s3.publicEndpoint}/${this.bucket}/${key}`;
  }

  // Vérifier si un fichier existe
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Obtenir les métadonnées d'un fichier
  async getFileMetadata(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
      };
    } catch (error) {
      throw new Error(`File not found: ${key}`);
    }
  }

  // Générer les chemins pour un album
  getAlbumPaths(albumId) {
    return {
      picturesPath: `${albumId}/pictures/`,
      previewsPath: `${albumId}/previews/`
    };
  }

  // Générer le chemin complet pour une photo
  getPhotoPath(albumId, filename, isPreview = false) {
    const folder = isPreview ? 'previews' : 'pictures';
    return `${albumId}/${folder}/${filename}`;
  }

  // Supprimer tous les fichiers d'un album
  async deleteAlbumFiles(albumId) {
    const { picturesPath, previewsPath } = this.getAlbumPaths(albumId);

    try {
      // Note: Pour une suppression complète, il faudrait lister tous les objets
      // et les supprimer un par un. Pour l'instant, on suppose que les fichiers
      // individuels sont supprimés par ailleurs.
      console.log(`Album ${albumId} files deletion initiated`);
      return true;
    } catch (error) {
      console.error('Failed to delete album files:', error);
      return false;
    }
  }

  // Créer la structure d'album (pas nécessaire avec S3, mais pour cohérence)
  async createAlbumStructure(albumId) {
    // Avec S3, la structure est créée automatiquement lors de l'upload
    const paths = this.getAlbumPaths(albumId);
    console.log(`Album structure ready for ${albumId}:`, paths);
    return paths;
  }
}

module.exports = new S3Storage();