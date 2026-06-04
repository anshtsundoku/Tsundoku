#!/usr/bin/env bash
#
# Frontend deploy for Tsundoku.
#
# The frontend ships to Cloudflare Pages, which auto-builds on every push to
# main (it runs the frontend "build" npm script). So "deploy the frontend" =
# build locally, sanity-check the generated extension zip, then git push.
#
# The worker deploys separately and is NOT handled here:
#   cd cloudflare/worker && npm run deploy
#
set -euo pipefail

cd "$(dirname "$0")"

echo "building frontend..."
(cd cloudflare/frontend && npm run build)

# Sanity-check the bundled extension zip before we push. Pages serves whatever
# the build produced; a corrupt/missing zip here means a corrupt download live.
echo "verifying extension zip..."
ZIP_PATH="cloudflare/frontend/public/tsundoku-extension.zip"
if [ ! -f "$ZIP_PATH" ]; then echo "ERROR: extension zip not built"; exit 1; fi
if ! unzip -tq "$ZIP_PATH" >/dev/null 2>&1; then echo "ERROR: extension zip is corrupted"; exit 1; fi
SIZE=$(stat -f%z "$ZIP_PATH" 2>/dev/null || stat -c%s "$ZIP_PATH")
if [ "$SIZE" -lt 1000 ]; then echo "ERROR: extension zip suspiciously small ($SIZE bytes)"; exit 1; fi
echo "  ok — $SIZE bytes, valid zip"

# Frontend deploy = push to main; Cloudflare Pages rebuilds and goes live.
echo "pushing to main (Cloudflare Pages will rebuild)..."
git push origin main

echo "done."
