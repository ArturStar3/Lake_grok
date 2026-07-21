# Резервная копия PostgreSQL перед migrate (оффлайн-сервер).
# PostgreSQL на хосте, не в Docker — см. docker-compose.yml (DB_HOST).
param(
    [string]$ProjectRoot = "",
    [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path }
Set-Location $ProjectRoot

$envFile = Join-Path $ProjectRoot "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "Не найден backend\.env — задайте DB_NAME, DB_USER, DB_PASSWORD вручную для pg_dump." -ForegroundColor Red
    exit 1
}

function Get-EnvValue($name) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*$name\s*=\s*(.+)\s*$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

$dbName = Get-EnvValue "DB_NAME"
$dbUser = Get-EnvValue "DB_USER"
$dbHost = Get-EnvValue "DB_HOST"
if (-not $dbHost) { $dbHost = "localhost" }

if (-not $dbName -or -not $dbUser) {
    Write-Host "В backend\.env должны быть DB_NAME и DB_USER." -ForegroundColor Red
    exit 1
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Host "pg_dump не найден в PATH. Установите PostgreSQL client или укажите полный путь." -ForegroundColor Red
    Write-Host "Пример вручную:"
    Write-Host "  pg_dump -h $dbHost -U $dbUser -Fc -f backup.dump $dbName"
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $OutputDir "infolake_pre_migrate_$stamp.dump"

Write-Host "Dump: $outFile" -ForegroundColor Cyan
Write-Host "Host: $dbHost  DB: $dbName  User: $dbUser" -ForegroundColor DarkGray
& pg_dump -h $dbHost -U $dbUser -Fc -f $outFile $dbName
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Готово. Храните файл до успешной проверки migrate." -ForegroundColor Green
