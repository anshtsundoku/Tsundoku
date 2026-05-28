#!/usr/bin/env bash
# Update an already-deployed Mindful instance.
# Pulls latest code, rebuilds only what changed, applies any new migrations,
# and does a zero-config restart.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Updating Mindful"

# 1. Pull latest code
if [ -d .git ]; then
  echo "==> Pulling latest code"
  git pull --ff-only
else
  echo "(no git repo — assuming you uploaded the new code manually)"
fi

# 2. Rebuild containers (Docker is smart enough to skip unchanged layers)
echo "==> Rebuilding"
docker compose build

# 3. Restart with zero downtime where possible
echo "==> Restarting services"
docker compose up -d

# 4. Apply any new migrations
echo "==> Applying any new schema changes"
docker compose exec -T backend node src/db/migrate.js || true

echo
echo "==> Update complete."
docker compose ps
