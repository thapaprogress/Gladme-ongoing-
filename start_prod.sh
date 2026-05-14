#!/usr/bin/env bash
# GladME Studio V5 — Production start script
set -e

echo "========================================"
echo "  GladME Studio V5 — Production Mode"
echo "========================================"

cd "$(dirname "$0")"

# Build frontend if dist missing
if [ ! -d "frontend/dist" ]; then
  echo "[BUILD] Building frontend..."
  (cd frontend && npm ci && npm run build)
fi

# Check .env
if [ ! -f "backend/.env" ]; then
  echo "[WARN] No .env found. Copying from .env.example..."
  cp backend/.env.example backend/.env
  echo "[!] Edit backend/.env — set JWT_SECRET and API keys before deploying!"
  exit 1
fi

# Install deps if venv missing
if [ ! -d "backend/venv" ]; then
  echo "[SETUP] Creating venv + installing deps..."
  python -m venv backend/venv
  backend/venv/bin/pip install -r backend/requirements.txt
fi

export FRONTEND_DIST="$(pwd)/frontend/dist"

echo "[START] Launching uvicorn with 4 workers on 0.0.0.0:8000"
echo "  FRONTEND_DIST=$FRONTEND_DIST"
echo "  Open: http://localhost:8000"

exec backend/venv/bin/uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --proxy-headers \
  --forwarded-allow-ips "*" \
  --timeout-keep-alive 30 \
  --access-log -