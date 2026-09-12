# Backend instructions

## Stack and boundaries

- This subtree targets Python 3.12 in Docker and pins Django 6.0.6, Django REST Framework 3.17.1, Simple JWT, django-environ, django-unfold, PostgreSQL support, WhiteNoise, and report/geospatial dependencies in `requirements.txt`.
- `infolake/` holds settings and root URLs. Installed project apps are `accounts`, `formular`, `equipment`, `reports`, `data_exchange`, and `api`. Public API routes are under `/api/v1/`; Django admin is under `/admin/`.
- Authentication uses Django's user model plus `accounts.UserProfile`; the creation signal assigns active status to superusers and pending status otherwise. API authentication is JWT. Preserve the access model implemented in `accounts/permissions.py`, `accounts/services/permissions.py`, and `api/access.py`.

## Established patterns

- DRF routers and ViewSets are common, but purpose-built APIViews also exist. Follow the nearby endpoint rather than forcing one abstraction.
- Use the existing read/write serializer split and serializer validation where the surrounding resource does. Keep multi-model operations atomic and place substantial domain work in an existing or appropriately scoped service/helper module.
- Apply module permissions and country scoping consistently. Do not replace custom permissions with plain `IsAuthenticated`, leak disallowed-country objects, or change deliberate not-found-versus-forbidden behavior without reviewing access tests.
- Complex behavior is already separated into helpers/services, including target actions, operational-situation revisions, equipment zones/catalogs, reports, account workflows, and data exchange. Extend the relevant module instead of duplicating its rules in a view.
- Demonstration scenarios live in `formular` models and `api/demo_scenario_utils.py`. Keep frontend `src/utils/demoScenario.js` and this normalizer in sync for mosaic/tableau fields. Seed showcases are `formular/management/commands/seed_*_demo_scenario.py` (wired through `seed_demo_showcases`); demo fixtures sit under `formular/demo_assets/`. Unfold admin search is intentionally off (`unfold_settings.py` plus `templates/unfold/helpers/command.html`).
- Preserve Russian UI/admin text and existing API field names unless a product change requires otherwise.

## Data and files

- Normal runtime uses PostgreSQL configured through `backend/.env`; tests deliberately replace it with in-memory SQLite. Do not assume passing SQLite tests proves PostgreSQL-specific behavior.
- Create migrations for model changes and inspect generated operations. Never edit an applied migration merely to avoid creating a new one.
- Media includes user uploads and import staging data. Validate file paths, sizes, ownership, and cleanup behavior when changing upload/import/export code; do not commit local `media/` contents.
- The offline DEM is read from `DEM_DATA_DIR` (`/app/dem_data/glo-90` in Compose). Retain the existing flat-circle fallback when DEM data is unavailable unless the task changes that behavior.
- `docker-entrypoint.sh` runs migrations and `collectstatic`, then Gunicorn by default; `DJANGO_SERVER=runserver` is the development alternative. Avoid startup changes that require network access.

## Verification

- Run from `backend/`: `python manage.py check`.
- Run the narrowest relevant label first, such as `python manage.py test accounts.tests.test_auth_api`, then `python manage.py test` for broad backend changes.
- For model changes, also generate/review the migration and run the relevant tests. If local dependencies are unavailable, use an already-running `backend` service with `docker compose exec -T backend python manage.py ...` or report the limitation; do not start/rebuild production services just for a check.
- There is no pytest configuration; use Django's test runner. Authentication, country scoping, destructive permissions, operational revisions, map settings, equipment zones, data exchange, report, and demo-scenario changes need their corresponding regression coverage (`api.tests.test_demo_scenarios`, `formular.tests.test_seed_*`).
