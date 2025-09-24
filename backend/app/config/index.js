require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },

  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // List of allowed origins
      const allowedOrigins = [
        process.env.CORS_ORIGIN,
        'http://localhost',
        'http://localhost:80',
        'http://localhost:3001',
        'http://localhost:5173'
      ].filter(Boolean); // Remove any undefined values
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`🚫 CORS blocked origin: ${origin}`);
        console.log(`✅ Allowed origins: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },

  storage: {
    type: 's3', // 'local' or 'supabase' or 's3'
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      forcePathStyle: true // Required for Minio
    }
  },
  exports: {
    progressUpdateIntervalMs: parseInt(process.env.EXPORT_PROGRESS_INTERVAL_MS || '1000', 10),
    maxPhotosPerExport: parseInt(process.env.EXPORT_MAX_PHOTOS || '5000', 10),
    maxTotalBytes: parseInt(process.env.EXPORT_MAX_TOTAL_BYTES || (6 * 1024 * 1024 * 1024).toString(), 10),
    // Streaming configuration for better performance with large exports
    concurrentDownloads: parseInt(process.env.EXPORT_CONCURRENT_DOWNLOADS || '5', 10),
    batchSize: parseInt(process.env.EXPORT_BATCH_SIZE || '10', 10),
    streamTimeout: parseInt(process.env.EXPORT_STREAM_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.EXPORT_MAX_RETRIES || '3', 10),
    cleanup: {
      enabled: (process.env.EXPORT_CLEANUP_ENABLED || 'true') === 'true',
      ttlHours: parseInt(process.env.EXPORT_CLEANUP_TTL_HOURS || '72', 10),
      intervalMinutes: parseInt(process.env.EXPORT_CLEANUP_INTERVAL_MINUTES || '60', 10)
    }
  }
};

module.exports = config;