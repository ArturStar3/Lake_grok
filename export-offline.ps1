# export-offline.ps1
# Export Docker images for fully offline deployment
param(
    [string]$OutputDir = ".",
    [switch]$NoCache,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

if (-not $SkipBuild) {
    Write-Host "=== Building images ===" -ForegroundColor Cyan

    $buildArgs = @()
    if ($NoCache) { $buildArgs += "--no-cache" }

    docker compose build @buildArgs
} else {
    Write-Host "=== Skip build (--SkipBuild) ===" -ForegroundColor DarkGray
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarName = "infolake_full_offline_$timestamp.tar"
$fullPath = Join-Path $OutputDir $tarName
$stablePath = Join-Path $OutputDir "infolake_full_offline.tar"

Write-Host "`nReading images from docker-compose.yml..." -ForegroundColor DarkGray
$images = (Get-Content docker-compose.yml | Select-String -Pattern '^\s+image:') -replace '.*image:\s*', ''

if (-not $images) {
    Write-Host "No images found in docker-compose.yml" -ForegroundColor Red
    exit 1
}

Write-Host "Images: $($images -join ', ')" -ForegroundColor DarkGray

Write-Host "`nSaving to: $stablePath" -ForegroundColor Yellow
docker save -o $stablePath $images

Copy-Item -Force $stablePath $fullPath

$size = (Get-Item $stablePath).Length / 1MB
Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Stable:    $stablePath"
Write-Host "  Timestamp: $fullPath"
Write-Host ("  Size: {0:N1} MB" -f $size)
Write-Host "`nCopy infolake_full_offline.tar and project folder to the target machine."
Write-Host "See weaponlist_import.md for full offline migration guide."
