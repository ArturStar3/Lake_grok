# install-wsl-offline.ps1
# Офлайн-установка WSL2 + Ubuntu 22.04 на Windows 10 22H2 (x64).
# Запускать PowerShell ОТ ИМЕНИ АДМИНИСТРАТОРА.
param(
    [switch]$AfterReboot,
    [switch]$SkipUbuntu,
    [string]$PackagesDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $PackagesDir) {
    $PackagesDir = Join-Path $root "packages"
}

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-WinBuild {
    return [int](Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion").CurrentBuildNumber
}

function Write-Step($msg) {
    Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}

if (-not (Test-IsAdmin)) {
    throw "Запустите PowerShell от имени Администратора."
}

if (-not (Test-Path $PackagesDir)) {
    throw "Не найдена папка packages: $PackagesDir"
}

$build = Get-WinBuild
$arch = $env:PROCESSOR_ARCHITECTURE
Write-Host "OS build: $build  arch: $arch" -ForegroundColor DarkGray
if ($build -lt 19041) {
    throw "Нужен Windows 10 build >= 19041 (у вас $build). Обновите ОС."
}
if ($arch -ne "AMD64") {
    Write-Warning "Скрипт рассчитан на x64. Текущая архитектура: $arch"
}

# --- Phase 1: enable features ---
if (-not $AfterReboot) {
    Write-Step "Включение компонентов Windows (без интернета)"
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    if ($LASTEXITCODE -notin 0, 3010) { throw "DISM WSL feature failed: $LASTEXITCODE" }
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    if ($LASTEXITCODE -notin 0, 3010) { throw "DISM VirtualMachinePlatform failed: $LASTEXITCODE" }

    $wslFeat = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
    $vmFeat = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
    Write-Host "WSL feature: $($wslFeat.State)"
    Write-Host "VM Platform: $($vmFeat.State)"

    Write-Host "`nТребуется ПЕРЕЗАГРУЗКА." -ForegroundColor Yellow
    Write-Host "После перезагрузки выполните:" -ForegroundColor Yellow
    Write-Host "  cd `"$root`"" -ForegroundColor White
    Write-Host "  .\install-wsl-offline.ps1 -AfterReboot" -ForegroundColor White

    $ans = Read-Host "Перезагрузить компьютер сейчас? (Y/N)"
    if ($ans -match '^[YyДд]') {
        Restart-Computer -Force
    }
    exit 0
}

# --- Phase 2: after reboot — install MSI + Ubuntu ---
Write-Step "Установка WSL MSI"

$modernMsi = Get-ChildItem $PackagesDir -Filter "wsl.*.x64.msi" -File | Sort-Object Name -Descending | Select-Object -First 1
$legacyMsi = Join-Path $PackagesDir "wsl_update_x64.msi"
$msiInstalled = $false

if ($modernMsi) {
    Write-Host "Installing $($modernMsi.Name) ..."
    $p = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$($modernMsi.FullName)`" /norestart /qn" -Wait -PassThru
    if ($p.ExitCode -in 0, 3010) {
        Write-Host "Modern WSL MSI OK (exit $($p.ExitCode))" -ForegroundColor Green
        $msiInstalled = $true
    } else {
        Write-Warning "Modern WSL MSI exit code $($p.ExitCode). Trying legacy kernel MSI..."
    }
} else {
    Write-Warning "Не найден wsl.*.x64.msi в packages\"
}

if (-not $msiInstalled -and (Test-Path $legacyMsi)) {
    Write-Host "Installing wsl_update_x64.msi ..."
    $p = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$legacyMsi`" /norestart /qn" -Wait -PassThru
    if ($p.ExitCode -in 0, 3010) {
        Write-Host "Legacy kernel MSI OK (exit $($p.ExitCode))" -ForegroundColor Green
        $msiInstalled = $true
    } else {
        Write-Warning "Legacy MSI exit code $($p.ExitCode)"
    }
}

if (-not $msiInstalled) {
    Write-Warning "MSI не установился автоматически. Установите вручную двойным щелчком файл из packages\, затем продолжите."
}

# Refresh PATH for current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Step "WSL 2 по умолчанию"
try {
    & wsl --set-default-version 2
    Write-Host "Default version set to 2" -ForegroundColor Green
} catch {
    Write-Warning "wsl --set-default-version 2 не выполнился: $_"
    Write-Warning "Возможно нужна ещё одна перезагрузка после MSI."
}

if (-not $SkipUbuntu) {
    Write-Step "Установка Ubuntu 22.04"
    # Предпочтительно x64 .appx; иначе полный AppxBundle
    $ubuntu = $null
    $x64Appx = Join-Path $PackagesDir "Ubuntu2204_x64.appx"
    $bundle = Join-Path $PackagesDir "Ubuntu2204.AppxBundle"
    if (Test-Path $x64Appx) {
        $ubuntu = Get-Item $x64Appx
    } elseif (Test-Path $bundle) {
        $ubuntu = Get-Item $bundle
    } else {
        $ubuntu = Get-ChildItem $PackagesDir -File | Where-Object {
            $_.Name -match 'Ubuntu.*\.(appx|AppxBundle|msixbundle)$'
        } | Sort-Object Length -Descending | Select-Object -First 1
    }

    if (-not $ubuntu) {
        Write-Warning "Файл Ubuntu не найден в $PackagesDir"
    } else {
        Write-Host "Add-AppxPackage $($ubuntu.Name) ..."
        try {
            Add-AppxPackage -Path $ubuntu.FullName
            Write-Host "Ubuntu package installed." -ForegroundColor Green
        } catch {
            Write-Warning "Add-AppxPackage failed: $_"
            Write-Warning "См. OFFLINE_WSL_INSTALL.md §7 (зависимости VCLibs/UI.Xaml) или ручную распаковку."
        }
    }
}

Write-Step "Проверка"
try {
    & wsl -l -v
} catch {
    Write-Warning "wsl -l -v недоступен. Перезагрузите ПК и проверьте вручную."
}

Write-Host "`nДалее:" -ForegroundColor Cyan
Write-Host "  1. Запустите Ubuntu из меню Пуск, создайте пользователя Linux."
Write-Host "  2. Если VERSION=1: wsl --set-version <ИмяИзСписка> 2"
Write-Host "  3. Docker Desktop → Use the WSL 2 based engine."
Write-Host "Подробности: $root\OFFLINE_WSL_INSTALL.md"
