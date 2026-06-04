-- Browser-extension pairings: long-lived bearer tokens the extension uses to
-- push x.com cookies. Tokens are stored as sha256 hashes, never plaintext.
--
-- Named 0016 (not 0015) because 0015_onboarding_step.sql already exists.

CREATE TABLE extension_pairings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

CREATE INDEX idx_extension_pairings_user ON extension_pairings(user_id);
