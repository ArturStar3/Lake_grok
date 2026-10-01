# Shared, side-effect-free release policy. Never print Compose JSON (contains secrets).
function Get-UpdateComposeArgs {
    param([ValidateSet('prod', 'prod_postgres', 'direct-prod')][string]$Mode = 'prod')
    $result = @('-f', 'docker-compose.yml')
    if ($Mode -eq 'direct-prod') {
        $result += @('-f', 'docker-compose.direct.yml', '--profile', 'direct-prod')
    } else {
        $result += @('-f', 'docker-compose.server.yml')
        if ($Mode -eq 'prod_postgres') { $result += @('-f', 'docker-compose.postgres.yml') }
    }
    return $result
}

function Get-UpdateServices {
    param([string]$Mode)
    $names = @('backend', 'tileserver')
    if ($Mode -eq 'direct-prod') { $names += 'frontend-static' } else { $names += 'nginx' }
    if ($Mode -eq 'prod_postgres') { $names += 'postgres' }
    return $names
}

function Get-UpdateConfiguration {
    param([string]$Mode)
    $composeArgs = Get-UpdateComposeArgs $Mode
    $json = & docker compose @composeArgs config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Invalid Compose configuration for selected update mode.' }
    return ($json -join "`n" | ConvertFrom-Json)
}

function Assert-UpdateManifest {
    param($Manifest, [string]$PackageDir)
    if ($Manifest.schema_version -ne 1 -or $Manifest.mode -notin @('prod', 'prod_postgres', 'direct-prod')) {
        throw 'Unsupported update manifest/mode. Prepare a new package.'
    }
    if ($Manifest.git_commit -notmatch '^[a-f0-9]{40}$' -or -not $Manifest.version) { throw 'Invalid release identity.' }
    foreach ($name in @('update.bundle', 'images.tar', 'VERSION', 'apply-update.ps1', 'apply-update.bat', 'update-policy.ps1', 'backup-postgres-before-migrate.ps1')) {
        $checksum = $Manifest.files.PSObject.Properties[$name]
        $file = Join-Path $PackageDir $name
        if (-not $checksum -or $checksum.Value -notmatch '^[a-fA-F0-9]{64}$' -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Missing file/checksum: $name"
        }
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $checksum.Value) { throw "Checksum mismatch: $name" }
    }
    if ((Get-Content -LiteralPath (Join-Path $PackageDir 'VERSION') -Raw).Trim() -ne $Manifest.version) { throw 'VERSION does not match manifest.' }
    $services = @(Get-UpdateServices $Manifest.mode)
    if (@($Manifest.images).Count -ne $services.Count) { throw 'Unexpected image count.' }
    foreach ($service in $services) {
        $entries = @($Manifest.images | Where-Object { $_.service -eq $service })
        if ($entries.Count -ne 1 -or $entries[0].id -notmatch '^sha256:[a-f0-9]{64}$' -or -not $entries[0].tag) { throw "Missing/invalid image: $service" }
    }
}

function Get-VerifiedUpdateBackup {
    param([string]$BackupScript, [string]$ProjectRoot, [string]$Mode)
    if (-not (Test-Path -LiteralPath $BackupScript -PathType Leaf)) { throw 'Backup script missing; update refused.' }
    $artifact = & $BackupScript -ProjectRoot $ProjectRoot -Mode $Mode
    if (-not $artifact.Path -or -not $artifact.Sha256 -or -not (Test-Path -LiteralPath $artifact.Path -PathType Leaf)) {
        throw 'Backup did not return a verified artifact; update refused.'
    }
    if ((Get-Item -LiteralPath $artifact.Path).Length -eq 0 -or (Get-FileHash -LiteralPath $artifact.Path -Algorithm SHA256).Hash -ne $artifact.Sha256) {
        throw 'Backup checksum/size mismatch.'
    }
    return $artifact
}

function Test-UpdateHttpStatus {
    param([int]$Status, [ValidateSet('frontend', 'api', 'tiles')][string]$Service)
    if ($Service -eq 'api') { return $Status -in @(200, 401, 403) }
    return $Status -eq 200
}
