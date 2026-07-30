# import-and-start.ps1
# Импорт Docker-образов и запуск на оффлайн-машине (БЕЗ интернета).
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $TarFile) {
    if (Test-Path "infolake_full_offline_prod.tar") {
        $TarFile = (Resolve-Path "infolake_full_offline_prod.tar").Path
    } elseif (Test-Path "infolake_full_offline.tar") {
        $TarFile = (Resolve-Path "infolake_full_offline.tar").Path
    } else {
        $TarFile = Get-ChildItem -Filter "infolake_full_offline_prod_*.tar" |
                   Sort-Object LastWriteTime -Descending |
                   Select-Object -First 1 |
                   Select-Object -ExpandProperty FullName
        if (-not $TarFile) {
            $TarFile = Get-ChildItem -Filter "infolake_full_offline_*.tar" |
                       Where-Object { $_.Name -notmatch '_dev' } |
                       Sort-Object LastWriteTime -Descending |
                       Select-Object -First 1 |
                       Select-Object -ExpandProperty FullName
        }
    }
}

if (-not $TarFile -or -not (Test-Path $TarFile)) {
    Write-Host "Archive not found (infolake_full_offline_prod.tar)" -ForegroundColor Red
    Write-Host "Copy infolake_full_offline_prod.tar from the online build machine." -ForegroundColor Yellow
    exit 1
}

Write-Host "Loading images from: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nLoaded images:" -ForegroundColor DarkGray
docker images --format "  {{.Repository}}:{{.Tag}}" | Select-String -Pattern "infolake-|maptiler/tileserver"

Write-Host "`nStarting containers (offline: production frontend, no build, no pull)..." -ForegroundColor Cyan
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStatus:" -ForegroundColor Green
docker compose -f docker-compose.yml -f docker-compose.server.yml ps

Write-Host "`nURLs (on this machine):"
$nginxPort = if ($env:NGINX_HTTP_PORT) { $env:NGINX_HTTP_PORT } else { "80" }
if (Test-Path (Join-Path $PSScriptRoot ".env")) {
    $envLine = Get-Content (Join-Path $PSScriptRoot ".env") | Where-Object { $_ -match '^\s*NGINX_HTTP_PORT\s*=' } | Select-Object -First 1
    if ($envLine -match '=\s*(\d+)') { $nginxPort = $Matches[1] }
}
$baseUrl = if ($nginxPort -eq "80") { "http://localhost" } else { "http://localhost:$nginxPort" }
Write-Host "  App (nginx): $baseUrl/"
Write-Host "  API:         $baseUrl/api/v1/"
Write-Host "  Admin:       $baseUrl/admin/"
Write-Host "  Tiles:       $baseUrl/tiles/"
Write-Host "`nSee OFFLINE_MIGRATION.md for DB setup and verification."
Write-Host "Marker palettes (0052): OFFLINE_MIGRATION_MARKER_PALETTES.md"
