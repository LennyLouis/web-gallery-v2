const { createClient } = require('@supabase/supabase-js');
const { S3Client } = require('@aws-sdk/client-s3');
const config = require('./config');

/**
 * Database and S3 client initialization
 */

// Initialize Supabase client with service role key
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Initialize S3 client for internal operations
const s3Client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

// Initialize S3 client for public URL generation
const s3PublicClient = new S3Client({
  endpoint: config.s3.publicEndpoint,
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: config.s3.forcePathStyle,
});

module.exports = {
  supabase,
  s3Client,
  s3PublicClient,
  bucket: config.s3.bucket
};