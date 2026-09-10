# Nginx instructions

## Routing contract

- `dev.conf` is mounted by the base Compose stack and proxies Vite at `/`, Django at `/api/` and `/admin/`, and TileServer GL at `/tiles/`; it serves `/media/` and `/static/` from mounted backend directories.
- Production uses the parallel routing configuration in `../frontend/deploy/nginx.prod.conf`, with the built SPA served via `try_files`. Shared proxy or upload-limit changes normally need review in both files. Direct mode bypasses Nginx and must remain a supported separate path.
- Preserve `/tiles/` prefix stripping and `X-Forwarded-Path: /tiles`; frontend TileServer URL normalization and TileServer-generated style URLs rely on that public route.
- Preserve forwarded host/protocol/client headers for backend and TileServer routes. `/api/` and `/admin/` have longer read timeouts for reports/uploads; the 100 MB client limit corresponds to backend upload limits.

## Docker behavior and verification

- Docker upstreams are `backend:8000`, `tileserver:8080`, and, in development only, `frontend:5173`. These names are valid inside the Compose network only.
- The variable-based `proxy_pass` plus Docker resolver `127.0.0.11` is deliberate: it lets Nginx recover when an upstream container restarts with a new IP. Keep short connect timeouts and do not replace this with startup-only DNS resolution without testing restart recovery.
- Tile access logging is disabled deliberately because map navigation generates high request volume. Do not enable it permanently without considering Docker log growth.
- Validate the selected Compose merge with `docker compose ... config --quiet`. When an Nginx container/config is available, run `nginx -t` inside that container and smoke-test `/`, `/api/v1/`, `/admin/`, `/tiles/styles/infolake-unified/style.json`, `/media/`, and `/static/` as relevant.
