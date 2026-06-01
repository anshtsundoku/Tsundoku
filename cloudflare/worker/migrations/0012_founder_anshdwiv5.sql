-- Re-point the bootstrap founder (id=1) at the owner's real Google email.
-- All legacy domains, sources, posts, and push subscriptions live on user_id = 1.
--
-- Order matters: delete the empty duplicate (same email) before updating id=1.
-- Then deploy with OWNER_EMAIL=anshdwiv5@gmail.com and sign in again.

-- 1. Remove empty duplicate accounts (including anshdwiv5@gmail.com on id>1).
DELETE FROM users
 WHERE id <> 1
   AND NOT EXISTS (SELECT 1 FROM domains  WHERE domains.user_id  = users.id)
   AND NOT EXISTS (SELECT 1 FROM sources WHERE sources.user_id = users.id)
   AND NOT EXISTS (SELECT 1 FROM posts   WHERE posts.user_id   = users.id);

-- 2. Point founder row at the real email.
UPDATE users SET email = 'anshdwiv5@gmail.com' WHERE id = 1;

-- 3. Clear Google link on id=1 so founder adoption runs on next sign-in.
UPDATE users SET google_sub = NULL, name = NULL, picture = NULL WHERE id = 1;
