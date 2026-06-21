# export-offline.ps1
# Экспорт Docker-образов для полностью оффлайн-развёртывания
param(
    [string]$OutputDir = ".",
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

Write-Host "=== Сборка образов (оффлайн-экспорт) ===" -ForegroundColor Cyan

$buildArgs = @()
if ($NoCache) { $buildArgs += "--no-cache" }

docker compose build @buildArgs

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarName = "infolake_full_offline_$timestamp.tar"
$fullPath = Join-Path $OutputDir $tarName

Write-Host "`nСохраняем образы в файл: $fullPath" -ForegroundColor Yellow

Write-Host "Получаем список образов из docker-compose.yml..." -ForegroundColor DarkGray
$images = (Get-Content docker-compose.yml | Select-String -Pattern '^\s+image:') -replace '.*image:\s*', ''

if (-not $images) {
    Write-Host "Не удалось найти образы в docker-compose.yml" -ForegroundColor Red
    exit 1
}

docker save -o $fullPath $images

$size = (Get-Item $fullPath).Length / 1MB
Write-Host "`nГотово!" -ForegroundColor Green
Write-Host "Файл: $fullPath"
Write-Host ("Размер: {0:N1} MB" -f $size)
Write-Host "`nСкопируй этот .tar файл на целевую машину."
