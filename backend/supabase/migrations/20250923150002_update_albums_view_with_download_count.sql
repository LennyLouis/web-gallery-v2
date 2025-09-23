-- Migration: Update albums_with_photo_count view to include download_count
-- Description: Add download_count to the albums view after adding the column

-- Drop and recreate the view to include download_count
DROP VIEW IF EXISTS albums_with_photo_count;

CREATE VIEW albums_with_photo_count AS
SELECT
    a.id,
    a.title,
    a.description,
    a.date,
    a.tags,
    a.location,
    a.is_public,
    a.owner_id,
    a.cover_photo_id,
    a.download_count,  -- Include the new download_count column
    a.created_at,
    a.updated_at,
    COALESCE(p.photo_count, 0) as photo_count
FROM albums a
LEFT JOIN (
    SELECT album_id, COUNT(*) as photo_count
    FROM photos
    GROUP BY album_id
) p ON a.id = p.album_id;