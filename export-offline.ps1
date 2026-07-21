# export-offline.ps1
# Сборка Docker-образов и экспорт в infolake_full_offline.tar (машина С интернетом).
param(
    [string]$OutputDir = ".",
    [switch]$NoCache,
    [switch]$SkipBuild,
    [switch]$SkipMapStyle
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Get-ComposeImages {
    $lines = Get-Content (Join-Path $PSScriptRoot "docker-compose.yml")
    $images = @()
    foreach ($line in $lines) {
        if ($line -match '^\s+image:\s+(\S+)') {
            $images += $Matches[1]
        }
    }
    return $images | Select-Object -Unique
}

function Test-DockerImage {
    param([string]$Image)
    docker image inspect $Image 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

if (-not $SkipMapStyle) {
    Write-Host "=== Building unified map style ===" -ForegroundColor Cyan
    Push-Location (Join-Path $PSScriptRoot "frontend")
    try {
        npm run build:map-style
    } finally {
        Pop-Location
    }
}

if (-not $SkipBuild) {
    Write-Host "`n=== Building Docker images ===" -ForegroundColor Cyan
    $buildArgs = @("compose", "build")
    if ($NoCache) { $buildArgs += "--no-cache" }
    docker @buildArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "`n=== Skip build (--SkipBuild) ===" -ForegroundColor DarkGray
}

$images = Get-ComposeImages
if (-not $images -or $images.Count -eq 0) {
    Write-Host "No images found in docker-compose.yml" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Verifying images locally ===" -ForegroundColor Cyan
$missing = @()
foreach ($img in $images) {
    if (Test-DockerImage $img) {
        Write-Host "  OK  $img" -ForegroundColor Green
    } else {
        Write-Host "  MISSING  $img" -ForegroundColor Red
        $missing += $img
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`nMissing images. On online machine run:" -ForegroundColor Yellow
    foreach ($img in $missing) {
        if ($img -match '^maptiler/') {
            Write-Host "  docker pull $img"
        } else {
            Write-Host "  docker compose build"
        }
    }
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarName = "infolake_full_offline_$timestamp.tar"
$fullPath = Join-Path $OutputDir $tarName
$stablePath = Join-Path $OutputDir "infolake_full_offline.tar"
$manifestPath = Join-Path $OutputDir "offline-package-manifest.txt"

Write-Host "`n=== Saving images ===" -ForegroundColor Yellow
Write-Host "Images: $($images -join ', ')" -ForegroundColor DarkGray
docker save -o $stablePath @images
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Copy-Item -Force $stablePath $fullPath

$sizeMb = (Get-Item $stablePath).Length / 1MB
$gitBranch = ""
try { $gitBranch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim() } catch { }

$manifest = @"
InfoLake offline package manifest
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Git branch: $gitBranch

Docker images in infolake_full_offline.tar:
$(($images | ForEach-Object { "  - $_" }) -join "`n")

Archive:
  Stable:    $stablePath
  Timestamp: $fullPath
  Size:      $([math]::Round($sizeMb, 1)) MB

Copy to offline server:
  1. infolake_full_offline.tar (this archive)
  2. Full project folder (git clone / zip), EXCLUDING:
     - node_modules, __pycache__, .git (optional)
     - frontend/dist (optional if using Vite dev in Docker)
  3. tileserver/data/map.mbtiles (NOT in git, copy separately)
  4. backend/.env (create from .env.example on target)

On offline server:
  .\import-and-start.ps1
  See OFFLINE_MIGRATION.md
  Marker color palettes: OFFLINE_MIGRATION_MARKER_PALETTES.md
    scripts\offline\post-update-offline.ps1

NEVER on offline machine:
  docker compose build
  docker compose pull
  docker pull
"@

Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Stable:    $stablePath"
Write-Host "  Timestamp: $fullPath"
Write-Host ("  Size: {0:N1} MB" -f $sizeMb)
Write-Host "  Manifest:  $manifestPath"
Write-Host "`nNext: copy infolake_full_offline.tar + project + map.mbtiles to offline server."
Write-Host "Guide: OFFLINE_MIGRATION.md"
