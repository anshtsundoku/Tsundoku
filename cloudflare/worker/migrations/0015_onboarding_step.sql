-- Resume onboarding from the last completed step.
-- 0 = welcome, 1 = domain, 2 = youtube, 3 = x, 4 = gmail, 5 = gemini, 6 = done.
-- Onboarding-complete resets this to 0 alongside setting onboarded_at.
--
-- Named 0015 (not 0014) because 0014_onboarding.sql already exists for the
-- onboarded_at column.

ALTER TABLE users ADD COLUMN onboarding_step INTEGER NOT NULL DEFAULT 0;
