# Подготовка релиза с палитрами маркеров (машина С интернетом).
param(
    [string]$ProjectRoot = "",
    [switch]$SkipOfflineExport
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path }
Set-Location $ProjectRoot

$required = @(
    "backend\formular\migrations\0052_marker_color_palette.py",
    "backend\formular\models.py",
    "frontend\src\utils\markerPalette.js",
    "frontend\src\components\MapComponent\MapComponent.css"
)
foreach ($rel in $required) {
    $full = Join-Path $ProjectRoot $rel
    if (-not (Test-Path $full)) {
        Write-Host "Отсутствует обязательный файл: $rel" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK  $rel" -ForegroundColor Green
}

Write-Host "`n=== Тесты API палитр (Docker) ===" -ForegroundColor Cyan
docker compose run --rm --entrypoint python backend manage.py test api.tests.test_marker_color_palettes --verbosity=1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Тесты не прошли — не собирайте оффлайн-пакет." -ForegroundColor Red
    exit $LASTEXITCODE
}

if (-not $SkipOfflineExport) {
    Write-Host "`n=== export-offline.ps1 ===" -ForegroundColor Cyan
    & (Join-Path $ProjectRoot "export-offline.ps1")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`n=== Что перенести на оффлайн (палитры) ===" -ForegroundColor Yellow
@(
    "infolake_full_offline.tar",
    "backend/formular/migrations/0052_marker_color_palette.py",
    "backend/formular/management/commands/verify_marker_palette_migration.py",
    "backend/formular/management/commands/export_marker_palettes.py",
    "scripts/offline/*.ps1",
    "OFFLINE_MIGRATION_MARKER_PALETTES.md"
) | ForEach-Object { Write-Host "  - $_" }

Write-Host "`nНа оффлайн-сервере: import-and-start.ps1 → scripts\offline\apply-marker-palette-migration.ps1" -ForegroundColor Green
