#!/bin/sh
# Generate runtime ports for direct-prod (not baked into the Vite bundle).
set -eu

BACKEND_PORT="${BACKEND_HTTP_PORT:-8000}"
TILE_PORT="${TILESERVER_HTTP_PORT:-8080}"

cat > /app/dist/runtime-config.js <<EOF
window.__INFOLAKE_CONFIG__ = {
  directMode: true,
  backendPort: "${BACKEND_PORT}",
  tileserverPort: "${TILE_PORT}"
};
EOF

exec serve -s dist -l 5173
