# Оффлайн-развёртывание InfoLake

Проект рассчитан на работу **без интернета** на целевой машине. Все зависимости скачиваются заранее на машине с сетью.

## Быстрый старт (машина с интернетом)

### Windows (PowerShell)

```powershell
cd D:\Artur\Проект\Lake_grok
.\scripts\prepare-offline.ps1
```

### Linux / macOS

```bash
cd /path/to/Lake_grok
chmod +x scripts/prepare-offline.sh
./scripts/prepare-offline.sh
```

Скрипт выполняет:

1. `npm ci` во frontend + копирование Leaflet-иконок в `frontend/public/leaflet/`
2. `pip download` Python-пакетов в `offline/python-wheels/`
3. `docker pull` + `docker compose build` (образы backend, frontend, tileserver)
4. `docker save` → `offline/infolake_full_offline.tar`

## Перенос на офлайн-сервер

1. Скопируйте на целевую машину:
   - весь каталог проекта (кроме `node_modules`, `frontend/dist`)
   - `offline/infolake_full_offline.tar`
   - `offline/python-wheels/` (резерв, если понадобится пересборка backend без сети)
   - файлы тайлов `tileserver/*.mbtiles` (не в git — переносятся отдельно)

2. На целевой машине:

```powershell
docker load -i offline\infolake_full_offline.tar
docker compose up -d --no-build
```

3. PostgreSQL должен быть доступен на хосте (см. `DB_HOST` в `docker-compose.yml`).

4. Откройте в браузере: `http://localhost:5173`

## Что уже локально (без CDN)

| Ресурс | Расположение |
|--------|----------------|
| Шрифт Roboto | `frontend/src/assets/fonts/*.woff2` |
| Leaflet CSS | `node_modules/leaflet` (в образе frontend) |
| Leaflet marker icons | `frontend/public/leaflet/` |
| SVG sprite | `frontend/public/sprite.svg` |
| Тайлы карты | `tileserver/` (mbtiles отдельно) |
| Глифы тайлсервера | `tileserver/fonts/` |

## Переменные окружения

Создайте `backend/.env` на целевой машине (не в git). Пример полей: `SECRET_KEY`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`.

Для доступа по IP в LAN измените в `docker-compose.yml`:

- `VITE_API_URL`
- `VITE_TILESERVER_URL`
- `VITE_HMR_HOST` (только для dev-режима)

После смены URL пересоберите frontend-образ на машине с интернетом.

## Важно

- **Никогда** не запускайте `docker compose build` на машине без интернета.
- Используйте только `docker compose up -d --no-build`.
- Образ `maptiler/tileserver-gl:latest` включён в `infolake_full_offline.tar`.

## Ручное обновление vendor-ассетов

```powershell
cd frontend
npm ci
node ..\scripts\copy-vendor-assets.mjs
```
