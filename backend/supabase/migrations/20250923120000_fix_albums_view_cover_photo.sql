-- Fix albums_with_photo_count view to include cover_photo_id
-- The view was created before the cover_photo_id column was added

CREATE OR REPLACE VIEW albums_with_photo_count AS
SELECT
    a.id,
    a.title,
    a.description,
    a.date,
    a.tags,
    a.location,
    a.is_public,
    a.owner_id,
    a.cover_photo_id,  -- Explicitly include cover_photo_id
    a.created_at,
    a.updated_at,
    COALESCE(p.photo_count, 0) as photo_count
FROM albums a
LEFT JOIN (
    SELECT album_id, COUNT(*) as photo_count
    FROM photos
    GROUP BY album_id
) p ON a.id = p.album_id;