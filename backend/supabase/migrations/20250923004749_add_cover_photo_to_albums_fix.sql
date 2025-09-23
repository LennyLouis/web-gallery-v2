-- Add cover_photo_id column to albums table
ALTER TABLE albums 
ADD COLUMN cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN albums.cover_photo_id IS 'Reference to the photo used as album cover';

-- Create index for better performance on cover photo lookups
CREATE INDEX idx_albums_cover_photo_id ON albums(cover_photo_id);