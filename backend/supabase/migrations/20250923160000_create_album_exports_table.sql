-- Migration: Create album_exports table for asynchronous ZIP exports with progress
-- Description: Stores export jobs, progress metrics, and resulting object key

CREATE TABLE IF NOT EXISTS album_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued','processing','ready','failed','cancelling','cancelled')),
  object_key text,
  total_photos int,
  processed_photos int DEFAULT 0,
  total_bytes bigint,
  processed_bytes bigint DEFAULT 0,
  eta_seconds int,
  checksum text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_album_exports_album_id ON album_exports(album_id);
CREATE INDEX IF NOT EXISTS idx_album_exports_status ON album_exports(status);
