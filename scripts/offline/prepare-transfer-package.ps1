# Собирает папку для переноса на офлайн-сервер (USB / сеть).
#   .\scripts\offline\prepare-transfer-package.ps1
#   .\scripts\offline\prepare-transfer-package.ps1 -Postgres
param(
    [string]$OutputDir = "",
    [string]$ServerIp = "172.16.80.207",
    [string]$NginxPort = "80",
    [switch]$Postgres,
    [switch]$IncludeMapMbtiles,
    [switch]$IncludeMedia
)

function Write-Utf8File {
    param([string]$Path, [string]$Content)
    $utf8Bom = New-Object System.Text.UTF8Encoding $true
    [System.IO.File]::WriteAllText($Path, $Content.TrimEnd() + "`r`n", $utf8Bom)
}

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

$modeSuffix = if ($Postgres) { "prod_postgres" } else { "prod" }
$tarName = "infolake_full_offline_$modeSuffix.tar"
$manifestName = "offline-package-manifest-$modeSuffix.txt"

if (-not $OutputDir) {
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $OutputDir = Join-Path $ProjectRoot "dist\offline-transfer_${modeSuffix}_$stamp"
}
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$tarStable = Join-Path $ProjectRoot $tarName
if (-not (Test-Path $tarStable)) {
    if (-not $Postgres) {
        $legacy = Join-Path $ProjectRoot "infolake_full_offline.tar"
        if (Test-Path $legacy) { $tarStable = $legacy }
    }
}
if (-not (Test-Path $tarStable)) {
    $hint = if ($Postgres) { ".\export-offline.ps1 -Postgres" } else { ".\export-offline.ps1" }
    throw "Archive $tarName not found. Run $hint first."
}

$modeLabel = if ($Postgres) {
    "PRODUCTION + PostgreSQL 17 in Docker"
} else {
    "PRODUCTION (PostgreSQL on host)"
}

Write-Host "=== InfoLake transfer package ($modeLabel) ===" -ForegroundColor Cyan
Write-Host "Output: $OutputDir"

Copy-Item -Force $tarStable (Join-Path $OutputDir $tarName)
if (Test-Path $manifestName) {
    Copy-Item -Force $manifestName $OutputDir
} elseif (-not $Postgres -and (Test-Path "offline-package-manifest.txt")) {
    Copy-Item -Force "offline-package-manifest.txt" $OutputDir
}

$docs = @(
    "OFFLINE_DEPLOY_PROD.md",
    "OFFLINE_DEPLOY_PROD_POSTGRES.md",
    "OFFLINE_MIGRATION.md",
    "OFFLINE_DIAGNOSTICS.md"
)
foreach ($doc in $docs) {
    $docPath = Join-Path $ProjectRoot $doc
    if (Test-Path $docPath) {
        Copy-Item -Force $docPath $OutputDir
    }
}

$codeZip = Join-Path $OutputDir "Lake_grok_code.zip"
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Archiving branch $branch -> Lake_grok_code.zip" -ForegroundColor DarkGray
git archive --format=zip --prefix=Lake_grok/ --output=$codeZip HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }

$dbPassword = "change_me"
$srcEnv = Join-Path $ProjectRoot "backend\.env"
$envTemplate = Join-Path $ProjectRoot "backend\.env.example"
if (Test-Path $srcEnv) {
    $envText = [System.IO.File]::ReadAllText($srcEnv)
} elseif (Test-Path $envTemplate) {
    $envText = [System.IO.File]::ReadAllText($envTemplate)
} else {
    throw "backend/.env or backend/.env.example not found"
}
if ($envText -match '(?m)^DB_PASSWORD=(.*)$') {
    $extracted = $Matches[1].Trim()
    if ($extracted) { $dbPassword = $extracted }
}

if ($Postgres) {
    $rootEnv = @"
# Nginx port on the offline server (80, or 8080 if 80 is busy)
NGINX_HTTP_PORT=$NginxPort

# PostgreSQL 17 in Docker (must match backend/.env)
POSTGRES_DB=infolake_db
POSTGRES_USER=infolake
POSTGRES_PASSWORD=$dbPassword
POSTGRES_HOST_PORT=5431
"@
} else {
    $rootEnv = @"
# Nginx port on the offline server (80, or 8080 if 80 is busy)
NGINX_HTTP_PORT=$NginxPort
"@
}
Write-Utf8File (Join-Path $OutputDir ".env") $rootEnv

$backendEnvDir = Join-Path $OutputDir "backend"
New-Item -ItemType Directory -Force -Path $backendEnvDir | Out-Null

$envText = $envText -replace '(?m)^DB_HOST=.*$', 'DB_HOST=host.docker.internal'
if ($envText -notmatch '(?m)^DB_HOST=') {
    $envText += "`nDB_HOST=host.docker.internal"
}
$envText = $envText -replace '(?m)^ALLOWED_HOSTS=.*$', "ALLOWED_HOSTS=localhost,127.0.0.1,$ServerIp"
$envText = $envText -replace '(?m)^CORS_ALLOWED_ORIGINS=.*$', "CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://$ServerIp"
$portSuffix = if ($NginxPort -eq "80") { "" } else { ":$NginxPort" }
$envText = $envText -replace '(?m)^FRONTEND_URL=.*$', "FRONTEND_URL=http://${ServerIp}${portSuffix}"
if ($envText -notmatch '(?m)^DEBUG=') {
    $envText += "`nDEBUG=False"
} else {
    $envText = $envText -replace '(?m)^DEBUG=.*$', 'DEBUG=False'
}
Write-Utf8File (Join-Path $backendEnvDir ".env") $envText

$mapSrc = Join-Path $ProjectRoot "tileserver\data\map.mbtiles"
if ($IncludeMapMbtiles) {
    if (-not (Test-Path $mapSrc)) { throw "map.mbtiles not found: $mapSrc" }
    $mapDestDir = Join-Path $OutputDir "tileserver\data"
    New-Item -ItemType Directory -Force -Path $mapDestDir | Out-Null
    Write-Host "Copying map.mbtiles (this may take a while)..." -ForegroundColor Yellow
    Copy-Item -Force $mapSrc (Join-Path $mapDestDir "map.mbtiles")
}

if ($IncludeMedia) {
    $mediaSrc = Join-Path $ProjectRoot "backend\media"
    if (Test-Path $mediaSrc) {
        Write-Host "Copying backend/media..." -ForegroundColor Yellow
        Copy-Item -Recurse -Force $mediaSrc (Join-Path $OutputDir "backend\media")
    }
}

if ($Postgres) {
    $deployScript = @'
# Run on the OFFLINE server after copying this folder.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$zip = Join-Path $here "Lake_grok_code.zip"
$projectDir = Join-Path $here "Lake_grok"
if (-not (Test-Path $projectDir)) {
    Expand-Archive -Path $zip -DestinationPath $here -Force
}
if (-not (Test-Path $projectDir)) {
    throw "Lake_grok folder not found after unzip"
}
Set-Location $projectDir

$parent = Split-Path $projectDir -Parent
foreach ($name in @("infolake_full_offline_prod_postgres.tar", ".env", "offline-package-manifest-prod_postgres.txt")) {
    $src = Join-Path $parent $name
    if (Test-Path $src) { Copy-Item -Force $src (Join-Path $projectDir $name) }
}
$backendEnvSrc = Join-Path $parent "backend\.env"
if (Test-Path $backendEnvSrc) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectDir "backend") | Out-Null
    Copy-Item -Force $backendEnvSrc (Join-Path $projectDir "backend\.env")
}
$mapSrc = Join-Path $parent "tileserver\data\map.mbtiles"
if (Test-Path $mapSrc) {
    $mapDest = Join-Path $projectDir "tileserver\data"
    New-Item -ItemType Directory -Force -Path $mapDest | Out-Null
    if (-not (Test-Path (Join-Path $mapDest "map.mbtiles"))) {
        Copy-Item -Force $mapSrc (Join-Path $mapDest "map.mbtiles")
    }
}
$mediaSrc = Join-Path $parent "backend\media"
if (Test-Path $mediaSrc) {
    Copy-Item -Recurse -Force $mediaSrc (Join-Path $projectDir "backend\media")
}

.\import-and-start-postgres.ps1

Write-Host "`nCheck (use the server IP):" -ForegroundColor Green
Write-Host "  docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml ps"
Write-Host "  docker compose exec backend python manage.py createsuperuser"
Write-Host "  Guide: OFFLINE_DEPLOY_PROD_POSTGRES.md"
'@
} else {
    $deployScript = @'
# Run on the OFFLINE server after copying this folder.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$zip = Join-Path $here "Lake_grok_code.zip"
$projectDir = Join-Path $here "Lake_grok"
if (-not (Test-Path $projectDir)) {
    Expand-Archive -Path $zip -DestinationPath $here -Force
}
if (-not (Test-Path $projectDir)) {
    throw "Lake_grok folder not found after unzip"
}
Set-Location $projectDir

$parent = Split-Path $projectDir -Parent
foreach ($name in @("infolake_full_offline_prod.tar", "infolake_full_offline.tar", ".env", "offline-package-manifest-prod.txt", "offline-package-manifest.txt")) {
    $src = Join-Path $parent $name
    if (Test-Path $src) { Copy-Item -Force $src (Join-Path $projectDir $name) }
}
$backendEnvSrc = Join-Path $parent "backend\.env"
if (Test-Path $backendEnvSrc) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectDir "backend") | Out-Null
    Copy-Item -Force $backendEnvSrc (Join-Path $projectDir "backend\.env")
}
$mapSrc = Join-Path $parent "tileserver\data\map.mbtiles"
if (Test-Path $mapSrc) {
    $mapDest = Join-Path $projectDir "tileserver\data"
    New-Item -ItemType Directory -Force -Path $mapDest | Out-Null
    if (-not (Test-Path (Join-Path $mapDest "map.mbtiles"))) {
        Copy-Item -Force $mapSrc (Join-Path $mapDest "map.mbtiles")
    }
}
$mediaSrc = Join-Path $parent "backend\media"
if (Test-Path $mediaSrc) {
    Copy-Item -Recurse -Force $mediaSrc (Join-Path $projectDir "backend\media")
}

.\import-and-start.ps1

Write-Host "`nCheck (use the server IP):" -ForegroundColor Green
Write-Host "  docker compose -f docker-compose.yml -f docker-compose.server.yml ps"
Write-Host "  docker compose exec backend python manage.py createsuperuser"
Write-Host "  Guide: OFFLINE_DEPLOY_PROD.md"
'@
}
Write-Utf8File (Join-Path $OutputDir "DEPLOY_ON_TARGET.ps1") $deployScript

$pgNote = if ($Postgres) {
    "Mode: $modeLabel. Host PostgreSQL is NOT required. POSTGRES_PASSWORD in root .env must match DB_PASSWORD in backend/.env."
} else {
    "Mode: $modeLabel. Install PostgreSQL on the host and create the DB/user (see OFFLINE_DEPLOY_PROD.md)."
}
$mapNote = if ($IncludeMapMbtiles) {
    "map.mbtiles is included (tileserver/data/)."
} else {
    "map.mbtiles (~70 GB) is NOT in this package. Copy separately to tileserver/data/map.mbtiles"
}
$guideName = if ($Postgres) { "OFFLINE_DEPLOY_PROD_POSTGRES.md" } else { "OFFLINE_DEPLOY_PROD.md" }
$pgEnvNote = if ($Postgres) { ", POSTGRES_*" } else { "" }

$readme = @"
InfoLake offline transfer package
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Branch: $branch
Mode: $modeLabel
Server IP: $ServerIp
Nginx port: $NginxPort

$pgNote

Contents:
  $tarName                 - Docker images
  Lake_grok_code.zip             - project code (branch $branch)
  backend/.env                   - settings for the target server
  .env                           - NGINX_HTTP_PORT=$NginxPort$pgEnvNote
  DEPLOY_ON_TARGET.ps1           - deploy script for the offline machine
  $guideName

$mapNote

On the offline server:
  1. Install Docker Desktop and wait until status is Running
  2. Copy this entire folder to disk
  3. PowerShell: .\DEPLOY_ON_TARGET.ps1
  4. Optional: docker compose exec backend python manage.py createsuperuser

NEVER on the offline machine: docker compose build, docker pull, docker compose up --build
"@
Write-Utf8File (Join-Path $OutputDir "README_TRANSFER.txt") $readme

$tarOut = Join-Path $OutputDir $tarName
$tarSize = [math]::Round((Get-Item $tarOut).Length / 1GB, 2)
Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Folder: $OutputDir"
Write-Host "  Tar:    ${tarSize} GB"
Write-Host "  Next:   copy folder to offline server, run DEPLOY_ON_TARGET.ps1"
Write-Host "  Guide:  $guideName"
