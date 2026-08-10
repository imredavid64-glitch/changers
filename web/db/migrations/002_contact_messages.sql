CREATE TABLE IF NOT EXISTS contact_messages (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  organization text,
  subject text,
  message text NOT NULL,
  user_id text,
  consent_given boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  referrer text,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  replied_at timestamptz
);

CREATE INDEX IF NOT EXISTS contact_messages_created_idx
  ON contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_email_idx
  ON contact_messages (email);
