-- v2: flush the "(raw) …" disguised-failure TLDRs so the worker treats them
-- as missing on the next regenerate-tldrs run. Safe to re-run.
UPDATE posts SET tldr = NULL WHERE tldr LIKE '(raw)%';
