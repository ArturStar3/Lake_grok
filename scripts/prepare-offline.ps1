#Requires -Version 5.1
<#
.SYNOPSIS
  Подготовка InfoLake к переносу на офлайн-сервер.

.DESCRIPTION
  1. npm ci + копирование Leaflet-иконок
  2. pip download wheels для backend
  3. docker pull + docker compose build
  4. docker save в offline/infolake_full_offline.tar

  Запускать ТОЛЬКО на машине с интернетом.
#>
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== InfoLake: подготовка офлайн-пакета ===" -ForegroundColor Cyan

# --- Frontend ---
Write-Host "`n[1/4] Frontend: npm ci + vendor assets..." -ForegroundColor Yellow
Push-Location frontend
if (-not (Test-Path package-lock.json)) {
    throw "package-lock.json не найден. Запустите npm install в frontend."
}
npm ci
Pop-Location
node (Join-Path $PSScriptRoot "copy-vendor-assets.mjs")

# --- Python wheels ---
Write-Host "`n[2/4] Backend: pip download..." -ForegroundColor Yellow
$wheelsDir = Join-Path $Root "offline\python-wheels"
New-Item -ItemType Directory -Force -Path $wheelsDir | Out-Null
python -m pip download -r (Join-Path $Root "backend\requirements.txt") -d $wheelsDir

# --- Docker ---
Write-Host "`n[3/4] Docker: pull tileserver + compose build..." -ForegroundColor Yellow
docker pull maptiler/tileserver-gl:latest
docker compose build

# --- Export ---
Write-Host "`n[4/4] Docker: save images..." -ForegroundColor Yellow
$offlineDir = Join-Path $Root "offline"
New-Item -ItemType Directory -Force -Path $offlineDir | Out-Null
$tarPath = Join-Path $offlineDir "infolake_full_offline.tar"

$images = @(
    "maptiler/tileserver-gl:latest",
    "infolake-backend:latest",
    "infolake-frontend:latest"
)

docker save -o $tarPath @images

$tarSizeMb = [math]::Round((Get-Item $tarPath).Length / 1MB, 1)
Write-Host "`nГотово." -ForegroundColor Green
Write-Host "  Архив образов: $tarPath ($tarSizeMb MB)"
Write-Host "  Python wheels: $wheelsDir"
Write-Host "  Leaflet icons: frontend\public\leaflet\"
Write-Host "`nНа офлайн-машине: docker load -i offline\infolake_full_offline.tar && docker compose up -d --no-build"
