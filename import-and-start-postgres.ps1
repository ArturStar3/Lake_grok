# Импорт Docker-образов и запуск production с PostgreSQL 17 в Docker (БЕЗ интернета).
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$composeFiles = @(
    "-f", "docker-compose.yml",
    "-f", "docker-compose.server.yml",
    "-f", "docker-compose.postgres.yml"
)

if (-not $TarFile) {
    if (Test-Path "infolake_full_offline_prod_postgres.tar") {
        $TarFile = (Resolve-Path "infolake_full_offline_prod_postgres.tar").Path
    } else {
        $TarFile = Get-ChildItem -Filter "infolake_full_offline_prod_postgres_*.tar" |
                   Sort-Object LastWriteTime -Descending |
                   Select-Object -First 1 |
                   Select-Object -ExpandProperty FullName
    }
}

if (-not $TarFile -or -not (Test-Path $TarFile)) {
    Write-Host "Archive not found (infolake_full_offline_prod_postgres.tar)" -ForegroundColor Red
    Write-Host "On online machine run: .\export-offline.ps1 -Postgres" -ForegroundColor Yellow
    exit 1
}

# Bind mount PGDATA on Windows NTFS/drvfs breaks postgres initdb (chown/chmod 0700).
$rootEnvPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $rootEnvPath) {
    $pgDataLine = Get-Content $rootEnvPath |
        Where-Object { $_ -match '^\s*POSTGRES_DATA_DIR\s*=' } |
        Select-Object -First 1
    if ($pgDataLine -and $pgDataLine -match '^\s*POSTGRES_DATA_DIR\s*=\s*(.+)\s*$') {
        $pgDataDir = $Matches[1].Trim().Trim('"').Trim("'")
        if ($pgDataDir -and (
                $pgDataDir -match '^[A-Za-z]:' -or
                $pgDataDir.StartsWith('\\') -or
                $pgDataDir.StartsWith('//')
            )) {
            Write-Host "POSTGRES_DATA_DIR=$pgDataDir is a Windows path." -ForegroundColor Red
            Write-Host "Bind-mounting PGDATA on NTFS/drvfs fails: postgres needs chown/chmod 0700 (initdb: Operation not permitted / invalid permissions)." -ForegroundColor Red
            Write-Host "Comment out POSTGRES_DATA_DIR in .env (use named volume infolake_pgdata)." -ForegroundColor Yellow
            Write-Host "To put data on another drive (e.g. VeraCrypt Q:), move Docker Desktop Disk image location — see OFFLINE_DEPLOY_PROD_POSTGRES.md." -ForegroundColor Yellow
            exit 1
        }
    }
}

Write-Host "Stopping other InfoLake stacks (shared nginx/backend containers)..." -ForegroundColor DarkGray
docker compose -f docker-compose.yml -f docker-compose.server.yml down 2>$null | Out-Null
docker compose --profile dev down 2>$null | Out-Null
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile direct-prod down 2>$null | Out-Null
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile dev down 2>$null | Out-Null

Write-Host "Loading images from: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nLoaded images:" -ForegroundColor DarkGray
docker images --format "  {{.Repository}}:{{.Tag}}" | Select-String -Pattern "infolake-|maptiler/tileserver|postgres"

Write-Host "`nStarting containers (offline PROD + Postgres 17, no build, no pull)..." -ForegroundColor Cyan
docker compose @composeFiles up -d --no-build --pull never
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nStatus:" -ForegroundColor Green
docker compose @composeFiles ps

$nginxPort = if ($env:NGINX_HTTP_PORT) { $env:NGINX_HTTP_PORT } else { "80" }
if (Test-Path (Join-Path $PSScriptRoot ".env")) {
    $envLine = Get-Content (Join-Path $PSScriptRoot ".env") | Where-Object { $_ -match '^\s*NGINX_HTTP_PORT\s*=' } | Select-Object -First 1
    if ($envLine -match '=\s*(\d+)') { $nginxPort = $Matches[1] }
}
$baseUrl = if ($nginxPort -eq "80") { "http://localhost" } else { "http://localhost:$nginxPort" }
Write-Host "`nURLs (on this machine):"
Write-Host "  App (nginx): $baseUrl/"
Write-Host "  API:         $baseUrl/api/v1/"
Write-Host "  Admin:       $baseUrl/admin/"
Write-Host "  Tiles:       $baseUrl/tiles/"
Write-Host "`nPostgres is inside Docker (volume infolake_pgdata). Host PostgreSQL is not used."
Write-Host "To store Docker/Postgres data on another disk (e.g. Q:), set Docker Desktop Disk image location — see OFFLINE_DEPLOY_PROD_POSTGRES.md."
Write-Host "See OFFLINE_DEPLOY_PROD_POSTGRES.md"
