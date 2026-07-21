# Полное обновление оффлайн-установки: load образов, up, migrate, проверка палитр.
param(
    [string]$TarFile = "",
    [switch]$SkipLoad
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

if (-not $SkipLoad) {
    & (Join-Path $ProjectRoot "import-and-start.ps1") -TarFile $TarFile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "=== docker compose up (SkipLoad) ===" -ForegroundColor Cyan
    docker compose up -d --no-build --pull never
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& (Join-Path $PSScriptRoot "apply-marker-palette-migration.ps1") -ProjectRoot $ProjectRoot -ExpectSeedPalettes
exit $LASTEXITCODE
