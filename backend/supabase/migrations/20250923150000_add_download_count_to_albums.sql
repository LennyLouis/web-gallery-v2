-- Migration: Add download_count to albums table
-- Description: Add a download counter to track album downloads

-- Add download_count column to albums table
ALTER TABLE albums 
ADD COLUMN download_count integer DEFAULT 0 NOT NULL;

-- Create index for performance on download_count queries
CREATE INDEX idx_albums_download_count ON albums(download_count);

-- Update existing albums to have download_count = 0 (already default but explicit)
UPDATE albums SET download_count = 0 WHERE download_count IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN albums.download_count IS 'Number of times this album has been downloaded';