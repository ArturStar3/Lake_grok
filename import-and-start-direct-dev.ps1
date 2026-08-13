# Импорт DEV-образов и запуск БЕЗ nginx (Vite на :5173).
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $TarFile) {
    if (Test-Path "infolake_full_offline_dev.tar") {
        $TarFile = (Resolve-Path "infolake_full_offline_dev.tar").Path
    } else {
        $TarFile = Get-ChildItem -Filter "infolake_full_offline_dev_*.tar" |
                   Sort-Object LastWriteTime -Descending |
                   Select-Object -First 1 |
                   Select-Object -ExpandProperty FullName
    }
}

if (-not $TarFile -or -not (Test-Path $TarFile)) {
    Write-Host "Archive not found (infolake_full_offline_dev.tar)" -ForegroundColor Red
    Write-Host "On online machine run: .\export-offline.ps1 -Dev" -ForegroundColor Yellow
    exit 1
}

Write-Host "Stopping nginx / other InfoLake stacks (port 5173/8000/8080)..." -ForegroundColor DarkGray
docker compose -f docker-compose.yml -f docker-compose.server.yml down 2>$null | Out-Null
docker compose --profile dev down 2>$null | Out-Null
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile direct-prod down 2>$null | Out-Null

Write-Host "Loading DEV images from: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nLoaded images:" -ForegroundColor DarkGray
docker images --format "  {{.Repository}}:{{.Tag}}" | Select-String -Pattern "infolake-|maptiler/tileserver"

Write-Host "`nStarting containers (offline DIRECT DEV, no nginx, no build, no pull)..." -ForegroundColor Cyan
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile dev up -d --no-build --pull never
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

function Get-DotEnvValue([string]$Name, [string]$Default) {
    $file = Join-Path $PSScriptRoot ".env"
    if (Test-Path $file) {
        $line = Get-Content $file | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
        if ($line -match '=\s*(.+)$') { return $Matches[1].Trim() }
    }
    return $Default
}

$uiPort = Get-DotEnvValue "FRONTEND_HTTP_PORT" "5173"
$apiPort = Get-DotEnvValue "BACKEND_HTTP_PORT" "8000"
$tilePort = Get-DotEnvValue "TILESERVER_HTTP_PORT" "8080"

Write-Host "`nStatus:" -ForegroundColor Green
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile dev ps

Write-Host "`nURLs (on this machine, no nginx):"
Write-Host "  App (Vite): http://localhost:$uiPort/"
Write-Host "  API:        http://localhost:$apiPort/api/v1/"
Write-Host "  Admin:      http://localhost:$apiPort/admin/"
Write-Host "  Tiles:      http://localhost:$tilePort/"
Write-Host "`nSee OFFLINE_DEPLOY_DIRECT.md"
