-- Audit trail for admin erase/anonymize actions (accountability for
-- irreversible user-data operations).
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('erase', 'anonymize')),
  deleted_count INTEGER NOT NULL DEFAULT 0,
  anonymized_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions (created_at DESC);
