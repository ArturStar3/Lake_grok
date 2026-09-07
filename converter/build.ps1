# Сборка InfoLakeCoordConverter.exe (Windows, без правок InfoLake).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "Python не найден в PATH. Установите Python 3.10+ и повторите." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".\venv\Scripts\python.exe")) {
    Write-Host "Creating venv..." -ForegroundColor Cyan
    python -m venv venv
}

& .\venv\Scripts\python.exe -m pip install --upgrade pip
& .\venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& .\venv\Scripts\pyinstaller.exe --noconfirm --clean --onefile --windowed `
    --name InfoLakeCoordConverter `
    --hidden-import coords `
    --hidden-import xlsx_io `
    --hidden-import openpyxl `
    app.py

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$exe = Join-Path $PSScriptRoot "dist\InfoLakeCoordConverter.exe"
if (Test-Path $exe) {
    Write-Host "Done: $exe" -ForegroundColor Green
} else {
    Write-Host "PyInstaller finished, but exe was not found." -ForegroundColor Red
    exit 1
}
