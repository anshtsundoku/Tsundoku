#!/usr/bin/env bash
# First-time deploy. Run on the VM after cloning/uploading the repo.
# Safe to re-run; only does what's needed.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Mindful first-time deploy"

# 1. Set up swap on small (1 GB) VMs so background spikes don't OOM-kill us.
TOTAL_MEM_MB=$(grep MemTotal /proc/meminfo | awk '{print int($2/1024)}')
if [ "$TOTAL_MEM_MB" -lt 2048 ] && [ ! -f /swapfile ]; then
  echo "==> Setting up 2 GB swap (recommended for hosts with <2 GB RAM)"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
  echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf >/dev/null
  sudo sysctl -p >/dev/null
fi

# 2. Install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker"
  sudo apt-get update -qq
  sudo apt-get install -y docker.io docker-compose-plugin git
  sudo usermod -aG docker "$USER"
  echo
  echo "Docker installed. Log out and back in (or run: newgrp docker), then re-run ./deploy.sh"
  exit 0
fi

# 3. Create .env if missing
if [ ! -f backend/.env ]; then
  echo "==> Creating backend/.env from example"
  cp backend/.env.example backend/.env
  echo
  echo "============================================================"
  echo "  Edit backend/.env now with your API keys, then re-run this"
  echo "  script. Required:"
  echo "    GEMINI_API_KEY     (https://aistudio.google.com/app/apikey)"
  echo "    YOUTUBE_API_KEY    (https://console.cloud.google.com)"
  echo "    IMAP_USER / IMAP_PASSWORD  (dedicated Gmail + App Password)"
  echo "============================================================"
  exit 0
fi

# 4. Build + start
echo "==> Building and starting the stack"
docker compose build
docker compose up -d

# 5. Wait for Postgres, then migrate
echo "==> Waiting for Postgres"
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U mindful >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "==> Applying database schema"
docker compose exec -T backend node src/db/migrate.js

# 6. Seed sample data on first run only
if [ ! -f .seeded ]; then
  echo "==> Seeding sample content (first run only)"
  docker compose exec -T backend node src/db/seed.js || true
  touch .seeded
fi

IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo
echo "==> Done."
echo "    Open:  http://${IP}/"
echo "    Logs:  make logs"
echo "    Stop:  make down"
echo
echo "To enable Twitter ingestion (uses ~600 MB extra RAM — needs >=2 GB host):"
echo "    COMPOSE_PROFILES=twitter docker compose up -d"
