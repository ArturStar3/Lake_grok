# export-offline.ps1
# Сборка Docker-образов и экспорт в infolake_full_offline.tar (машина С интернетом).
param(
    [string]$OutputDir = ".",
    [switch]$NoCache,
    [switch]$SkipBuild,
    [switch]$SkipMapStyle,
    [switch]$Dev,
    [switch]$Direct,
    [switch]$Postgres
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$modeCount = @($Dev, $Direct, $Postgres) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
if ($modeCount -gt 1) {
    throw "Use only one of -Dev, -Direct, -Postgres."
}

function Get-ComposeImages {
    param(
        [switch]$Dev,
        [switch]$Direct,
        [switch]$Postgres
    )
    $composeArgs = if ($Postgres) {
        @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.server.yml", "-f", "docker-compose.postgres.yml", "config", "--images")
    } elseif ($Direct) {
        @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.direct.yml", "--profile", "direct-prod", "config", "--images")
    } elseif ($Dev) {
        @("compose", "--profile", "dev", "config", "--images")
    } else {
        @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.server.yml", "config", "--images")
    }
    $output = docker @composeArgs 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose config --images failed"
    }
    return $output | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique
}

function Test-DockerImage {
    param([string]$Image)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        docker image inspect $Image 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } finally {
        $ErrorActionPreference = $prev
    }
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
    if ($Direct) {
        Write-Host "`n=== Building Docker images (DIRECT: no nginx, static frontend on :5173) ===" -ForegroundColor Cyan
        $buildArgs = @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.direct.yml", "--profile", "direct-prod", "build")
    } elseif ($Dev) {
        Write-Host "`n=== Building Docker images (DEV: bind-mount frontend/backend/tileserver) ===" -ForegroundColor Cyan
        $buildArgs = @("compose", "--profile", "dev", "build")
    } else {
        Write-Host "`n=== Building Docker images (production frontend) ===" -ForegroundColor Cyan
        $buildArgs = @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.server.yml", "build")
    }
    if ($NoCache) { $buildArgs += "--no-cache" }
    docker @buildArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "`n=== Skip build (--SkipBuild) ===" -ForegroundColor DarkGray
}

if ($Postgres) {
    Write-Host "`n=== Ensuring postgres:17 image ===" -ForegroundColor Cyan
    if (-not (Test-DockerImage "postgres:17")) {
        Write-Host "Pulling postgres:17 (online machine only)..." -ForegroundColor Yellow
        docker pull postgres:17
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        Write-Host "  OK  postgres:17" -ForegroundColor Green
    }
}

$images = Get-ComposeImages -Dev:$Dev -Direct:$Direct -Postgres:$Postgres
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
        if ($img -match '^(maptiler/|postgres:)') {
            Write-Host "  docker pull $img"
        } else {
            Write-Host "  docker compose build"
        }
    }
    exit 1
}

$modeSuffix = if ($Postgres) { "prod_postgres" } elseif ($Direct) { "direct" } elseif ($Dev) { "dev" } else { "prod" }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarName = "infolake_full_offline_${modeSuffix}_$timestamp.tar"
$fullPath = Join-Path $OutputDir $tarName
$stablePath = Join-Path $OutputDir "infolake_full_offline_$modeSuffix.tar"
$manifestPath = Join-Path $OutputDir "offline-package-manifest-$modeSuffix.txt"

Write-Host "`n=== Saving images ===" -ForegroundColor Yellow
Write-Host "Images: $($images -join ', ')" -ForegroundColor DarkGray
docker save -o $stablePath @images
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Copy-Item -Force $stablePath $fullPath

$sizeMb = (Get-Item $stablePath).Length / 1MB
$gitBranch = ""
try { $gitBranch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim() } catch { }

$modeLabel = if ($Postgres) {
    "PRODUCTION + PostgreSQL 17 in Docker (docker-compose.postgres.yml)"
} elseif ($Direct) {
    "DIRECT (no nginx: UI :5173, API :8000, tiles :8080)"
} elseif ($Dev) {
    "DEV (bind-mount required)"
} else {
    "PRODUCTION (docker-compose.server.yml)"
}
$startCmd = if ($Postgres) {
    "  .\import-and-start-postgres.ps1`n  (docker-compose.yml + docker-compose.server.yml + docker-compose.postgres.yml)"
} elseif ($Direct) {
    "  .\import-and-start-direct.ps1`n  (docker-compose.yml + docker-compose.direct.yml --profile direct-prod)"
} elseif ($Dev) {
    "  docker compose --profile dev up -d --no-build --pull never"
} else {
    "  .\import-and-start.ps1`n  (uses docker-compose.yml + docker-compose.server.yml, nginx :80, static frontend)"
}

$devCopyNote = if ($Dev) {
    "  5. DEV mode: also copy frontend/ and tileserver/ (styles, config.json) - bind-mount from disk"
} else {
    ""
}

$manifest = @"
InfoLake offline package manifest
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Git branch: $gitBranch
Mode: $modeLabel

Docker images in infolake_full_offline_$modeSuffix.tar:
$(($images | ForEach-Object { "  - $_" }) -join "`n")

Archive:
  Stable:    $stablePath
  Timestamp: $fullPath
  Size:      $([math]::Round($sizeMb, 1)) MB

Copy to offline server:
  1. infolake_full_offline_$modeSuffix.tar (this archive)
  2. Full project folder (git clone / zip), EXCLUDING:
     - node_modules, __pycache__, .git (optional)
     - frontend/dist (production only - built into image)
  3. tileserver/data/map.mbtiles (NOT in git, copy separately)
  4. backend/.env (create from .env.example on target)
$devCopyNote

On offline server:
$startCmd
  See OFFLINE_MIGRATION.md
  Marker color palettes: OFFLINE_MIGRATION_MARKER_PALETTES.md
    scripts\offline\post-update-offline.ps1

NEVER on offline machine:
  docker compose build
  docker compose pull
  docker pull
  docker compose up --build
"@

Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Stable:    $stablePath"
Write-Host "  Timestamp: $fullPath"
Write-Host ("  Size: {0:N1} MB" -f $sizeMb)
Write-Host "  Manifest:  $manifestPath"
Write-Host "`nNext: copy infolake_full_offline_$modeSuffix.tar + project + map.mbtiles to offline server."
Write-Host "Guide: OFFLINE_DEPLOY_$(if ($Postgres) { 'PROD_POSTGRES' } elseif ($Direct) { 'DIRECT' } elseif ($Dev) { 'DEV' } else { 'PROD' }).md"
