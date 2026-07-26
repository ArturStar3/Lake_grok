# prepare-update-package.ps1
# На машине С интернетом: собирает пакет обновления для оффлайн/production-сервера.
#
# Результат: dist/updates/infolake_update_vX.Y.Z/ и .tar
#   - update.bundle          (git bundle ветки production)
#   - images.tar             (docker images)
#   - apply-update.ps1/.bat  (скрипт применения)
#   - VERSION, CHANGELOG.md, UPDATE_MANIFEST.txt
#
# Примечание: ZIP не используется — images.tar слишком велик для Compress-Archive.

# Требования: Docker Desktop, git, ветка production существует и запушена локально.
param(
    [string]$OutputDir = "",
    [switch]$NoCache,
    [switch]$SkipBuild,
    [switch]$SkipMapStyle
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

function Get-Version {
    $vFile = Join-Path $ProjectRoot "VERSION"
    if (-not (Test-Path $vFile)) { throw "Не найден VERSION в корне проекта" }
    return (Get-Content $vFile -Raw).Trim()
}

function Assert-OnProductionBranch {
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne "production") {
        Write-Host "Текущая ветка: $branch" -ForegroundColor Yellow
        Write-Host "Рекомендуется собирать пакет с ветки production." -ForegroundColor Yellow
        Write-Host "Продолжаем с текущей веткой (bundle будет из production, если она есть)." -ForegroundColor DarkGray
    }
}

Assert-OnProductionBranch
$version = Get-Version
Write-Host "=== InfoLake update package v$version ===" -ForegroundColor Cyan

# Ensure production branch exists locally
git show-ref --verify --quiet refs/heads/production
if ($LASTEXITCODE -ne 0) {
    throw "Локальная ветка production не найдена. Создайте её: git checkout -b production"
}

if (-not $SkipMapStyle) {
    Write-Host "`n=== Building unified map style ===" -ForegroundColor Cyan
    Push-Location (Join-Path $ProjectRoot "frontend")
    try {
        npm run build:map-style
        if ($LASTEXITCODE -ne 0) { throw "build:map-style failed" }
    } finally {
        Pop-Location
    }
}

if (-not $SkipBuild) {
    Write-Host "`n=== Building Docker images (production frontend) ===" -ForegroundColor Cyan
    $buildArgs = @("compose", "-f", "docker-compose.yml", "-f", "docker-compose.server.yml", "build")
    if ($NoCache) { $buildArgs += "--no-cache" }
    docker @buildArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose build failed" }
} else {
    Write-Host "`n=== Skip build (--SkipBuild) ===" -ForegroundColor DarkGray
}

$workDir = Join-Path $ProjectRoot "dist\updates\work_v$version"
$zipDir = if ($OutputDir) { $OutputDir } else { Join-Path $ProjectRoot "dist\updates" }
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
New-Item -ItemType Directory -Force -Path $zipDir | Out-Null

# Clean work dir
Get-ChildItem $workDir -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n=== Creating git bundle (production) ===" -ForegroundColor Cyan
$bundlePath = Join-Path $workDir "update.bundle"
# Full history of production so first install and incremental updates both work
git bundle create $bundlePath production
if ($LASTEXITCODE -ne 0) { throw "git bundle create failed" }
git bundle verify $bundlePath
if ($LASTEXITCODE -ne 0) { throw "git bundle verify failed" }

Write-Host "`n=== Saving Docker images ===" -ForegroundColor Cyan
$images = @(
    "infolake-backend:latest",
    "infolake-frontend:latest",
    "maptiler/tileserver-gl:latest"
)
foreach ($img in $images) {
    docker image inspect $img 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Образ не найден: $img" }
}
# Tag versioned copies for rollback clarity on target
docker tag "infolake-backend:latest" "infolake-backend:v$version"
docker tag "infolake-frontend:latest" "infolake-frontend:v$version"
$imagesTar = Join-Path $workDir "images.tar"
$saveList = $images + @("infolake-backend:v$version", "infolake-frontend:v$version")
docker save -o $imagesTar @saveList
if ($LASTEXITCODE -ne 0) { throw "docker save failed" }

Write-Host "`n=== Copying apply scripts and docs ===" -ForegroundColor Cyan
Copy-Item (Join-Path $PSScriptRoot "apply-update.ps1") (Join-Path $workDir "apply-update.ps1") -Force
Copy-Item (Join-Path $PSScriptRoot "apply-update.bat") (Join-Path $workDir "apply-update.bat") -Force
Copy-Item (Join-Path $ProjectRoot "VERSION") (Join-Path $workDir "VERSION") -Force
Copy-Item (Join-Path $ProjectRoot "CHANGELOG.md") (Join-Path $workDir "CHANGELOG.md") -Force

$commit = (git rev-parse production).Trim()
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$manifest = @"
InfoLake update package
Version: $version
Generated: $stamp
Git branch: production
Git commit: $commit

Contents:
  - update.bundle   — git bundle ветки production
  - images.tar      — Docker-образы (backend, frontend, tileserver)
  - apply-update.bat / apply-update.ps1 — применение обновления
  - VERSION, CHANGELOG.md

On the target computer:
  1. Распакуйте .tar (или скопируйте папку) так, чтобы рядом лежали
     apply-update.bat, update.bundle, images.tar
  2. Дважды щёлкните apply-update.bat
  3. Дождитесь зелёного сообщения «ОБНОВЛЕНИЕ ЗАВЕРШЕНО»
  4. При красном «ОШИБКА — ВЫПОЛНЕН ОТКАТ» отправьте файл logs\update-*.log разработчику

Do NOT run docker compose build / pull on the offline machine.
"@
Set-Content -Path (Join-Path $workDir "UPDATE_MANIFEST.txt") -Value $manifest -Encoding UTF8

$packName = "infolake_update_v$version"
$packDir = Join-Path $zipDir $packName
if (Test-Path $packDir) { Remove-Item $packDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $packDir | Out-Null

Write-Host "`n=== Assembling package folder ===" -ForegroundColor Cyan
Copy-Item (Join-Path $workDir "*") -Destination $packDir -Recurse -Force

# ZIP через Compress-Archive не подходит для images.tar (~2+ ГБ).
# Упаковываем в .tar (встроенный tar Windows 10+) — оператор может распаковать 7-Zip / tar.
$tarPath = Join-Path $zipDir "$packName.tar"
if (Test-Path $tarPath) { Remove-Item $tarPath -Force }

Write-Host "`n=== Creating TAR (large images) ===" -ForegroundColor Cyan
Push-Location $packDir
try {
    tar -cf $tarPath *
    if ($LASTEXITCODE -ne 0) { throw "tar create failed" }
} finally {
    Pop-Location
}

$sizeMb = [math]::Round((Get-Item $tarPath).Length / 1MB, 1)
$folderMb = [math]::Round(((Get-ChildItem $packDir -Recurse -File | Measure-Object -Property Length -Sum).Sum) / 1MB, 1)
Write-Host "`nDone!" -ForegroundColor Green
Write-Host "  Folder:  $packDir  (~$folderMb MB)"
Write-Host "  Archive: $tarPath  ($sizeMb MB)"
Write-Host "  Work:    $workDir"
Write-Host "`nPass the folder or .tar to the operator (extract next to the project)."
Write-Host "Inside the package: double-click apply-update.bat"
