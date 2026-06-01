-- First-time onboarding wizard completion timestamp.
-- NULL means the user has not finished onboarding; App redirects to /onboarding.

ALTER TABLE users ADD COLUMN onboarded_at TEXT;

-- Users who already have domains skip the wizard (existing installs).
UPDATE users SET onboarded_at = datetime('now')
 WHERE onboarded_at IS NULL
   AND EXISTS (SELECT 1 FROM domains WHERE domains.user_id = users.id);
