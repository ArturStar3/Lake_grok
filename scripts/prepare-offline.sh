#!/usr/bin/env bash
# Подготовка InfoLake к переносу на офлайн-сервер.
# Запускать ТОЛЬКО на машине с интернетом.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== InfoLake: подготовка офлайн-пакета ==="

echo ""
echo "[1/4] Frontend: npm ci + vendor assets..."
cd frontend
npm ci
cd "$ROOT"
node scripts/copy-vendor-assets.mjs

echo ""
echo "[2/4] Backend: pip download..."
mkdir -p offline/python-wheels
python3 -m pip download -r backend/requirements.txt -d offline/python-wheels

echo ""
echo "[3/4] Docker: pull tileserver + compose build..."
docker pull maptiler/tileserver-gl:latest
docker compose build

echo ""
echo "[4/4] Docker: save images..."
mkdir -p offline
docker save -o offline/infolake_full_offline.tar \
  maptiler/tileserver-gl:latest \
  infolake-backend:latest \
  infolake-frontend:latest

echo ""
echo "Готово."
echo "  Архив образов: offline/infolake_full_offline.tar"
echo "  Python wheels: offline/python-wheels/"
echo "  Leaflet icons: frontend/public/leaflet/"
echo ""
echo "На офлайн-машине: docker load -i offline/infolake_full_offline.tar && docker compose up -d --no-build"
