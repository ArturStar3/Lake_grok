# Creates a custom-format backup and validates its archive table of contents.
# Throws on any failure; never treats an absent/empty dump as successful.
param(
    [string]$ProjectRoot = '',
    [string]$OutputDir = 'backups',
    [ValidateSet('prod', 'prod_postgres', 'direct-prod')][string]$Mode = 'prod'
)
$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
Push-Location $ProjectRoot
$previousPassword = $env:PGPASSWORD
try {
    $policy = Join-Path $PSScriptRoot 'update-policy.ps1'
    if (-not (Test-Path -LiteralPath $policy)) { $policy = Join-Path $PSScriptRoot '../production/update-policy.ps1' }
    . $policy
    $configuration = Get-UpdateConfiguration $Mode
    # Compose overrides backend/.env (notably DB_HOST); back up the effective DB.
    $values = $configuration.services.backend.environment
    $backupRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot $OutputDir))
    if ([IO.Path]::IsPathRooted($OutputDir)) { $backupRoot = [IO.Path]::GetFullPath($OutputDir) }
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $token = [Guid]::NewGuid().ToString('N')
    $outFile = Join-Path $backupRoot "infolake_pre_migrate_$(Get-Date -Format yyyyMMdd_HHmmss)_$token.dump"
    if ($Mode -eq 'prod_postgres') {
        $postgresEnv = $configuration.services.postgres.environment
        if ($values.DB_NAME -ne $postgresEnv.POSTGRES_DB -or $values.DB_USER -ne $postgresEnv.POSTGRES_USER -or $values.DB_PASSWORD -ne $postgresEnv.POSTGRES_PASSWORD) {
            throw 'Backend/PostgreSQL credentials differ. Backup of another DB is not accepted.'
        }
        $composeArgs = @('-f', 'docker-compose.yml', '-f', 'docker-compose.server.yml', '-f', 'docker-compose.postgres.yml')
        $container = & docker compose @composeArgs ps --quiet postgres
        if ($LASTEXITCODE -ne 0 -or -not $container) { throw 'The configured PostgreSQL container is not running.' }
        $remoteFile = "/tmp/infolake-backup-$token.dump"
        # Expand credentials inside the container, not in the command/log or PowerShell.
        & docker compose @composeArgs exec -T postgres sh -c 'pg_dump -w -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$1" && pg_restore --list "$1" >/dev/null' sh $remoteFile
        if ($LASTEXITCODE -ne 0) { throw 'Container backup/archive verification failed.' }
        & docker cp "${container}:$remoteFile" $outFile
        if ($LASTEXITCODE -ne 0) { throw 'Cannot copy the verified database backup.' }
        # Only the exact, newly generated temporary file is removed.
        & docker compose @composeArgs exec -T postgres rm -- $remoteFile
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Backup copied; temporary container dump could not be removed.' }
    } else {
        if (-not $values.DB_NAME -or -not $values.DB_USER) { throw 'DB_NAME and DB_USER are required.' }
        $dbHost = $values.DB_HOST
        if (-not $dbHost -or $dbHost -eq 'host.docker.internal') { $dbHost = 'localhost' }
        $dbPort = if ($values.DB_PORT) { $values.DB_PORT } else { '5432' }
        $dump = Get-Command pg_dump -ErrorAction Stop
        $restore = Get-Command pg_restore -ErrorAction Stop
        if ($null -ne $values.DB_PASSWORD) { $env:PGPASSWORD = $values.DB_PASSWORD }
        & $dump.Source -w -h $dbHost -p $dbPort -U $values.DB_USER -d $values.DB_NAME -Fc -f $outFile
        if ($LASTEXITCODE -ne 0) { throw 'Host database backup failed.' }
        & $restore.Source --list $outFile | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Backup archive verification failed.' }
    }
    if (-not (Test-Path -LiteralPath $outFile -PathType Leaf) -or (Get-Item -LiteralPath $outFile).Length -eq 0) { throw 'Backup is absent or empty.' }
    Write-Host "Verified backup: $outFile" -ForegroundColor Green
    # Machine-readable result for the updater. Verification is not a restore rehearsal.
    [PSCustomObject]@{ Path = $outFile; Sha256 = (Get-FileHash -LiteralPath $outFile -Algorithm SHA256).Hash; Mode = $Mode }
} finally {
    $env:PGPASSWORD = $previousPassword
    Pop-Location
}
