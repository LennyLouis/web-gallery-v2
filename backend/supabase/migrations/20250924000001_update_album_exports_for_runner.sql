-- Migration: Update album_exports table for runner architecture
-- Add columns for photo selection, download URLs, and expiration management

ALTER TABLE album_exports 
ADD COLUMN IF NOT EXISTS photo_ids JSONB NULL,
ADD COLUMN IF NOT EXISTS download_url TEXT NULL,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE NULL;

-- Update status constraint to include new states
ALTER TABLE album_exports 
DROP CONSTRAINT IF EXISTS album_exports_status_check;

ALTER TABLE album_exports 
ADD CONSTRAINT album_exports_status_check 
CHECK (status IN ('queued','processing','ready','failed','cancelling','cancelled','expired','cleanup'));

-- Create index for efficient runner polling
CREATE INDEX IF NOT EXISTS idx_album_exports_status_created 
ON album_exports(status, created_at);

-- Create index for cleanup job
CREATE INDEX IF NOT EXISTS idx_album_exports_expires_at 
ON album_exports(expires_at) 
WHERE expires_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN album_exports.photo_ids IS 'JSON array of photo IDs to include in export';
COMMENT ON COLUMN album_exports.download_url IS 'Signed S3 URL for downloading the ZIP file (valid 12 hours)';
COMMENT ON COLUMN album_exports.expires_at IS 'When the download URL expires and file should be cleaned up';

-- Optional: Add constraint to ensure photo_ids is valid JSON array
ALTER TABLE album_exports 
ADD CONSTRAINT check_photo_ids_format 
CHECK (photo_ids IS NULL OR jsonb_typeof(photo_ids) = 'array');