# Применение миграций Django и проверка палитр маркеров (оффлайн-сервер).
# Требует запущенный контейнер backend (docker compose up).
param(
    [string]$ProjectRoot = "",
    [switch]$SkipBackupHint,
    [switch]$ExpectSeedPalettes
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path }
Set-Location $ProjectRoot

$migrationFile = Join-Path $ProjectRoot "backend\formular\migrations\0052_marker_color_palette.py"
if (-not (Test-Path $migrationFile)) {
    Write-Host "Нет файла 0052_marker_color_palette.py — скопируйте актуальный код проекта с машины сборки." -ForegroundColor Red
    exit 1
}

if (-not $SkipBackupHint) {
    Write-Host "Рекомендуется сначала: .\scripts\offline\backup-postgres-before-migrate.ps1" -ForegroundColor Yellow
}

Write-Host "=== migrate ===" -ForegroundColor Cyan
docker compose exec -T backend python manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== verify_marker_palette_migration ===" -ForegroundColor Cyan
$verifyArgs = @("compose", "exec", "-T", "backend", "python", "manage.py", "verify_marker_palette_migration", "--min-palettes", "5")
if ($ExpectSeedPalettes) {
    $verifyArgs += "--expect-seed-palettes"
}
docker @verifyArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== export snapshot (audit) ===" -ForegroundColor Cyan
$exportDir = Join-Path $ProjectRoot "backups"
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
$exportName = "marker_palettes_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
docker compose exec -T backend python manage.py export_marker_palettes -o "/app/media/$exportName"
if ($LASTEXITCODE -eq 0) {
    $hostPath = Join-Path $ProjectRoot "backend\media\$exportName"
    if (Test-Path $hostPath) {
        Copy-Item -Force $hostPath (Join-Path $exportDir $exportName)
        Write-Host "Копия экспорта: backups\$exportName" -ForegroundColor Green
    }
}

Write-Host "`nДальше:" -ForegroundColor Green
Write-Host "  1. Обновите страницу карты (Ctrl+F5)."
Write-Host "  2. Админка: Формуляр → Палитры маркеров / Страны → Палитра маркера."
Write-Host "  3. См. OFFLINE_MIGRATION_MARKER_PALETTES.md"
