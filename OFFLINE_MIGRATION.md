# Оффлайн-миграция InfoLake

Полная инструкция по переносу проекта на сервер **без доступа к интернету**.

Связанные документы:

- [docker_instruction.md](docker_instruction.md) — детали `docker save` / `docker load`
- [tileserver_start_guide.md](tileserver_start_guide.md) — карта и `map.mbtiles`
- [map_layers_plan.md](map_layers_plan.md) — векторные слои карты (`infolake-unified`)

---

## 1. Обзор

| Компонент | Что переносится | Как |
|-----------|-----------------|-----|
| **Docker-образы** | backend, frontend, tileserver | `infolake_full_offline.tar` |
| **Код проекта** | репозиторий | USB / сеть / zip |
| **Карта** | `tileserver/data/map.mbtiles` | отдельно (не в git, 1–90+ ГБ) |
| **База данных** | PostgreSQL на хосте | dump или создание на месте |
| **Настройки** | `backend/.env` | вручную (не коммитить секреты) |

> **На оффлайн-машине никогда не запускайте:** `docker compose build`, `docker compose pull`, `docker pull`, `npm install` внутри контейнера без кэша.

---

## 2. Требования

### На обеих машинах

| Компонент | Версия |
|-----------|--------|
| Docker Desktop / Docker Engine | актуальная |
| docker compose | v2.22+ (для `--pull never`) |
| PostgreSQL | 14+ на **хосте** (не в Docker) |
| PowerShell | 5.1+ (Windows) |

### Свободное место на оффлайн-сервере

- Docker-архив: **~2–4 ГБ**
- Проект: **~500 МБ** (без `map.mbtiles`)
- `map.mbtiles`: **1–90+ ГБ** (planet или регион)
- PostgreSQL: по объёму данных

---

## 3. Подготовка на машине с интернетом

### 3.1. Обновить код

```powershell
cd D:\Artur\Проект\Lake_grok
git checkout develop__style
git pull
```

### 3.2. Собрать пакет (одна команда)

```powershell
.\export-offline.ps1
```

Скрипт выполняет:

1. `npm run build:map-style` — сборка `infolake-unified.json` и маппинга слоёв
2. `docker compose build` — backend и frontend (backend включает **gunicorn** для параллельных API-запросов)
3. Проверку наличия всех образов локально
4. `docker save` → **`infolake_full_offline.tar`**
5. Копию с датой: `infolake_full_offline_YYYYMMDD_HHMMSS.tar`
6. **`offline-package-manifest.txt`** — список образов и чек-лист

Образы в архиве:

- `infolake-backend:latest`
- `infolake-frontend:latest`
- `maptiler/tileserver-gl:latest`

Опции:

```powershell
.\export-offline.ps1 -SkipBuild      # образы уже собраны
.\export-offline.ps1 -NoCache        # полная пересборка
.\export-offline.ps1 -SkipMapStyle   # стиль карты не менялся
```

### 3.3. Проверить карту

Убедитесь, что файл существует:

```
tileserver/data/map.mbtiles
```

Если карты нет — см. [tileserver_start_guide.md](tileserver_start_guide.md) и `tileserver/scripts/download-data.ps1`.

### 3.4. Подготовить `.env` для целевой машины

Скопируйте `backend/.env` (или создайте из шаблона) с параметрами **оффлайн-сервера**:

- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SECRET_KEY`, `DEBUG=False` для production

---

## 4. Пакет для переноса

Скопируйте на носитель:

```
Lake_grok/
├── infolake_full_offline.tar          # обязательно (~2–4 ГБ), свежий export
├── offline-package-manifest.txt       # дата, ветка, размер
├── import-and-start.ps1               # запуск на offline
├── export-offline.ps1                 # только для следующих online-сборок
├── docker-compose.yml
├── OFFLINE_MIGRATION.md
├── OFFLINE_MIGRATION_MARKER_PALETTES.md
├── scripts/offline/                   # post-update, backup, migrate helpers
├── backend/                           # включая .env целевого сервера
├── frontend/
└── tileserver/
    ├── data/map.mbtiles               # обязательно для карты (не в git)
    ├── data/dem/                      # если используются зоны LOS
    ├── styles/infolake-unified.json   # после build:map-style
    └── config.json
```

**Не копировать:**

- `node_modules/`, `frontend/node_modules/` — есть в образе frontend
- `frontend/dist/` — при Vite dev в Docker не нужен
- `**/__pycache__/`
- старые `infolake_full_offline_*.tar` (кроме одного датированного бэкапа по желанию)
- `.git/` — по желанию

Перед копированием проверьте `offline-package-manifest.txt`: ветка `develop__style`, свежая дата генерации.

---

## 5. Развёртывание на оффлайн-сервере

### 5.1. Установить ПО (один раз, с интернета или с отдельного носителя)

- Docker Desktop / Docker Engine + compose v2
- PostgreSQL 14+

### 5.2. Скопировать проект

Распакуйте папку, например: `D:\InfoLake\Lake_grok`

Положите `infolake_full_offline.tar` в корень проекта.

### 5.3. PostgreSQL

Создайте БД и пользователя (пример):

```sql
CREATE USER infolake WITH PASSWORD 'your_password';
CREATE DATABASE infolake_db OWNER infolake;
```

Настройте `backend/.env` → `DB_HOST=host.docker.internal` (Windows + Docker Desktop).

### 5.4. Загрузить образы и запустить

```powershell
cd D:\InfoLake\Lake_grok
.\import-and-start.ps1
```

Или вручную:

```powershell
docker load -i infolake_full_offline.tar
docker compose up -d --no-build --pull never
docker compose ps
```

### 5.5. Миграции Django (первый запуск)

При старте backend entrypoint уже выполняет `migrate --noinput` (в том числе `accounts.0007` — уровень прав модулей `write_delete`). Повторный вызов безопасен:

```powershell
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

Опционально — примеры групп безопасности и иерархия объектов:

```powershell
docker compose exec backend python manage.py seed_security_groups
docker compose exec backend python manage.py rebuild_target_hierarchy
```

Подробнее по правам: [backend/docs/OFFLINE_AUTH.md](backend/docs/OFFLINE_AUTH.md).

---

## 6. Проверка

| Сервис | URL | Ожидание |
|--------|-----|----------|
| Frontend | http://localhost:5173 | карта, объекты |
| Backend API | http://localhost:8000/api/v1/ | JSON |
| TileServer | http://localhost:8080/ | список стилей |
| Unified style | http://localhost:8080/styles/infolake-unified/style.json | JSON 200 |
| Vector tiles | http://localhost:8080/data/openmaptiles/4/9/5.pbf | бинарный 200 |

Проверка векторного режима карты:

- В Network браузера при pan/zoom — запросы `.pbf`, **не** множество `/styles/overlay-*/...png`
- Переключение слоёв в панели — без новых tile-запросов

Откат на PNG-режим (если нужен):

```env
# docker-compose.yml → frontend → environment
VITE_MAP_VECTOR=false
```

После смены — пересоздать контейнер frontend: `docker compose up -d --no-build --force-recreate frontend`

---

## 7. Обновление существующей оффлайн-установки

> **Палитры маркеров стран (`Country.marker_palette`, миграция 0052):**  
> см. **[OFFLINE_MIGRATION_MARKER_PALETTES.md](OFFLINE_MIGRATION_MARKER_PALETTES.md)** и скрипты в `scripts/offline/`.

На **машине с интернетом:**

```powershell
git pull
.\export-offline.ps1
```

Перенесите новый `infolake_full_offline.tar` и обновлённые файлы проекта (код, `tileserver/styles/`, `infolake-unified.json`).

На **оффлайн-сервере:**

```powershell
docker compose down
docker load -i infolake_full_offline.tar
docker compose up -d --no-build --pull never
docker compose exec backend python manage.py migrate
```

Для релиза с палитрами маркеров (migrate + проверка):

```powershell
.\scripts\offline\post-update-offline.ps1
```

---

## 8. Частые проблемы

| Симптом | Решение |
|---------|---------|
| `No such image: maptiler/tileserver-gl:...` | Используйте тег `latest` из архива; выполните `docker load` |
| `pull access denied` / `unable to pull` | Запускайте только `--no-build --pull never` после `docker load` |
| Карта пустая | Проверьте `tileserver/data/map.mbtiles` |
| `style.json 404` | Перезапуск tileserver; проверьте `infolake-unified` в `config.json` |
| Backend не подключается к БД | `DB_HOST`, firewall, PostgreSQL `listen_addresses` |
| Карта «зависла» после создания user в admin | Старый образ с `runserver --nothreading` — пересобрать backend с Gunicorn; см. [backend/docs/ADMIN_USER_STABILITY.md](backend/docs/ADMIN_USER_STABILITY.md) |
| Ошибка векторной карты | TileServer :8080 доступен; `VITE_TILESERVER_URL` в compose |
| PDF-отчёт: `timeout of 15000ms` / `ECONNABORTED` | Нужен код с таймаутом генерации 360 с и `GUNICORN_TIMEOUT=300` в compose; обновите проект + перезапустите контейнеры (образы из свежего `export-offline.ps1`) |
| PDF/DOCX долго формируется | Нормально на слабом ПК; не прерывайте запрос до ~5 мин; уменьшите число разделов/стран в шаблоне |
| Страна не в «Зоны действия» (только ТТХ) | `docker compose exec backend python manage.py audit_equipment_zones`; в admin → «Параметры техники» заполните «Тип зоны действия» (км); во вкладке «Зоны действия» смотрите жёлтый блок диагностики; в DevTools проверьте `deployed_equipment[].zones` и `zone_issues` в `GET /api/v1/targets/` |
| Неясная версия кода на офлайн | В папке проекта: `git log -1` (ожидается актуальный коммит рабочей ветки, напр. `develop_report`) |

---

## 9. Чек-лист

### Online (подготовка)

- [ ] `git pull`, ветка актуальна
- [ ] `.\export-offline.ps1` без ошибок
- [ ] `infolake_full_offline.tar` создан
- [ ] `map.mbtiles` на месте
- [ ] `backend/.env` для целевого сервера подготовлен

### Offline (развёртывание)

- [ ] Docker + PostgreSQL установлены
- [ ] Проект и `.tar` скопированы
- [ ] `.\import-and-start.ps1` — контейнеры `Up`
- [ ] `createsuperuser` выполнен (migrate уже в entrypoint)
- [ ] Опционально: `seed_security_groups`
- [ ] Frontend :5173, API :8000, карта отображается

---

## 10. Скрипты

| Скрипт | Где запускать | Назначение |
|--------|---------------|------------|
| [export-offline.ps1](export-offline.ps1) | Online | Сборка + `docker save` |
| [import-and-start.ps1](import-and-start.ps1) | Offline | `docker load` + `up --no-build --pull never` |
| [scripts/offline/prepare-marker-palette-release.ps1](scripts/offline/prepare-marker-palette-release.ps1) | Online | Релиз с палитрами: тесты + export-offline |
| [scripts/offline/post-update-offline.ps1](scripts/offline/post-update-offline.ps1) | Offline | Обновление + migrate палитр + verify |
| [OFFLINE_MIGRATION_MARKER_PALETTES.md](OFFLINE_MIGRATION_MARKER_PALETTES.md) | — | Палитры маркеров, миграция 0052 |
| `python manage.py audit_equipment_zones` | Backend | Диагностика зон из ТТХ техники (`--country`, `--username`) |
