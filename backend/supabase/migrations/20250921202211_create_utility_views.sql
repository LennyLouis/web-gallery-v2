-- Create utility views for easier querying

-- View: albums with photo count
CREATE OR REPLACE VIEW albums_with_photo_count AS
SELECT
    a.*,
    COALESCE(p.photo_count, 0) as photo_count
FROM albums a
LEFT JOIN (
    SELECT album_id, COUNT(*) as photo_count
    FROM photos
    GROUP BY album_id
) p ON a.id = p.album_id;

-- View: public albums for anonymous access
CREATE OR REPLACE VIEW public_albums_view AS
SELECT
    id,
    title,
    description,
    date,
    tags,
    location,
    created_at,
    (SELECT COUNT(*) FROM photos WHERE album_id = albums.id) as photo_count
FROM albums
WHERE is_public = true
ORDER BY created_at DESC;

-- Function: get album stats (for owners only)
CREATE OR REPLACE FUNCTION get_album_stats(album_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    album_record albums%ROWTYPE;
BEGIN
    -- Check if user owns the album
    SELECT * INTO album_record
    FROM albums
    WHERE id = album_uuid AND owner_id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Album not found or access denied';
    END IF;

    -- Build stats
    SELECT json_build_object(
        'album_id', album_record.id,
        'title', album_record.title,
        'total_photos', (SELECT COUNT(*) FROM photos WHERE album_id = album_uuid),
        'total_size_bytes', COALESCE((SELECT SUM(file_size) FROM photos WHERE album_id = album_uuid), 0),
        'access_links_count', (SELECT COUNT(*) FROM access_links WHERE album_id = album_uuid AND is_active = true),
        'created_at', album_record.created_at,
        'updated_at', album_record.updated_at
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;