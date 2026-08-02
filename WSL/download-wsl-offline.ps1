# download-wsl-offline.ps1
# Скачивает пакеты WSL2 для офлайн-установки на Win10 22H2 (x64).
# Запускать на машине С ИНТЕРНЕТОМ из папки WSL/.
param(
    [string]$PackagesDir = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $PackagesDir) {
    $PackagesDir = Join-Path $root "packages"
}
New-Item -ItemType Directory -Force -Path $PackagesDir | Out-Null

$downloads = @(
    @{
        Name = "wsl.2.7.11.0.x64.msi"
        Uri  = "https://github.com/microsoft/WSL/releases/download/2.7.11/wsl.2.7.11.0.x64.msi"
    },
    @{
        Name = "wsl_update_x64.msi"
        Uri  = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
    },
    @{
        Name = "Ubuntu2204.AppxBundle"
        Uri  = "https://aka.ms/wslubuntu2204"
    }
)

function Get-DownloadPath([string]$Name) {
    return Join-Path $PackagesDir $Name
}

Write-Host "=== WSL offline package download ===" -ForegroundColor Cyan
Write-Host "Target: $PackagesDir"

foreach ($item in $downloads) {
    $out = Get-DownloadPath $item.Name
    Write-Host "`nDownloading $($item.Name) ..." -ForegroundColor Yellow
    Write-Host "  $($item.Uri)" -ForegroundColor DarkGray

    # curl.exe надёжнее для больших файлов и редиректов aka.ms
    & curl.exe -fL --retry 3 --retry-delay 2 -o $out $item.Uri
    if ($LASTEXITCODE -ne 0) {
        Write-Host "curl failed, fallback to Invoke-WebRequest..." -ForegroundColor DarkYellow
        Invoke-WebRequest -Uri $item.Uri -OutFile $out -UseBasicParsing
    }

    if (-not (Test-Path $out) -or (Get-Item $out).Length -lt 1MB) {
        throw "Download failed or file too small: $out"
    }

    $sizeMb = [math]::Round((Get-Item $out).Length / 1MB, 1)
    Write-Host "  OK  $sizeMb MB -> $out" -ForegroundColor Green
}

# Ubuntu aka.ms отдаёт AppxBundle — извлечь x64 .appx для удобной установки на Win10 x64
$bundle = Join-Path $PackagesDir "Ubuntu2204.AppxBundle"
if (Test-Path $bundle) {
    Write-Host "`nExtracting Ubuntu x64 appx from bundle..." -ForegroundColor Cyan
    Push-Location $PackagesDir
    try {
        $inner = (& tar -tf "Ubuntu2204.AppxBundle" 2>$null | Where-Object { $_ -match '_x64\.appx$' } | Select-Object -First 1)
        if ($inner) {
            & tar -xf "Ubuntu2204.AppxBundle" $inner
            if (Test-Path $inner) {
                Move-Item -Force $inner "Ubuntu2204_x64.appx"
                Write-Host "  OK  Ubuntu2204_x64.appx" -ForegroundColor Green
            }
        } else {
            Write-Warning "x64 .appx not found inside bundle"
        }
    } finally {
        Pop-Location
    }
}

# checksums
$checksumPath = Join-Path $root "checksums.txt"
$lines = @("# SHA256 of WSL offline packages", "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')", "")
Get-ChildItem $PackagesDir -File | Sort-Object Name | ForEach-Object {
    $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash
    $mb = [math]::Round($_.Length / 1MB, 1)
    $lines += "$hash  $($_.Name)  (${mb} MB)"
    Write-Host "SHA256 $($_.Name): $hash" -ForegroundColor DarkGray
}
Set-Content -Path $checksumPath -Value ($lines -join "`n") -Encoding UTF8

Write-Host "`nDone. Packages in: $PackagesDir" -ForegroundColor Green
Write-Host "Checksums: $checksumPath"
Write-Host "Copy the entire WSL\ folder to the offline PC."
