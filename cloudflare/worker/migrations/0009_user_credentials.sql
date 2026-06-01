-- Phase 1 multi-tenancy: per-user encrypted third-party credentials on `users`.
--
-- Each value is a base64-encoded AES-GCM blob with the 12-byte IV prefixed:
--   base64( iv(12 bytes) || ciphertext )
-- Encryption/decryption is handled by src/lib/crypto.js using env.ENCRYPTION_KEY.
--
-- Columns are nullable. The single-user shim never writes them and keeps using
-- the worker-level wrangler secrets (GEMINI_API_KEY, YOUTUBE_API_KEY, etc.), so
-- nothing changes until a later phase reads per-user credentials.
--
-- Idempotency: re-running errors with "duplicate column name" (expected/harmless).

ALTER TABLE users ADD COLUMN yt_api_key_enc         TEXT;
ALTER TABLE users ADD COLUMN gemini_api_key_enc     TEXT;
ALTER TABLE users ADD COLUMN gmail_imap_pass_enc    TEXT;
ALTER TABLE users ADD COLUMN twitter_auth_token_enc TEXT;
ALTER TABLE users ADD COLUMN twitter_ct0_enc        TEXT;
