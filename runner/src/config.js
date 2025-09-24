/**
 * Configuration for the Export Runner
 */

// Validation des variables d'environnement critiques au démarrage
const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  process.exit(1);
}

module.exports = {
  // Polling and processing intervals
  pollIntervalMs: parseInt(process.env.RUNNER_POLL_INTERVAL_MS || '5000', 10), // 5 seconds
  cleanupIntervalMs: parseInt(process.env.RUNNER_CLEANUP_INTERVAL_MS || '3600000', 10), // 1 hour
  
  // Processing limits
  maxConcurrentJobs: parseInt(process.env.RUNNER_MAX_CONCURRENT_JOBS || '2', 10),
  maxPhotosPerBatch: parseInt(process.env.RUNNER_MAX_PHOTOS_PER_BATCH || '5', 10),
  maxConcurrentDownloads: parseInt(process.env.RUNNER_MAX_CONCURRENT_DOWNLOADS || '3', 10),
  
  // Timeouts
  downloadTimeoutMs: parseInt(process.env.RUNNER_DOWNLOAD_TIMEOUT_MS || '60000', 10), // 60 seconds
  uploadTimeoutMs: parseInt(process.env.RUNNER_UPLOAD_TIMEOUT_MS || '300000', 10), // 5 minutes
  
  // File management
  downloadUrlExpiryHours: parseInt(process.env.RUNNER_DOWNLOAD_URL_EXPIRY_HOURS || '12', 10),
  compressionLevel: parseInt(process.env.RUNNER_COMPRESSION_LEVEL || '1', 10), // Fast compression
  
  // Supabase connection
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // S3 configuration
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
};