# Read-only policy checks plus disposable fixtures; no Docker, DB or Git mutation.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'update-policy.ps1')
$count = 0
function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) { throw $message }
    $script:count++
}
function Assert-Throws([scriptblock]$action, [string]$message) {
    $thrown = $false
    try { & $action } catch { $thrown = $true }
    Assert-True $thrown $message
}
foreach ($file in @('apply-update.ps1', 'prepare-update-package.ps1', 'update-policy.ps1', 'test-update-policy.ps1', '../offline/backup-postgres-before-migrate.ps1')) {
    $parseErrors = $null
    $tokens = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $file), [ref]$tokens, [ref]$parseErrors)
    Assert-True ($parseErrors.Count -eq 0) "Parse errors in $file : $parseErrors"
}
Assert-True ((Get-UpdateServices 'prod') -join ',' -eq 'backend,tileserver,nginx') 'Production must package nginx, not the dev frontend.'
Assert-True ((Get-UpdateServices 'prod_postgres') -contains 'postgres') 'Postgres image missing.'
Assert-True ((Get-UpdateServices 'direct-prod') -contains 'frontend-static') 'Direct production frontend missing.'
Assert-True ((Get-UpdateComposeArgs 'prod_postgres') -contains 'docker-compose.postgres.yml') 'Postgres overlay missing.'
Assert-True ((Get-UpdateComposeArgs 'direct-prod') -contains 'direct-prod') 'Direct profile missing.'
foreach ($status in @(200, 401, 403)) { Assert-True (Test-UpdateHttpStatus $status 'api') "Expected API status $status" }
foreach ($status in @(301, 404, 500, 502)) { Assert-True (-not (Test-UpdateHttpStatus $status 'api')) "Unexpected API status $status" }
foreach ($service in @('frontend', 'tiles')) {
    Assert-True (Test-UpdateHttpStatus 200 $service) "Expected 200 for $service"
    Assert-True (-not (Test-UpdateHttpStatus 404 $service)) "404 must not pass for $service"
}
# Load only function definitions, never the updater's main block or its exit statements.
$updaterAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'apply-update.ps1'), [ref]$tokens, [ref]$parseErrors)
foreach ($definition in $updaterAst.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
    Invoke-Expression $definition.Extent.Text
}
function Write-Log { param($Message, $Color) }
function docker { $script:CapturedDockerArgs = @($args); $global:LASTEXITCODE = 0 }
function git { throw 'Git mutation must not run in this recovery test.' }
$script:ComposeArgs = Get-UpdateComposeArgs 'prod'
Invoke-Compose up -d --no-build --pull never --force-recreate backend tileserver nginx
Assert-True ($script:CapturedDockerArgs -contains '--no-build') 'Offline build flag lost by argument binding.'
Assert-True ($script:CapturedDockerArgs -contains 'never') 'Offline pull policy lost by argument binding.'
Invoke-Compose exec -T backend python manage.py migrate --noinput
Assert-True ($script:CapturedDockerArgs -contains '--noinput') 'Migration arguments lost.'
$urlConfig = '{"services":{"nginx":{"ports":[{"published":"12345","protocol":"tcp"}]},"frontend-static":{"ports":[{"published":"15173","protocol":"tcp"}]},"backend":{"ports":[{"published":"18000","protocol":"tcp"}]},"tileserver":{"ports":[{"published":"18080","protocol":"tcp"}]}}}' | ConvertFrom-Json
Set-UpdateServiceUrls $urlConfig 'prod'
Assert-True ($script:FrontendUrl -eq 'http://127.0.0.1:12345' -and $script:TilesUrl -eq 'http://127.0.0.1:12345/tiles') 'Custom proxied port lost.'
Set-UpdateServiceUrls $urlConfig 'direct-prod'
Assert-True ($script:FrontendUrl -eq 'http://127.0.0.1:15173' -and $script:ApiUrl -eq 'http://127.0.0.1:18000' -and $script:TilesUrl -eq 'http://127.0.0.1:18080') 'Custom direct ports lost.'
$script:CapturedDockerArgs = @()
$script:MayHaveMigrated = $true
$script:Backup = [PSCustomObject]@{ Path = 'example.dump' }
Invoke-SafeRecovery
Assert-True ($script:CapturedDockerArgs.Count -eq 0) 'Unsafe restart/rollback after possible migration.'
Remove-Item Function:docker
Remove-Item Function:git
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('infolake-update-test-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($fixtureRoot)
try {
    $checksums = [ordered]@{}
    foreach ($name in @('update.bundle', 'images.tar', 'VERSION', 'apply-update.ps1', 'apply-update.bat', 'update-policy.ps1', 'backup-postgres-before-migrate.ps1')) {
        $path = Join-Path $fixtureRoot $name
        [IO.File]::WriteAllText($path, '1.0.0')
        $checksums[$name] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    }
    $manifest = [ordered]@{
        schema_version = 1; mode = 'prod'; version = '1.0.0'; git_commit = ('a' * 40)
        files = $checksums; images = @(
            @{ service = 'backend'; tag = 'infolake-backend:latest'; id = 'sha256:' + ('b' * 64) },
            @{ service = 'tileserver'; tag = 'maptiler/tileserver-gl:latest'; id = 'sha256:' + ('c' * 64) },
            @{ service = 'nginx'; tag = 'infolake-nginx:latest'; id = 'sha256:' + ('d' * 64) }
        )
    } | ConvertTo-Json -Depth 6 | ConvertFrom-Json
    Assert-UpdateManifest $manifest $fixtureRoot
    $count++
    $manifest.git_commit = 'bad'
    Assert-Throws { Assert-UpdateManifest $manifest $fixtureRoot } 'Bad Git SHA accepted.'
    $manifest.git_commit = 'a' * 40
    $manifest.images[2].service = 'frontend'
    Assert-Throws { Assert-UpdateManifest $manifest $fixtureRoot } 'Dev frontend accepted in production.'
    $manifest.images[2].service = 'nginx'
    [IO.File]::WriteAllText((Join-Path $fixtureRoot 'images.tar'), 'tampered')
    Assert-Throws { Assert-UpdateManifest $manifest $fixtureRoot } 'Corrupted images archive accepted.'
    $backupScript = Join-Path $fixtureRoot 'backup-test.ps1'
    [IO.File]::WriteAllText($backupScript, "param(`$ProjectRoot, `$Mode); throw 'simulated backup failure'")
    Assert-Throws { Get-VerifiedUpdateBackup $backupScript $fixtureRoot 'prod' } 'Backup error swallowed.'
    [IO.File]::WriteAllText($backupScript, 'param($ProjectRoot, $Mode); $null')
    Assert-Throws { Get-VerifiedUpdateBackup $backupScript $fixtureRoot 'prod' } 'Empty backup result accepted.'
    [IO.File]::WriteAllText($backupScript, 'param($ProjectRoot, $Mode); [PSCustomObject]@{Path=(Join-Path $ProjectRoot "VERSION"); Sha256="bad"}')
    Assert-Throws { Get-VerifiedUpdateBackup $backupScript $fixtureRoot 'prod' } 'Backup checksum mismatch accepted.'
    [IO.File]::WriteAllText($backupScript, 'param($ProjectRoot, $Mode); $p=Join-Path $ProjectRoot "VERSION"; [PSCustomObject]@{Path=$p; Sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash}')
    Assert-True ((Get-VerifiedUpdateBackup $backupScript $fixtureRoot 'prod').Path -eq (Join-Path $fixtureRoot 'VERSION')) 'Valid backup rejected.'
} finally {
    # Exact unique fixture directory, not repository or a computed parent path.
    if ($fixtureRoot.StartsWith([IO.Path]::GetTempPath()) -and (Split-Path $fixtureRoot -Leaf).StartsWith('infolake-update-test-')) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}
Write-Host "Update policy: $count checks passed." -ForegroundColor Green
