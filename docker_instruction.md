# Инструкции по экспорту и импорту Docker-образов (оффлайн-развёртывание)

> **Главная инструкция по миграции на оффлайн-сервер:**  
> **[OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md)**

> Дополнительно (каталог вооружения): [weaponlist_import.md](weaponlist_import.md)

## Введение

Этот документ описывает процесс полностью оффлайн-развёртывания проекта на целевой машине, где **нет доступа к интернету**.

Все образы собираются на машине разработчика (с интернетом), сохраняются в один архивный файл (`.tar`) и переносятся на целевую машину.

### Используемые образы

- `infolake-backend:latest` — backend (Django)
- `infolake-frontend:latest` — frontend (Vite/React)
- `maptiler/tileserver-gl:latest` — тайловый сервер

---

## Требования

### На машине разработчика (с интернетом)
- Docker Desktop / Docker Engine
- docker compose v2+
- PowerShell (рекомендуется) или bash/cmd

### На целевой машине (без интернета)
- Docker Desktop / Docker Engine
- docker compose v2+
- PowerShell (рекомендуется)

---

## Полный workflow

### 1. На машине с интернетом (сборка и экспорт)

1. Перейдите в корень проекта:
   ```powershell
   cd d:\Artur\Проект\lake_grok
   ```

2. Выполните сборку образов:
   ```powershell
   docker compose build
   ```

   (При необходимости полностью чистая сборка):
   ```powershell
   docker compose build --no-cache
   ```

3. Сохраните все образы в архив:

   **Рекомендуемый способ** — взять образы прямо из `docker-compose.yml` (самый надёжный):
   ```powershell
   $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
   $tarName = "infolake_full_offline_$timestamp.tar"

   $images = (Get-Content docker-compose.yml | Select-String -Pattern '^\s+image:') -replace '.*image:\s*', ''

   docker save -o $tarName $images
   ```

   Альтернатива (через `docker compose images`):
   ```powershell
   $images = docker compose images --format json |
             ConvertFrom-Json |
             ForEach-Object { "$($_.Repository):$($_.Tag)" }

   docker save -o $tarName $images
   ```

   Явно (жёстко заданный список):
   ```powershell
   docker save -o $tarName `
       infolake-backend:latest `
       infolake-frontend:latest `
       maptiler/tileserver-gl:latest
   ```

   Готовый файл: **`infolake_full_offline.tar`** (и копия с датой `infolake_full_offline_YYYYMMDD_HHMMSS.tar`).

   Скрипт [export-offline.ps1](export-offline.ps1) создаёт оба файла автоматически:
   ```powershell
   .\export-offline.ps1
   ```

4. Скопируйте полученный `.tar` файл на целевую машину (флешка, внешний диск, локальная сеть и т.д.).

---

### 2. На целевой машине (без интернета)

1. Скопируйте `.tar` файл в удобную папку.

2. Загрузите образы из архива:
   ```powershell
   docker load -i infolake_full_offline_20250618_153045.tar
   ```

3. Запустите контейнеры **обязательно** с флагами `--no-build --pull never`:
   ```powershell
   docker compose up -d --no-build --pull never
   ```

   Или используйте скрипт:
   ```powershell
   .\import-and-start.ps1
   ```

4. Проверьте статус:
   ```powershell
   docker compose ps
   ```

---

## Готовые PowerShell-скрипты

### export-offline.ps1 (на машине с интернетом)

Готовый скрипт уже лежит в корне проекта: [export-offline.ps1](export-offline.ps1)

Или создайте вручную:

```powershell
# export-offline.ps1
param(
    [string]$OutputDir = ".",
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

Write-Host "=== Сборка образов (оффлайн-экспорт) ===" -ForegroundColor Cyan

$buildArgs = @()
if ($NoCache) { $buildArgs += "--no-cache" }

docker compose build @buildArgs

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$tarName = "infolake_full_offline_$timestamp.tar"
$fullPath = Join-Path $OutputDir $tarName

Write-Host "`nСохраняем образы в файл: $fullPath" -ForegroundColor Yellow

Write-Host "Получаем список образов из docker-compose.yml..." -ForegroundColor DarkGray
$images = (Get-Content docker-compose.yml | Select-String -Pattern '^\s+image:') -replace '.*image:\s*', ''

if (-not $images) {
    Write-Host "Не удалось найти образы в docker-compose.yml" -ForegroundColor Red
    exit 1
}

docker save -o $fullPath $images

$size = (Get-Item $fullPath).Length / 1MB
Write-Host "`nГотово!" -ForegroundColor Green
Write-Host "Файл: $fullPath"
Write-Host ("Размер: {0:N1} MB" -f $size)
Write-Host "`nСкопируй этот .tar файл на целевую машину."
```

**Использование:**
```powershell
.\export-offline.ps1
# или с чистой сборкой
.\export-offline.ps1 -NoCache -OutputDir "D:\backup"
```

### import-and-start.ps1 (на целевой машине)

Готовый скрипт уже лежит в корне проекта: [import-and-start.ps1](import-and-start.ps1)

Или создайте вручную:

```powershell
# import-and-start.ps1
param(
    [string]$TarFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $TarFile) {
    $TarFile = Get-ChildItem -Filter "infolake_full_offline_*.tar" | 
               Sort-Object LastWriteTime -Descending | 
               Select-Object -First 1 | 
               Select-Object -ExpandProperty FullName
}

if (-not (Test-Path $TarFile)) {
    Write-Host "Файл архива не найден!" -ForegroundColor Red
    exit 1
}

Write-Host "Загружаем образы из: $TarFile" -ForegroundColor Cyan
docker load -i $TarFile

Write-Host "`nЗапускаем контейнеры (--no-build)..." -ForegroundColor Cyan
docker compose up -d --no-build

Write-Host "`nСтатус:" -ForegroundColor Green
docker compose ps
```

**Использование:**
```powershell
.\import-and-start.ps1
# или явно указать файл
.\import-and-start.ps1 -TarFile "infolake_full_offline_20250618_153045.tar"
```

---

## Полезные команды

### Проверка на целевой машине

```powershell
# Список образов
docker images

# Статус контейнеров
docker compose ps

# Логи (все сервисы)
docker compose logs -f

# Логи только backend
docker compose logs -f backend

# Перезапуск
docker compose restart

# Остановка
docker compose down
```

### Получение списка образов (для docker save / скриптов)

**Лучший способ (рекомендуется):** парсить прямо из `docker-compose.yml`

**PowerShell:**
```powershell
$images = (Get-Content docker-compose.yml | Select-String -Pattern '^\s+image:') -replace '.*image:\s*', ''

docker save -o backup.tar $images
```

**Bash:**
```bash
images=$(grep -E '^\s+image:' docker-compose.yml | sed -E 's/.*image:\s*//')
docker save -o backup.tar $images
```

**Альтернатива — через `docker compose` (только если контейнеры/образы уже собраны):**

**PowerShell:**
```powershell
$images = docker compose images --format json |
          ConvertFrom-Json |
          ForEach-Object { "$($_.Repository):$($_.Tag)" }

docker save -o backup.tar $images
```

**Bash (требуется `jq`):**
```bash
images=$(docker compose images --format json | jq -r '.[].Image')
docker save -o backup.tar $images
```

> **Предупреждение**:
> - `docker compose images --format "{{.Image}}"` **не работает** (Compose поддерживает только `table` и `json`).
> - Синтаксис `$var = command` работает **только в PowerShell**. В bash это вызывает `bash: =: command not found`.

### Обновление образов на целевой машине

1. На машине с интернетом соберите и экспортируйте новые образы (новый `.tar`).
2. Скопируйте новый `.tar` на целевую машину.
3. Выполните:
   ```powershell
   docker load -i новый_файл.tar
   docker compose up -d --no-build
   ```

---

## Важные замечания

### Обязательно используйте `--no-build`

Если запустить `docker compose up -d` **без** флага `--no-build`, Docker Compose может попытаться пересобрать образы. На машине без интернета это приведёт к ошибкам (`apt-get update`, `npm install` и т.д.).

### pull_policy: never

В текущем `docker-compose.yml` для всех сервисов явно указан:
```yaml
pull_policy: never
```
Это дополнительная защита от попыток скачать образы из интернета.

### Что происходит при `docker save`

Команда `docker save` сохраняет **все слои** образа, включая базовые (`python:3.12-slim`, `node:20-alpine`). После `docker load` эти слои будут доступны локально.

### Размер архива

Ожидаемый размер `infolake_full_offline_*.tar` — от 300 МБ до нескольких гигабайт (зависит от node_modules и медиа-файлов).

### Обновление кода

После изменений в коде:
- Пересоберите образы на машине с интернетом.
- Создайте новый архив.
- Загрузите его на целевую машину.

### Структура проекта на целевой машине

На целевой машине должна быть та же структура папок, что и на машине разработки:
- `docker-compose.yml`
- `backend/`, `frontend/`, `tileserver/` (для volumes)
- `.env` файлы при необходимости

---

## Частые проблемы и решения

| Проблема                              | Решение |
|---------------------------------------|---------|
| `docker compose up` пытается собрать | Используйте `--no-build` |
| Образ не находится после `docker load` | Проверьте `docker images` |
| Ошибки с путями на Windows            | Используйте одинаковую структуру папок |
| Frontend не видит API                 | Убедитесь, что `VITE_API_URL` был правильным во время сборки |
| Нужно обновить только один сервис     | Загрузите весь архив заново (или сохраняйте отдельные образы) |
| `bash: =: command not found` при `$images = ...` | Это синтаксис PowerShell. В bash: `images=$(grep ...)` или `images=$(docker compose images --format json \| jq ...)` |
| `docker compose images --format "{{.Image}}"` не работает | Compose поддерживает только `--format json` или `--format table`. Лучше парсить `image:` из самого docker-compose.yml |

---

## Дополнительно

- Текущие образы жёстко заданы в `docker-compose.yml`:
  - `infolake-backend:latest`
  - `infolake-frontend:latest`
  - `maptiler/tileserver-gl:latest`

- При необходимости можно изменить теги в `docker-compose.yml` и в командах сохранения/загрузки.

- Для production-окружения рекомендуется рассмотреть отдельный production Dockerfile для frontend (с `npm run build` + Nginx).

---

**Дата последнего обновления:** 2026-06-26

Этот документ описывает Docker save/load. Полный workflow оффлайн-миграции — в [weaponlist_import.md](weaponlist_import.md).