# import-and-start.ps1
# Import Docker images and start on target machine (offline)
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $TarFile) {
    if (Test-Path "infolake_full_offline.tar") {
        $TarFile = (Resolve-Path "infolake_full_offline.tar").Path
    } else {
        $TarFile = Get-ChildItem -Filter "infolake_full_offline_*.tar" |
                   Sort-Object LastWriteTime -Descending |
                   Select-Object -First 1 |
                   Select-Object -ExpandProperty FullName
    }
}

if (-not $TarFile -or -not (Test-Path $TarFile)) {
    Write-Host "Archive not found (infolake_full_offline.tar)" -ForegroundColor Red
    exit 1
}

Write-Host "Loading images from: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile

Write-Host "`nStarting containers (--no-build)..." -ForegroundColor Cyan
docker compose up -d --no-build

Write-Host "`nStatus:" -ForegroundColor Green
docker compose ps

Write-Host "`nNext: import equipment catalog (see weaponlist_import.md section 6):"
Write-Host "  docker compose exec backend python manage.py import_equipment_catalog --input equipment/catalog/fixtures"
