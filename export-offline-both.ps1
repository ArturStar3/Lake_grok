# Сборка и экспорт ОБОИХ офлайн-архивов: prod и dev.
# Запускать на машине с интернетом (Docker Desktop должен быть Running).
param(
    [string]$OutputDir = ".",
    [switch]$NoCache,
    [switch]$SkipBuild,
    [switch]$SkipMapStyle
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== InfoLake: export PROD + DEV offline archives ===" -ForegroundColor Cyan

$commonArgs = @("-OutputDir", $OutputDir)
if ($NoCache) { $commonArgs += "-NoCache" }
if ($SkipBuild) { $commonArgs += "-SkipBuild" }
if ($SkipMapStyle) { $commonArgs += "-SkipMapStyle" }

Write-Host "`n--- PRODUCTION ---" -ForegroundColor Yellow
& (Join-Path $scriptDir "export-offline.ps1") @commonArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- DEV ---" -ForegroundColor Yellow
$devArgs = $commonArgs + @("-Dev")
& (Join-Path $scriptDir "export-offline.ps1") @devArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "  PROD: infolake_full_offline_prod.tar"
Write-Host "  DEV:  infolake_full_offline_dev.tar"
Write-Host "  See OFFLINE_DEPLOY_PROD.md / OFFLINE_DEPLOY_DEV.md"
