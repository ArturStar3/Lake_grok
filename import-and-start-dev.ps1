# Импорт DEV Docker-образов и запуск dev-стека на оффлайн-машине.
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

Write-Host "Loading DEV images from: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nLoaded images:" -ForegroundColor DarkGray
docker images --format "  {{.Repository}}:{{.Tag}}" | Select-String -Pattern "infolake-|nginx:1.27|maptiler/tileserver"

Write-Host "`nStarting containers (offline DEV, no build, no pull)..." -ForegroundColor Cyan
docker compose --profile dev up -d --no-build --pull never
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStatus:" -ForegroundColor Green
docker compose --profile dev ps

Write-Host "`nURLs (on this machine):"
$nginxPort = if ($env:NGINX_HTTP_PORT) { $env:NGINX_HTTP_PORT } else { "80" }
if (Test-Path (Join-Path $PSScriptRoot ".env")) {
    $envLine = Get-Content (Join-Path $PSScriptRoot ".env") | Where-Object { $_ -match '^\s*NGINX_HTTP_PORT\s*=' } | Select-Object -First 1
    if ($envLine -match '=\s*(\d+)') { $nginxPort = $Matches[1] }
}
$baseUrl = if ($nginxPort -eq "80") { "http://localhost" } else { "http://localhost:$nginxPort" }
Write-Host "  App (nginx -> Vite): $baseUrl/"
Write-Host "  API:                 $baseUrl/api/v1/"
Write-Host "`nSee OFFLINE_DEPLOY_DEV.md"
