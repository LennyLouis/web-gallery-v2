const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const JSZip = require('jszip');
const mime = require('mime-types');
const s3Storage = require('../utils/s3Storage');
const Album = require('../models/Album');

// Configuration multer pour stockage temporaire
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Vérifier le type MIME (images + ZIP)
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/zip', 'application/x-zip-compressed'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and ZIP files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max pour les ZIP
    files: 50 // max 50 files par upload (ou 1 ZIP avec beaucoup d'images)
  }
});

// Fonction pour traiter une image individuelle
const processImage = async (buffer, filename, albumId) => {
  const fileId = uuidv4();
  const ext = path.extname(filename).toLowerCase() || '.jpg';
  const newFilename = `${fileId}${ext}`;

  // Obtenir les métadonnées de l'image
  const metadata = await sharp(buffer).metadata();

  // Traitement de l'image originale (optimisation)
  let processedBuffer = buffer;

  // Si l'image est très grande, la redimensionner
  if (metadata.width > 4000 || metadata.height > 4000) {
    processedBuffer = await sharp(buffer)
      .resize(4000, 4000, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 95, progressive: true })
      .toBuffer();
  } else {
    // Optimiser sans redimensionner
    processedBuffer = await sharp(buffer)
      .jpeg({ quality: 95, progressive: true })
      .toBuffer();
  }

  // Créer le preview (800px max)
  const previewBuffer = await sharp(buffer)
    .resize(800, 800, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  // Chemins S3
  const originalPath = s3Storage.getPhotoPath(albumId, newFilename, false);
  const previewPath = s3Storage.getPhotoPath(albumId, newFilename, true);

  // Upload vers Minio S3
  const [originalUpload, previewUpload] = await Promise.all([
    s3Storage.uploadFile(processedBuffer, originalPath, 'image/jpeg'),
    s3Storage.uploadFile(previewBuffer, previewPath, 'image/jpeg')
  ]);

  // Obtenir les nouvelles métadonnées après traitement
  const finalMetadata = await sharp(processedBuffer).metadata();

  return {
    filename: newFilename,
    original_name: filename,
    file_path: originalPath,
    preview_path: previewPath,
    file_size: processedBuffer.length,
    mime_type: 'image/jpeg',
    width: finalMetadata.width,
    height: finalMetadata.height,
    album_id: albumId
  };
};

// Fonction pour extraire et traiter un ZIP
const processZipFile = async (zipBuffer, albumId) => {
  const zip = new JSZip();
  const zipContents = await zip.loadAsync(zipBuffer);

  const processedFiles = [];
  const errors = [];

  for (const [filename, file] of Object.entries(zipContents.files)) {
    // Ignorer les dossiers et fichiers système
    if (file.dir || filename.startsWith('__MACOSX/') || filename.startsWith('.')) {
      continue;
    }

    // Vérifier que c'est une image
    const mimeType = mime.lookup(filename);
    if (!mimeType || !mimeType.startsWith('image/')) {
      continue;
    }

    try {
      const imageBuffer = await file.async('nodebuffer');
      const processedFile = await processImage(imageBuffer, path.basename(filename), albumId);
      processedFiles.push(processedFile);
    } catch (error) {
      console.error(`Error processing ${filename} from ZIP:`, error);
      errors.push({
        error: error.message,
        original_name: filename
      });
    }
  }

  return { processedFiles, errors };
};

const processImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const { albumId } = req.params;

    // Vérifier que l'album existe et appartient à l'utilisateur
    const album = await Album.findById(albumId);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (album.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allProcessedFiles = [];
    const allErrors = [];

    for (const file of req.files) {
      try {
        // Vérifier si c'est un ZIP
        if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
          const { processedFiles, errors } = await processZipFile(file.buffer, albumId);
          allProcessedFiles.push(...processedFiles);
          allErrors.push(...errors);
        } else {
          // Traiter comme image individuelle
          const processedFile = await processImage(file.buffer, file.originalname, albumId);
          allProcessedFiles.push(processedFile);
        }

      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        allErrors.push({
          error: fileError.message,
          original_name: file.originalname
        });
      }
    }

    // Ajouter les fichiers traités à la requête
    req.processedFiles = allProcessedFiles;
    req.processingErrors = allErrors;
    
    next();

  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).json({ error: 'Image processing failed' });
  }
};

// Middleware pour vérifier les permissions d'album
const checkAlbumAccess = async (req, res, next) => {
  try {
    const { albumId } = req.params;

    const album = await Album.findById(albumId);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (album.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.album = album;
    next();

  } catch (error) {
    console.error('Album access check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Middleware flexible qui accepte 'files' OU 'photos'
const flexibleUpload = (req, res, next) => {
  // Créer un middleware qui accepte les deux noms de champs
  const uploadBoth = upload.fields([
    { name: 'files', maxCount: 50 },
    { name: 'photos', maxCount: 50 }
  ]);

  uploadBoth(req, res, (err) => {
    if (err) {
      console.error('flexibleUpload: Upload error:', err.message);
      return next(err);
    }

    // Normaliser les fichiers - convertir les objets en array
    let files = [];
    if (req.files) {
      if (req.files.files) {
        files = files.concat(req.files.files);
      }
      if (req.files.photos) {
        files = files.concat(req.files.photos);
      }
    }

    // Remettre les fichiers dans req.files pour compatibilité avec le reste du code
    req.files = files;
    
    next();
  });
};

module.exports = {
  upload: flexibleUpload,
  processImages,
  checkAlbumAccess
};