# Скрипт загрузки данных для офлайн TileServer GL
# Использование: .\scripts\download-data.ps1 [-Region europe|asia|planet|demo]

param(
    [ValidateSet("demo", "central-america", "europe", "asia", "planet")]
    [string]$Region = "demo"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root "data"

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
}

$Sources = @{
    "demo" = @{
        Url = "https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/zurich_switzerland.mbtiles"
        Size = "~25 MB"
        Note = "Демо-регион (Цюрих). Для глобальных границ используйте europe/asia/planet."
    }
    "central-america" = @{
        Url = "https://www.limaps.org/MBTiles/2024-10-08-central-america.osm.mbtiles"
        Size = "~1.3 GB"
        Note = "Регион Центральная Америка + глобальный контекст на малых зумах."
    }
    "europe" = @{
        Url = "https://www.limaps.org/MBTiles/2024-10-08-europe.osm.mbtiles"
        Size = "~30 GB"
        Note = "Европа. Границы стран и населённые пункты."
    }
    "asia" = @{
        Url = "https://www.limaps.org/MBTiles/2024-10-08-asia.osm.mbtiles"
        Size = "~36 GB"
        Note = "Азия (включая Россию, СНГ, Китай)."
    }
    "planet" = @{
        Url = "https://object.data.gouv.fr/openmaptiles/planet.mbtiles"
        Size = "~94 GB"
        Note = "Весь мир. Требует ~100 ГБ свободного места."
    }
}

function Download-File($Url, $Dest) {
    Write-Host "Загрузка: $Url"
    Write-Host "Сохранение: $Dest"
    curl.exe -L --progress-bar -C - -o $Dest $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Ошибка загрузки (curl exit code: $LASTEXITCODE)"
    }
}

# 1. Шрифты и спрайты из test_data (если ещё не загружены)
$FontsMarker = Join-Path $Root "fonts\Open Sans Regular\0-255.pbf"
if (-not (Test-Path $FontsMarker)) {
    $TestDataZip = Join-Path $Root "test_data.zip"
    if (-not (Test-Path $TestDataZip)) {
        Write-Host "Загрузка test_data.zip (шрифты, спрайты)..."
        Download-File "https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip" $TestDataZip
    }
    Write-Host "Распаковка шрифтов и спрайтов..."
    Expand-Archive -Path $TestDataZip -DestinationPath $Root -Force
    # test_data содержит fonts/, sprites/ в корне архива
}

# 2. MBTiles
$Source = $Sources[$Region]
$MbtilesPath = Join-Path $DataDir "map.mbtiles"

Write-Host ""
Write-Host "Регион: $Region ($($Source.Size))"
Write-Host $Source.Note
Write-Host ""

if (Test-Path $MbtilesPath) {
    $Existing = (Get-Item $MbtilesPath).Length
    if ($Existing -gt 1MB) {
        Write-Host "Файл map.mbtiles уже существует ($([math]::Round($Existing/1MB, 1)) MB). Пропуск."
        Write-Host "Удалите data\map.mbtiles для повторной загрузки."
        exit 0
    }
}

Download-File $Source.Url $MbtilesPath

$FinalSize = (Get-Item $MbtilesPath).Length
Write-Host "Готово! map.mbtiles: $([math]::Round($FinalSize/1MB, 1)) MB"
Write-Host "Запуск: docker compose up -d"