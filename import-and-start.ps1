# import-and-start.ps1
# Импорт Docker-образов и запуск на оффлайн-машине (БЕЗ интернета).
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $TarFile) {
    if (Test-Path "infolake_full_offline.tar") {
        $TarFile = (Resolve-Path "infolake_full_offline.tar").Path
    } else {
        $TarFile = Get-ChildItem -Filter "infolake_full_offline_*.tar" |
                   Sort-Object LastWriteTime -Descending |
                   Select-Object -First 1 |
                   Select-Object -ExpandProperty FullName
    }
}

if (-not $TarFile -or -not (Test-Path $TarFile)) {
    Write-Host "Archive not found (infolake_full_offline.tar)" -ForegroundColor Red
    Write-Host "Copy infolake_full_offline.tar from the online build machine." -ForegroundColor Yellow
    exit 1
}

Write-Host "Loading images from: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nLoaded images:" -ForegroundColor DarkGray
docker images --format "  {{.Repository}}:{{.Tag}}" | Select-String -Pattern "infolake-|maptiler/tileserver"

Write-Host "`nStarting containers (offline: no build, no pull)..." -ForegroundColor Cyan
docker compose up -d --no-build --pull never
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStatus:" -ForegroundColor Green
docker compose ps

Write-Host "`nURLs (on this machine):"
Write-Host "  Frontend:   http://localhost:5173"
Write-Host "  Backend:    http://localhost:8000"
Write-Host "  TileServer: http://localhost:8080"
Write-Host "`nSee OFFLINE_MIGRATION.md for DB setup and verification."
