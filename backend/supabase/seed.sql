-- Seed data for Web Gallery development
-- This file is executed after migrations

-- Note: Storage is now managed via Minio S3, not Supabase Storage
-- Views and functions are now in migrations

-- You can add sample data here if needed for development
-- For example:
/*
INSERT INTO albums (title, description, owner_id, is_public)
VALUES (
  'Sample Album',
  'A sample album for testing',
  (SELECT id FROM auth.users LIMIT 1),
  true
) ON CONFLICT DO NOTHING;
*/