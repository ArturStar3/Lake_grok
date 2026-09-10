# InfoLake repository instructions

## Project shape

- InfoLake is an offline-deployable full-stack application. `backend/` is Django/DRF, `frontend/` is a JavaScript React/Vite SPA, `tileserver/` contains TileServer GL configuration and local map resources, and `nginx/` contains the development reverse proxy. Production Nginx configuration lives under `frontend/deploy/`.
- The normal proxied request flow is browser -> Nginx -> the frontend at `/`, Django at `/api/` and `/admin/`, and TileServer GL at `/tiles/`. `docker-compose.direct.yml` deliberately bypasses Nginx and exposes the three services on separate host ports.
- PostgreSQL is the application database. The base Compose file expects a host database; `docker-compose.postgres.yml` adds the `postgres` service and changes the backend host to that Docker service.
- `converter/` is a small standalone Tkinter/openpyxl coordinate converter. `docs/`, `scripts/`, and the `OFFLINE_*.md` files support deployment and operations; do not treat them as application packages.

## Hard constraints

- Preserve offline deployment. Runtime application, fonts, sprites, glyphs, tiles, and images must not gain CDN, cloud-map, or other Internet dependencies. Online-only preparation/download scripts may use the network, but offline startup must continue to use prebuilt images with `--no-build --pull never`.
- Keep browser URLs distinct from Docker DNS names. `backend`, `tileserver`, and `frontend` are container-only names; browser code uses same-origin paths or the current browser hostname plus direct-mode ports.
- Treat API paths, serialized fields, map style/layer IDs, media paths, and data-exchange bundle formats as compatibility surfaces. Coordinate cross-component changes and preserve backward compatibility unless the task explicitly changes a contract.
- Do not modify large, binary, generated, vendored, or machine-local artifacts unless the task requires them. This includes `*.mbtiles`, offline `*.tar` archives, vendored wheels under `offline/`, `frontend/node_modules/`, `frontend/dist/`, `backend/staticfiles/`, uploaded `media/`, spreadsheets, and Synology metadata. Follow `.gitignore` and do not assume every vendored artifact is ignored.

## Working safely

- Inspect `git status` before and after work and review `git diff` before finishing. Preserve unrelated modified/untracked files, avoid unrelated formatting, and never delete or revert user work.
- Keep secrets in ignored `.env` files. Do not print or commit their values. When a required setting changes, update the applicable template (`.env.example` and/or `backend/.env.example`) without real credentials.
- Pin dependency changes in the existing manifests and lockfiles: `backend/requirements.txt` for Python and both `frontend/package.json` and `frontend/package-lock.json` for npm. Do not add a library when the existing stack already solves the problem.
- Model/schema changes require reviewed Django migrations. Do not run destructive migrations, flush databases, remove volumes, or overwrite offline data unless explicitly requested; arrange a backup for production data changes.
- Diagnose from the narrowest layer first: browser URL/runtime config, Nginx route, service health/logs, then application code. Report unavailable infrastructure instead of claiming a check passed.

## Verification

- Backend, from `backend/`: `python manage.py check`; targeted `python manage.py test <app-or-test-label>`; full `python manage.py test`. Tests switch to in-memory SQLite and disable migrations in `infolake/settings.py`.
- Frontend, from `frontend/`: `npm run lint` and `npm run build`. There is no frontend test script.
- Map style generation, from `frontend/`: `npm run build:map-style`. This rewrites both `tileserver/styles/infolake-unified.json` and `frontend/src/config/unifiedLayerMapping.json`; run it only when relevant and review both outputs.
- Validate a Compose mode with its exact overlays, for example `docker compose -f docker-compose.yml -f docker-compose.server.yml config --quiet`, before starting it. Production offline startup is `docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never`; the PostgreSQL variant also includes `-f docker-compose.postgres.yml`.
- Do not claim a check passed unless it was executed. For Markdown-only changes, path/command validation and diff review are sufficient; do not start services solely to validate prose.

## Local instructions

- Backend work: `backend/AGENTS.md`
- Frontend work: `frontend/AGENTS.md`
- Tile/style work: `tileserver/AGENTS.md`
- Nginx work: `nginx/AGENTS.md` (also inspect `frontend/deploy/`)

For operational details, prefer the existing `PRODUCTION_LAUNCH.md`, `OFFLINE_MIGRATION.md`, `OFFLINE_DIAGNOSTICS.md`, and mode-specific `OFFLINE_DEPLOY_*.md` documents over duplicating them here.
