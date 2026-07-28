# Собирает папку для переноса на офлайн-сервер (USB / сеть).
param(
    [string]$OutputDir = "",
    [string]$ServerIp = "172.16.80.207",
    [string]$NginxPort = "80",
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

if (-not $OutputDir) {
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $OutputDir = Join-Path $ProjectRoot "dist\offline-transfer_$stamp"
}
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$tarStable = Join-Path $ProjectRoot "infolake_full_offline.tar"
if (-not (Test-Path $tarStable)) {
    throw "Не найден infolake_full_offline.tar. Сначала выполните .\export-offline.ps1"
}

Write-Host "=== InfoLake transfer package ===" -ForegroundColor Cyan
Write-Host "Output: $OutputDir"

# Docker archive + manifest
Copy-Item -Force $tarStable (Join-Path $OutputDir "infolake_full_offline.tar")
if (Test-Path "offline-package-manifest.txt") {
    Copy-Item -Force "offline-package-manifest.txt" $OutputDir
}

# Project code via git archive (без .git, node_modules)
$codeZip = Join-Path $OutputDir "Lake_grok_code.zip"
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Archiving branch $branch -> Lake_grok_code.zip" -ForegroundColor DarkGray
git archive --format=zip --output=$codeZip HEAD

# Root .env for nginx port
$rootEnv = @"
# Порт nginx на офлайн-сервере (80 или 8080 если порт 80 занят)
NGINX_HTTP_PORT=$NginxPort
"@
Write-Utf8File (Join-Path $OutputDir ".env") $rootEnv

# backend/.env for target server
$backendEnvDir = Join-Path $OutputDir "backend"
New-Item -ItemType Directory -Force -Path $backendEnvDir | Out-Null

$srcEnv = Join-Path $ProjectRoot "backend\.env"
$envTemplate = Join-Path $ProjectRoot "backend\.env.example"
if (Test-Path $srcEnv) {
    $envText = [System.IO.File]::ReadAllText($srcEnv)
} elseif (Test-Path $envTemplate) {
    $envText = [System.IO.File]::ReadAllText($envTemplate)
} else {
    throw "Не найден backend/.env или backend/.env.example"
}

$envText = $envText -replace '(?m)^DB_HOST=.*$', 'DB_HOST=host.docker.internal'
if ($envText -notmatch '(?m)^DB_HOST=') {
    $envText += "`nDB_HOST=host.docker.internal"
}
$envText = $envText -replace '(?m)^ALLOWED_HOSTS=.*$', "ALLOWED_HOSTS=localhost,127.0.0.1,$ServerIp"
$envText = $envText -replace '(?m)^CORS_ALLOWED_ORIGINS=.*$', "CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://$ServerIp"
$portSuffix = if ($NginxPort -eq "80") { "" } else { ":$NginxPort" }
$envText = $envText -replace '(?m)^FRONTEND_URL=.*$', "FRONTEND_URL=http://${ServerIp}${portSuffix}"
Write-Utf8File (Join-Path $backendEnvDir ".env") $envText

# Optional large files
$mapSrc = Join-Path $ProjectRoot "tileserver\data\map.mbtiles"
if ($IncludeMapMbtiles) {
    if (-not (Test-Path $mapSrc)) { throw "map.mbtiles не найден: $mapSrc" }
    $mapDestDir = Join-Path $OutputDir "tileserver\data"
    New-Item -ItemType Directory -Force -Path $mapDestDir | Out-Null
    Write-Host "Copying map.mbtiles (может занять время)..." -ForegroundColor Yellow
    Copy-Item -Force $mapSrc (Join-Path $mapDestDir "map.mbtiles")
}

if ($IncludeMedia) {
    $mediaSrc = Join-Path $ProjectRoot "backend\media"
    if (Test-Path $mediaSrc) {
        Write-Host "Copying backend/media..." -ForegroundColor Yellow
        Copy-Item -Recurse -Force $mediaSrc (Join-Path $OutputDir "backend\media")
    }
}

# Deploy script for target machine
$deployScript = @'
# Запуск на ОФФЛАЙН-СЕРВЕРЕ после копирования папки.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Распаковать код
$zip = Join-Path $here "Lake_grok_code.zip"
$projectDir = Join-Path $here "Lake_grok"
if (-not (Test-Path $projectDir)) {
    Expand-Archive -Path $zip -DestinationPath $here -Force
    $expanded = Get-ChildItem $here -Directory | Where-Object { $_.Name -like "Lake_grok*" } | Select-Object -First 1
    if ($expanded -and $expanded.FullName -ne $projectDir) {
        Rename-Item $expanded.FullName "Lake_grok"
    }
}
Set-Location $projectDir

# 2. Скопировать tar, .env, media/map если лежат рядом
$parent = Split-Path $projectDir -Parent
foreach ($name in @("infolake_full_offline.tar", ".env", "offline-package-manifest.txt")) {
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

# 3. Запуск
.\import-and-start.ps1

Write-Host "`nПроверка (подставьте IP сервера):" -ForegroundColor Green
Write-Host "  docker compose -f docker-compose.yml -f docker-compose.server.yml ps"
Write-Host "  docker compose exec backend python manage.py createsuperuser"
'@
Write-Utf8File (Join-Path $OutputDir "DEPLOY_ON_TARGET.ps1") $deployScript

$readme = @"
InfoLake offline transfer package
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Branch: $branch
Server IP: $ServerIp
Nginx port: $NginxPort

Содержимое:
  infolake_full_offline.tar   - Docker-образы (~2.5 GB)
  Lake_grok_code.zip          - код проекта (ветка $branch)
  backend/.env                - настройки для целевого сервера
  .env                        - NGINX_HTTP_PORT=$NginxPort
  DEPLOY_ON_TARGET.ps1        - скрипт развёртывания на офлайн-машине

Если map.mbtiles не включён в пакет - скопируйте вручную:
  tileserver/data/map.mbtiles -> на офлайн-сервер

На офлайн-сервере:
  1. Скопируйте всю папку на диск
  2. PowerShell: .\DEPLOY_ON_TARGET.ps1
  3. createsuperuser (см. OFFLINE_MIGRATION.md)

НЕ запускать на офлайн-машине: docker compose build, docker pull
"@
Write-Utf8File (Join-Path $OutputDir "README_TRANSFER.txt") $readme

$tarSize = [math]::Round((Get-Item (Join-Path $OutputDir "infolake_full_offline.tar")).Length / 1GB, 2)
Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Folder: $OutputDir"
Write-Host "  Tar:    ${tarSize} GB"
Write-Host "  Next:   copy folder to offline server, run DEPLOY_ON_TARGET.ps1"
