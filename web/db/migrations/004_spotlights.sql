-- Weekly "Changer Spotlight": a featured changemaker or project shown on the
-- feed and landing page. Only one spotlight is active at a time; admins
-- curate via the Admin Dashboard.
CREATE TABLE IF NOT EXISTS spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  blurb TEXT NOT NULL,
  profile_url TEXT,
  project_url TEXT,
  strand TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  featured_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spotlights_active ON spotlights (active, created_at DESC);
