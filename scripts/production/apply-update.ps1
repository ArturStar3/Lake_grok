# apply-update.ps1
# Применение обновления InfoLake на production/оффлайн-сервере.
# Запускается двойным щелчком apply-update.bat — оператору не нужны навыки Docker/Git.
#
# Ожидает рядом с собой (в той же папке):
#   update.bundle, images.tar, VERSION
#
# Проект Lake_grok ищется автоматически (родительская папка или соседняя).

param(
    [string]$ProjectRoot = "",
    [string]$PackageDir = ""
)

$ErrorActionPreference = "Stop"
$script:LogFile = $null
$script:PrevCommit = $null
$script:RollbackTag = $null
$script:DidPull = $false
$script:DidLoadImages = $false

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Host $line -ForegroundColor $Color
    if ($script:LogFile) {
        Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
    }
}

function Write-Banner {
    param([string]$Title, [string]$Color)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor $Color
    Write-Host "  $Title" -ForegroundColor $Color
    Write-Host ("=" * 60) -ForegroundColor $Color
    Write-Host ""
}

function Get-ComposeArgs {
    return @("-f", "docker-compose.yml", "-f", "docker-compose.server.yml")
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
    $all = (Get-ComposeArgs) + $ComposeArgs
    & docker compose @all
    return $LASTEXITCODE
}

function Test-HttpOk {
    param([string]$Url, [int]$TimeoutSec = 8)
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Wait-ServicesHealthy {
    param([int]$Attempts = 30, [int]$DelaySec = 5)
    Write-Log "Проверка сервисов (до $($Attempts * $DelaySec) с)..." "Cyan"
    for ($i = 1; $i -le $Attempts; $i++) {
        $fe = Test-HttpOk "http://localhost/"
        $be = Test-HttpOk "http://localhost/api/v1/"
        $ts = Test-HttpOk "http://localhost/tiles/"
        Write-Log ("  попытка {0}/{1}: nginx={2} api={3} tiles={4}" -f $i, $Attempts, $fe, $be, $ts) "DarkGray"
        if ($fe -and $be -and $ts) { return $true }
        Start-Sleep -Seconds $DelaySec
    }
    return $false
}

function Find-ProjectRoot {
    param([string]$Hint, [string]$FromPackage)
    if ($Hint -and (Test-Path (Join-Path $Hint "docker-compose.yml"))) {
        return (Resolve-Path $Hint).Path
    }
    # Package inside Lake_grok/updates/... or Lake_grok/scripts/production/...
    $candidates = @(
        (Join-Path $FromPackage ".."),
        (Join-Path $FromPackage "..\.."),
        (Join-Path $FromPackage "..\..\.."),
        (Join-Path $FromPackage "..\Lake_grok"),
        (Join-Path $FromPackage ".\Lake_grok")
    )
    foreach ($c in $candidates) {
        $resolved = $null
        try { $resolved = Resolve-Path $c -ErrorAction SilentlyContinue } catch { }
        if ($resolved -and (Test-Path (Join-Path $resolved "docker-compose.yml")) -and (Test-Path (Join-Path $resolved ".git"))) {
            return $resolved.Path
        }
    }
    return $null
}

function Invoke-Rollback {
    param([string]$Reason)
    Write-Banner "ОШИБКА — ВЫПОЛНЕН ОТКАТ" "Red"
    Write-Log "Причина: $Reason" "Red"

    Set-Location $script:ProjectRoot

    if ($script:DidPull -and $script:PrevCommit) {
        Write-Log "Откат кода: git reset --hard $($script:PrevCommit)" "Yellow"
        git reset --hard $script:PrevCommit 2>&1 | ForEach-Object { Write-Log "  $_" "DarkGray" }
    }

    if ($script:DidLoadImages -and $script:RollbackTag) {
        Write-Log "Откат образов: tag rollback -> latest ($($script:RollbackTag))" "Yellow"
        docker tag "infolake-backend:$($script:RollbackTag)" "infolake-backend:latest" 2>$null
        docker tag "infolake-frontend:$($script:RollbackTag)" "infolake-frontend:latest" 2>$null
    }

    Write-Log "Перезапуск контейнеров предыдущей версии..." "Yellow"
    $null = Invoke-Compose @("up", "-d", "--no-build", "--pull", "never", "--force-recreate")
    Start-Sleep -Seconds 8
    $ok = Wait-ServicesHealthy -Attempts 18 -DelaySec 5
    if ($ok) {
        Write-Log "Предыдущая версия снова работает." "Green"
    } else {
        Write-Log "ВНИМАНИЕ: после отката сервисы всё ещё не отвечают. Сообщите разработчику." "Red"
    }

    Write-Host ""
    Write-Host "НЕ пытайтесь чинить систему самостоятельно." -ForegroundColor Red
    Write-Host "Отправьте разработчику файл журнала:" -ForegroundColor Yellow
    Write-Host "  $($script:LogFile)" -ForegroundColor Cyan
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
try {
    if (-not $PackageDir) {
        $PackageDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
    }
    $PackageDir = (Resolve-Path $PackageDir).Path

    $bundle = Join-Path $PackageDir "update.bundle"
    $imagesTar = Join-Path $PackageDir "images.tar"
    $versionFile = Join-Path $PackageDir "VERSION"

    if (-not (Test-Path $bundle)) { throw "Не найден update.bundle рядом со скриптом: $PackageDir" }
    if (-not (Test-Path $imagesTar)) { throw "Не найден images.tar рядом со скриптом: $PackageDir" }
    if (-not (Test-Path $versionFile)) { throw "Не найден VERSION рядом со скриптом: $PackageDir" }

    $newVersion = (Get-Content $versionFile -Raw).Trim()

    $script:ProjectRoot = Find-ProjectRoot -Hint $ProjectRoot -FromPackage $PackageDir
    if (-not $script:ProjectRoot) {
        throw "Не найдена папка проекта Lake_grok (с docker-compose.yml и .git). Укажите -ProjectRoot."
    }

    Set-Location $script:ProjectRoot

    $logsDir = Join-Path $script:ProjectRoot "logs"
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $script:LogFile = Join-Path $logsDir "update-$stamp.log"

    Write-Banner "InfoLake — применение обновления v$newVersion" "Cyan"
    Write-Log "Проект: $($script:ProjectRoot)"
    Write-Log "Пакет:  $PackageDir"
    Write-Log "Журнал: $($script:LogFile)"

    # Preflight
    Write-Log "Проверка Docker..." "Cyan"
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker Desktop не запущен. Запустите Docker и повторите." }

    git rev-parse --is-inside-work-tree 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Папка проекта не является git-репозиторием." }

    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne "production") {
        Write-Log "Текущая ветка: $branch (ожидалась production)" "Yellow"
        Write-Log "Переключаемся на production..." "Yellow"
        git checkout production 2>&1 | ForEach-Object { Write-Log "  $_" "DarkGray" }
        if ($LASTEXITCODE -ne 0) { throw "Не удалось переключиться на ветку production." }
    }

    $dirty = git status --porcelain
    if ($dirty) {
        Write-Log "В проекте есть незакоммиченные изменения:" "Yellow"
        $dirty | ForEach-Object { Write-Log "  $_" "DarkGray" }
        throw "Обновление прервано: сначала сообщите разработчику о локальных правках (не удаляйте их)."
    }

    $script:PrevCommit = (git rev-parse HEAD).Trim()
    $oldVersion = "unknown"
    $localVersionFile = Join-Path $script:ProjectRoot "VERSION"
    if (Test-Path $localVersionFile) {
        $oldVersion = (Get-Content $localVersionFile -Raw).Trim()
    }
    Write-Log "Текущая версия: $oldVersion ($($script:PrevCommit.Substring(0,8)))"
    Write-Log "Новая версия:   $newVersion"

    # DB backup
    Write-Log "Резервная копия базы данных..." "Cyan"
    $backupScript = Join-Path $script:ProjectRoot "scripts\offline\backup-postgres-before-migrate.ps1"
    if (Test-Path $backupScript) {
        & $backupScript -ProjectRoot $script:ProjectRoot
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Предупреждение: бэкап БД не удался (код $LASTEXITCODE). Продолжаем — при сбое migrate восстановление вручную может быть недоступно." "Yellow"
        } else {
            Write-Log "Бэкап БД создан в папке backups\" "Green"
        }
    } else {
        Write-Log "Скрипт бэкапа не найден — пропускаем." "Yellow"
    }

    # Tag current images for rollback
    $script:RollbackTag = "rollback-$stamp"
    Write-Log "Сохранение текущих образов как $($script:RollbackTag)..." "Cyan"
    docker image inspect "infolake-backend:latest" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        docker tag "infolake-backend:latest" "infolake-backend:$($script:RollbackTag)"
        docker tag "infolake-frontend:latest" "infolake-frontend:$($script:RollbackTag)"
    } else {
        Write-Log "Текущие образы не найдены (первый запуск?) — откат образов будет ограничен." "Yellow"
        $script:RollbackTag = $null
    }

    # Git pull from bundle (fast-forward only)
    Write-Log "Применение кода из update.bundle..." "Cyan"
    git bundle verify $bundle 2>&1 | ForEach-Object { Write-Log "  $_" "DarkGray" }
    if ($LASTEXITCODE -ne 0) { throw "update.bundle повреждён или несовместим с этим репозиторием." }

    git pull --ff-only $bundle production 2>&1 | ForEach-Object { Write-Log "  $_" "DarkGray" }
    if ($LASTEXITCODE -ne 0) {
        throw "Не удалось применить код (нужен fast-forward). Сообщите разработчику — локальная история расходится."
    }
    $script:DidPull = $true
    Write-Log "Код обновлён до $(git rev-parse --short HEAD)" "Green"

    # Docker load
    Write-Log "Загрузка Docker-образов (это может занять несколько минут)..." "Cyan"
    docker load -i $imagesTar 2>&1 | ForEach-Object { Write-Log "  $_" "DarkGray" }
    if ($LASTEXITCODE -ne 0) { throw "docker load завершился с ошибкой." }
    $script:DidLoadImages = $true
    Write-Log "Образы загружены." "Green"

    # Recreate containers
    Write-Log "Перезапуск контейнеров..." "Cyan"
    $exit = Invoke-Compose @("up", "-d", "--no-build", "--pull", "never", "--force-recreate")
    if ($exit -ne 0) { throw "docker compose up завершился с кодом $exit" }

    Start-Sleep -Seconds 10

    # Migrate + seed (entrypoint also migrates, but we ensure explicitly)
    Write-Log "Миграции базы данных..." "Cyan"
    $exit = Invoke-Compose @("exec", "-T", "backend", "python", "manage.py", "migrate", "--noinput")
    if ($exit -ne 0) { throw "migrate завершился с кодом $exit" }

    Write-Log "Обновление системных шаблонов отчётов..." "Cyan"
    $exit = Invoke-Compose @("exec", "-T", "backend", "python", "manage.py", "seed_report_templates")
    if ($exit -ne 0) {
        Write-Log "Предупреждение: seed_report_templates код $exit (не критично для отката)." "Yellow"
    }

    # Healthcheck
    $healthy = Wait-ServicesHealthy -Attempts 30 -DelaySec 5
    if (-not $healthy) {
        throw "Сервисы не ответили после обновления (frontend/backend/tileserver)."
    }

    Write-Banner "ОБНОВЛЕНИЕ ЗАВЕРШЕНО" "Green"
    Write-Log "Версия $oldVersion → $newVersion" "Green"
    Write-Log "App:        http://localhost/"
    Write-Log "API:        http://localhost/api/v1/"
    Write-Log "Admin:      http://localhost/admin/"
    Write-Log "Tiles:      http://localhost/tiles/"
    Write-Log "Журнал: $($script:LogFile)"
    Write-Host ""
    Write-Host "Можно пользоваться системой как обычно." -ForegroundColor Green
    Write-Host ""
    exit 0
}
catch {
    $msg = $_.Exception.Message
    if (-not $msg) { $msg = "$_" }
    Write-Log "Сбой: $msg" "Red"
    if ($script:ProjectRoot) {
        Invoke-Rollback -Reason $msg
    } else {
        Write-Banner "ОШИБКА (откат невозможен — проект не найден)" "Red"
        Write-Host $msg -ForegroundColor Red
    }
    exit 1
}
