# Online preparation only. Offline application must use --no-build --pull never.
param(
    [string]$OutputDir = '',
    [switch]$NoCache,
    [switch]$SkipBuild,
    [switch]$SkipMapStyle,
    [ValidateSet('prod', 'prod_postgres', 'direct-prod')][string]$Mode = 'prod'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'update-policy.ps1')
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $ProjectRoot

function Assert-CleanRelease {
    $branch = & git rev-parse --abbrev-ref HEAD
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'production') { throw 'Prepare releases from the production branch only.' }
    $dirty = & git status --porcelain --untracked-files=all
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Commit/review all source changes before preparing a release. No files were discarded.' }
}
Assert-CleanRelease
$commit = (& git rev-parse HEAD).Trim()
$version = (Get-Content -LiteralPath 'VERSION' -Raw).Trim()
if ($version -notmatch '^[0-9A-Za-z][0-9A-Za-z._-]*$') { throw 'Unsafe VERSION value.' }
$composeArgs = Get-UpdateComposeArgs $Mode
$config = Get-UpdateConfiguration $Mode
$services = @(Get-UpdateServices $Mode)
if (-not $SkipMapStyle) {
    & node (Join-Path $ProjectRoot 'tileserver/scripts/build-unified-style.js') --check
    if ($LASTEXITCODE -ne 0) { throw 'Map styles differ from sources. Generate, review and commit both outputs before release.' }
}
if (-not $SkipBuild) {
    $buildArgs = @('compose') + $composeArgs + @('build', '--build-arg', "INFOLAKE_GIT_SHA=$commit")
    if ($NoCache) { $buildArgs += '--no-cache' }
    & docker @buildArgs
    if ($LASTEXITCODE -ne 0) { throw 'Compose build failed.' }
}
$images = @()
foreach ($service in $services) {
    $tag = $config.services.$service.image
    if (-not $tag) { throw "No image configured: $service" }
    $inspection = & docker image inspect $tag
    if ($LASTEXITCODE -ne 0) { throw "Image is unavailable: $tag" }
    $info = @($inspection -join "`n" | ConvertFrom-Json)[0]
    if ($service -in @('backend', 'nginx', 'frontend-static') -and $info.Config.Labels.'org.opencontainers.image.revision' -ne $commit) {
        throw "Image/source mismatch: $tag. Build this release; unverified --SkipBuild is not allowed."
    }
    $images += [ordered]@{ service = $service; tag = $tag; id = $info.Id }
}
Assert-CleanRelease
if ((& git rev-parse HEAD).Trim() -ne $commit) { throw 'HEAD changed while building.' }
$outputRoot = if ($OutputDir) { [IO.Path]::GetFullPath($OutputDir) } else { Join-Path $ProjectRoot 'dist\updates' }
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
# Unique destination, never recursively remove an existing package or user directory.
$packName = "infolake_update_v${version}_${Mode}_$(Get-Date -Format yyyyMMdd_HHmmss)_$($commit.Substring(0,8))"
$packDir = Join-Path $outputRoot $packName
if (Test-Path -LiteralPath $packDir) { throw "Package already exists: $packDir" }
New-Item -ItemType Directory -Path $packDir | Out-Null
$bundle = Join-Path $packDir 'update.bundle'
& git bundle create $bundle refs/heads/production
if ($LASTEXITCODE -ne 0) { throw 'Bundle creation failed.' }
& git bundle verify $bundle
if ($LASTEXITCODE -ne 0) { throw 'Bundle verification failed.' }
$heads = & git bundle list-heads $bundle refs/heads/production
if ($LASTEXITCODE -ne 0 -or ($heads -split '\s+')[0] -ne $commit) { throw 'Bundle/source mismatch.' }
$saveImages = @($images | ForEach-Object { $_.tag })
& docker save -o (Join-Path $packDir 'images.tar') @saveImages
if ($LASTEXITCODE -ne 0) { throw 'Image export failed.' }
foreach ($entry in $images) {
    $savedId = & docker image inspect --format '{{.Id}}' $entry.tag
    if ($LASTEXITCODE -ne 0 -or $savedId.Trim() -ne $entry.id) { throw 'Image tag changed during export. Prepare a new package.' }
}
Assert-CleanRelease
if ((& git rev-parse HEAD).Trim() -ne $commit) { throw 'HEAD changed while exporting.' }
foreach ($name in @('apply-update.ps1', 'apply-update.bat', 'update-policy.ps1')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $packDir }
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'scripts/offline/backup-postgres-before-migrate.ps1') -Destination $packDir
foreach ($name in @('VERSION', 'CHANGELOG.md')) { Copy-Item -LiteralPath (Join-Path $ProjectRoot $name) -Destination $packDir }
$checksums = [ordered]@{}
foreach ($file in Get-ChildItem -LiteralPath $packDir -File) { $checksums[$file.Name] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
$manifest = [ordered]@{
    schema_version = 1; version = $version; mode = $Mode; git_commit = $commit
    generated_at = [DateTime]::UtcNow.ToString('o'); images = $images; files = $checksums
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $packDir 'UPDATE_MANIFEST.json') -Encoding UTF8
@"
InfoLake $version ($Mode), Git $commit
See UPDATE_MANIFEST.json for image IDs and SHA256 checksums.
Use apply-update.bat or apply-update.ps1 -ProjectRoot <repository>.
Do not build/pull on the offline server. Backup is mandatory.
If migrations/startup fail, database recovery requires operator review; no automatic schema downgrade.
"@ | Set-Content -LiteralPath (Join-Path $packDir 'UPDATE_MANIFEST.txt') -Encoding UTF8
$tarPath = Join-Path $outputRoot "$packName.tar"
& tar -cf $tarPath -C $packDir .
if ($LASTEXITCODE -ne 0) { throw 'Package archive creation failed.' }
Write-Host "Prepared $packDir and $tarPath" -ForegroundColor Green
