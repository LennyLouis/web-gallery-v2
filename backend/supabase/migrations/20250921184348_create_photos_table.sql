-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    preview_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS photos_album_id_idx ON photos(album_id);
CREATE INDEX IF NOT EXISTS photos_filename_idx ON photos(filename);
CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS photos_mime_type_idx ON photos(mime_type);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policies for photos
CREATE POLICY "Users can view photos from their albums" ON photos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
            AND albums.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can view photos from public albums" ON photos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
            AND albums.is_public = true
        )
    );

CREATE POLICY "Users can insert photos to their albums" ON photos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
            AND albums.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update photos from their albums" ON photos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
            AND albums.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete photos from their albums" ON photos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM albums
            WHERE albums.id = photos.album_id
            AND albums.owner_id = auth.uid()
        )
    );

-- Create trigger to update updated_at column
CREATE TRIGGER update_photos_updated_at
    BEFORE UPDATE ON photos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();