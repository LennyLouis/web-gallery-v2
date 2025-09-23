-- Migration: Add function to increment album download count atomically
-- Description: Create a PostgreSQL function for atomic download count increments

-- Create function to atomically increment download count
CREATE OR REPLACE FUNCTION increment_album_download_count(album_id uuid)
RETURNS integer AS $$
DECLARE
    new_count integer;
BEGIN
    UPDATE albums 
    SET download_count = download_count + 1 
    WHERE id = album_id 
    RETURNING download_count INTO new_count;
    
    RETURN new_count;
END;
$$ LANGUAGE plpgsql;