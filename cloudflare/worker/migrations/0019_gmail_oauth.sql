-- Gmail integration via Google OAuth incremental authorization (gmail.readonly).
--
-- Stores per-user OAuth tokens (AES-GCM encrypted via lib/crypto.js) plus the
-- connected Gmail address. The legacy gmail_imap_pass_enc column (migration
-- 0009) is left in place, unused. 'gmail' remains a valid sources.type value
-- (type is TEXT, no schema change needed).

ALTER TABLE users ADD COLUMN gmail_access_token_enc TEXT;
ALTER TABLE users ADD COLUMN gmail_refresh_token_enc TEXT;
ALTER TABLE users ADD COLUMN gmail_expires_at TEXT;
ALTER TABLE users ADD COLUMN gmail_email TEXT;
