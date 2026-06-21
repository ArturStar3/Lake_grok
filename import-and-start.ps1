# import-and-start.ps1
# Импорт Docker-образов и запуск на целевой машине (без интернета)
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $TarFile) {
    $TarFile = Get-ChildItem -Filter "infolake_full_offline_*.tar" | 
               Sort-Object LastWriteTime -Descending | 
               Select-Object -First 1 | 
               Select-Object -ExpandProperty FullName
}

if (-not (Test-Path $TarFile)) {
    Write-Host "Файл архива не найден!" -ForegroundColor Red
    exit 1
}

Write-Host "Загружаем образы из: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile

Write-Host "`nЗапускаем контейнеры (--no-build)..." -ForegroundColor Cyan
docker compose up -d --no-build

Write-Host "`nСтатус:" -ForegroundColor Green
docker compose ps
