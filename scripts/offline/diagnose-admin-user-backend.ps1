# Диагностика: «фронт не получает данные» после сохранения пользователя в /admin/
# Запуск на офлайн-сервере при воспроизведении проблемы.
param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path }
Set-Location $ProjectRoot

Write-Host "=== Backend process (DJANGO_SERVER) ===" -ForegroundColor Cyan
docker compose exec -T backend sh -c 'echo DJANGO_SERVER=${DJANGO_SERVER:-gunicorn}'

Write-Host "`n=== Last 80 lines backend log ===" -ForegroundColor Cyan
docker compose logs backend --tail 80

Write-Host "`n=== Quick API probe ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  API unreachable: $_" -ForegroundColor Red
}

Write-Host @"

Manual repro:
  1. Open map (Network tab) + Django admin Add user in parallel.
  2. If requests stay Pending until admin Save completes -> runserver --nothreading (fixed by gunicorn).
  3. If Connection refused after Save -> check log for StatReloader / traceback.

See backend/docs/ADMIN_USER_STABILITY.md
"@ -ForegroundColor Yellow
