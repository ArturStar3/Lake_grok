# Apply a checksummed, revision-bound package without network/build operations.
param(
    [string]$ProjectRoot = '',
    [string]$PackageDir = '',
    [ValidateSet('', 'prod', 'prod_postgres', 'direct-prod')][string]$Mode = ''
)
$ErrorActionPreference = 'Stop'
$script:LogFile = $null
$script:PrevCommit = $null
$script:DidPull = $false
$script:DidLoadImages = $false
$script:MayHaveMigrated = $false
$script:PreviousImages = @{}
$script:Backup = $null

function Write-Log {
    param([string]$Message, [string]$Color = 'White')
    $line = '[{0}] {1}' -f (Get-Date -Format HH:mm:ss), $Message
    Write-Host $line -ForegroundColor $Color
    if ($script:LogFile) { Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8 }
}
function Find-ProjectRoot {
    param([string]$Hint, [string]$FromPackage)
    if ($Hint) {
        $resolved = (Resolve-Path -LiteralPath $Hint).Path
        if (-not (Test-Path -LiteralPath (Join-Path $resolved 'docker-compose.yml'))) { throw 'Invalid -ProjectRoot.' }
        return $resolved
    }
    foreach ($relative in @('..', '..\..', '..\..\..', '..\infolake', '..\Lake_grok')) {
        $candidate = Join-Path $FromPackage $relative
        if ((Test-Path -LiteralPath (Join-Path $candidate '.git')) -and (Test-Path -LiteralPath (Join-Path $candidate 'docker-compose.yml'))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw 'Проект не найден. Укажите -ProjectRoot.'
}
function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
    & docker compose @script:ComposeArgs @ComposeArgs | ForEach-Object { Write-Log "  $_" 'DarkGray' }
    if ($LASTEXITCODE -ne 0) { throw "Compose command failed (exit $LASTEXITCODE)." }
}
function Test-HttpOk {
    param([string]$Url, [string]$Service)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
        $status = [int]$response.StatusCode
    } catch {
        if (-not $_.Exception.Response) { return $false }
        $status = [int]$_.Exception.Response.StatusCode
    }
    return Test-UpdateHttpStatus $status $Service
}
function Get-ServiceUrl {
    param($Configuration, [string]$Service)
    $binding = @($Configuration.services.$Service.ports)[0]
    if (-not $binding -or -not $binding.published -or $binding.protocol -ne 'tcp') { throw "No HTTP port: $Service" }
    $hostName = if ($binding.host_ip -and $binding.host_ip -notin @('0.0.0.0', '::')) { $binding.host_ip } else { '127.0.0.1' }
    if ($hostName.Contains(':')) { $hostName = "[$hostName]" }
    return "http://${hostName}:$($binding.published)"
}
function Wait-ServicesHealthy {
    param([int]$Attempts = 30)
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        $frontend = Test-HttpOk ($script:FrontendUrl + '/') 'frontend'
        $backend = Test-HttpOk ($script:ApiUrl + '/api/v1/') 'api'
        $tiles = Test-HttpOk ($script:TilesUrl + '/styles/infolake-unified/style.json') 'tiles'
        Write-Log "Health $attempt/$Attempts UI=$frontend API=$backend tiles=$tiles" 'DarkGray'
        if ($frontend -and $backend -and $tiles) { return $true }
        if ($attempt -lt $Attempts) { Start-Sleep -Seconds 5 }
    }
    return $false
}
function Set-UpdateServiceUrls {
    param($Configuration, [string]$Mode)
    if ($Mode -eq 'direct-prod') {
        $script:FrontendUrl = Get-ServiceUrl $Configuration 'frontend-static'
        $script:ApiUrl = Get-ServiceUrl $Configuration 'backend'
        $script:TilesUrl = Get-ServiceUrl $Configuration 'tileserver'
    } else {
        $script:FrontendUrl = Get-ServiceUrl $Configuration 'nginx'
        $script:ApiUrl = $script:FrontendUrl
        $script:TilesUrl = $script:FrontendUrl + '/tiles'
    }
}
function Invoke-SafeRecovery {
    if ($script:MayHaveMigrated) {
        Write-Log 'ОБНОВЛЕНИЕ НЕ ЗАВЕРШЕНО. Миграции могли изменить БД; автоматический откат запрещён.' 'Red'
        Write-Log 'Нужна проверка журнала и восстановление согласованной версии БД/кода/образов на отдельном стенде.' 'Yellow'
        Write-Log "Предыдущий commit: $script:PrevCommit; backup: $($script:Backup.Path)" 'Yellow'
        return
    }
    if (-not $script:DidPull -and -not $script:DidLoadImages) {
        Write-Log 'Обновление остановлено до изменения кода/образов. Работающие сервисы не перезапускались.' 'Yellow'
        return
    }
    # Startup has not been attempted: DB/schema and running containers are unchanged.
    if ($script:DidPull) {
        & git reset --keep $script:PrevCommit
        if ($LASTEXITCODE -ne 0) { throw 'Code rollback refused; preserve local changes and contact the developer.' }
    }
    if ($script:DidLoadImages) {
        foreach ($tag in $script:PreviousImages.Keys) {
            & docker tag $script:PreviousImages[$tag] $tag
            if ($LASTEXITCODE -ne 0) { throw "Cannot restore image tag $tag" }
        }
    }
    Write-Log 'Код и теги образов возвращены к предыдущей версии; БД и работающие контейнеры не изменялись.' 'Green'
}

try {
    if (-not $PackageDir) { $PackageDir = $PSScriptRoot }
    $PackageDir = (Resolve-Path -LiteralPath $PackageDir).Path
    . (Join-Path $PackageDir 'update-policy.ps1')
    $manifest = Get-Content -LiteralPath (Join-Path $PackageDir 'UPDATE_MANIFEST.json') -Raw | ConvertFrom-Json
    Assert-UpdateManifest $manifest $PackageDir
    if ($Mode -and $Mode -ne $manifest.mode) { throw 'Package mode differs from the requested installation mode.' }
    $Mode = $manifest.mode
    $ProjectRoot = Find-ProjectRoot $ProjectRoot $PackageDir
    Set-Location -LiteralPath $ProjectRoot
    $script:ComposeArgs = Get-UpdateComposeArgs $Mode
    $logsDir = Join-Path $ProjectRoot 'logs'
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    $stamp = Get-Date -Format yyyyMMdd_HHmmss
    $script:LogFile = Join-Path $logsDir "update-$stamp.log"
    Write-Log "InfoLake v$($manifest.version), mode=$Mode, Git=$($manifest.git_commit)" 'Cyan'
    $dirty = & git status --porcelain --untracked-files=all
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Обновление остановлено: есть локальные изменения. Не удаляйте их.' }
    $branch = & git rev-parse --abbrev-ref HEAD
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'production') { throw 'Требуется ветка production; автоматическое переключение не выполняется.' }
    $script:PrevCommit = (& git rev-parse HEAD).Trim()
    $bundle = Join-Path $PackageDir 'update.bundle'
    & git bundle verify $bundle
    if ($LASTEXITCODE -ne 0) { throw 'Invalid/incompatible update.bundle.' }
    $heads = & git bundle list-heads $bundle refs/heads/production
    if ($LASTEXITCODE -ne 0 -or ($heads -split '\s+')[0] -ne $manifest.git_commit) { throw 'Bundle commit differs from manifest.' }
    $config = Get-UpdateConfiguration $Mode
    $services = @(Get-UpdateServices $Mode)
    foreach ($entry in $manifest.images) {
        if ($config.services.($entry.service).image -ne $entry.tag) { throw "Compose/image mismatch: $($entry.service)" }
        $containers = @(& docker compose @script:ComposeArgs ps --quiet --status running $entry.service)
        if ($LASTEXITCODE -ne 0 -or $containers.Count -ne 1) { throw "Existing service must be running for safe update: $($entry.service)" }
        $imageId = & docker inspect --format '{{.Image}}' $containers[0]
        if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect previous container image.' }
        $script:PreviousImages[$entry.tag] = $imageId.Trim()
        & docker tag $imageId "infolake-rollback-$($entry.service):$stamp"
        if ($LASTEXITCODE -ne 0) { throw 'Cannot preserve previous image.' }
    }
    Set-UpdateServiceUrls $config $Mode
    Write-Log 'Обязательная резервная копия БД...' 'Cyan'
    $backupScript = Join-Path $PackageDir 'backup-postgres-before-migrate.ps1'
    $script:Backup = Get-VerifiedUpdateBackup $backupScript $ProjectRoot $Mode
    Write-Log "Backup: $($script:Backup.Path); SHA256: $($script:Backup.Sha256)" 'Green'
    Write-Log 'Применение кода (fast-forward only)...' 'Cyan'
    & git pull --ff-only $bundle refs/heads/production
    if ($LASTEXITCODE -ne 0) { throw 'Git fast-forward failed.' }
    $script:DidPull = $true
    if ((& git rev-parse HEAD).Trim() -ne $manifest.git_commit) { throw 'Applied commit mismatch.' }
    $script:DidLoadImages = $true # docker load can partially replace tags even when it fails.
    & docker load -i (Join-Path $PackageDir 'images.tar')
    if ($LASTEXITCODE -ne 0) { throw 'Docker load failed.' }
    foreach ($entry in $manifest.images) {
        $id = & docker image inspect --format '{{.Id}}' $entry.tag
        if ($LASTEXITCODE -ne 0 -or $id.Trim() -ne $entry.id) { throw "Loaded image ID mismatch: $($entry.tag)" }
        if ($entry.service -in @('backend', 'nginx', 'frontend-static')) {
            $revision = & docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' $entry.tag
            if ($LASTEXITCODE -ne 0 -or $revision.Trim() -ne $manifest.git_commit) { throw 'Loaded image revision mismatch.' }
        }
    }
    # Revalidate new Compose code before any container can execute migrations.
    $config = Get-UpdateConfiguration $Mode
    foreach ($entry in $manifest.images) {
        if ($config.services.($entry.service).image -ne $entry.tag) { throw 'New Compose/image mismatch.' }
    }
    Set-UpdateServiceUrls $config $Mode
    $script:MayHaveMigrated = $true # backend entrypoint migrates on container startup.
    Invoke-Compose up -d --no-build --pull never --force-recreate @services
    Invoke-Compose exec -T backend python manage.py migrate --noinput
    Invoke-Compose exec -T backend python manage.py seed_report_templates
    if (-not (Wait-ServicesHealthy)) { throw 'UI/API/map style checks failed after startup.' }
    Write-Log "ОБНОВЛЕНИЕ ЗАВЕРШЕНО: v$($manifest.version). App: $script:FrontendUrl/" 'Green'
    Write-Log "Backup retained: $($script:Backup.Path). Journal: $script:LogFile"
    exit 0
} catch {
    Write-Log "Сбой: $($_.Exception.Message)" 'Red'
    try { Invoke-SafeRecovery } catch { Write-Log "Восстановление не завершено: $($_.Exception.Message)" 'Red' }
    Write-Log "Передайте разработчику журнал: $script:LogFile" 'Yellow'
    exit 1
}
