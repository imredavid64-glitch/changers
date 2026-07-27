CREATE TABLE IF NOT EXISTS media_assets (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL,
  purpose text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('public', 'private')),
  storage_key text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  width_px integer NOT NULL CHECK (width_px > 0),
  height_px integer NOT NULL CHECK (height_px > 0),
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS media_assets_owner_created_idx
  ON media_assets (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_purpose_created_idx
  ON media_assets (purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS media_assets_visibility_created_idx
  ON media_assets (visibility, created_at DESC);

