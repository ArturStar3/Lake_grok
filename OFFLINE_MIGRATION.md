# Оффлайн-миграция InfoLake

Полная инструкция по переносу проекта на сервер **без доступа к интернету**.

Связанные документы:

- [docker_instruction.md](docker_instruction.md) — детали `docker save` / `docker load`
- [tileserver_start_guide.md](tileserver_start_guide.md) — карта и `map.mbtiles`
- [map_layers_plan.md](map_layers_plan.md) — векторные слои карты (`infolake-unified`)
- [OFFLINE_DIAGNOSTICS.md](OFFLINE_DIAGNOSTICS.md) — диагностика зависаний nginx/Docker на офлайн-ПК
- [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md) / [OFFLINE_DEPLOY_DEV.md](OFFLINE_DEPLOY_DEV.md) — запуск prod/dev через nginx
- [OFFLINE_DEPLOY_PROD_POSTGRES.md](OFFLINE_DEPLOY_PROD_POSTGRES.md) — production + **PostgreSQL 17 в Docker**
- [OFFLINE_DEPLOY_DIRECT.md](OFFLINE_DEPLOY_DIRECT.md) — запуск **без nginx** (порты 5173 / 8000 / 8080)

---

## 1. Обзор

| Компонент | Что переносится | Как |
|-----------|-----------------|-----|
| **Docker-образы** | backend, frontend/nginx/static, tileserver, postgres:17 | `infolake_full_offline_{prod,dev,direct,prod_postgres}.tar` |
| **Код проекта** | репозиторий | USB / сеть / zip |
| **Карта** | `tileserver/data/map.mbtiles` | отдельно (не в git, 1–90+ ГБ) |
| **База данных** | PostgreSQL на хосте **или** контейнер `postgres:17` | dump / создание на месте / пустой volume |
| **Настройки** | `backend/.env` | вручную (не коммитить секреты) |

Режимы запуска на офлайн-ПК:

| Режим | Архив | Точка входа | Документ |
|-------|--------|-------------|----------|
| Production + nginx | `infolake_full_offline_prod.tar` | `:80` / `:8080` | [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md) |
| Production + nginx + Postgres в Docker | `infolake_full_offline_prod_postgres.tar` | `:80` / `:8080` | [OFFLINE_DEPLOY_PROD_POSTGRES.md](OFFLINE_DEPLOY_PROD_POSTGRES.md) |
| Dev + nginx | `infolake_full_offline_dev.tar` | `:80` / `:8080` | [OFFLINE_DEPLOY_DEV.md](OFFLINE_DEPLOY_DEV.md) |
| **Без nginx** | `infolake_full_offline_direct.tar` | UI `:5173`, API `:8000`, tiles `:8080` | [OFFLINE_DEPLOY_DIRECT.md](OFFLINE_DEPLOY_DIRECT.md) |

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
2. `docker compose -f docker-compose.yml -f docker-compose.server.yml build` — backend и **production nginx** (`Dockerfile.server`: `npm run build` + nginx, без bind-mount)
3. Проверку наличия всех образов локально
4. `docker save` → **`infolake_full_offline.tar`**
5. Копию с датой: `infolake_full_offline_YYYYMMDD_HHMMSS.tar`
6. **`offline-package-manifest.txt`** — список образов и чек-лист

Образы в архиве:

- `infolake-backend:latest`
- `infolake-nginx:latest`
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
├── docker-compose.server.yml          # production nginx (статика + reverse-proxy)
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

- `node_modules/`, `frontend/node_modules/` — есть в образе frontend (dev) / nginx (prod)
- `frontend/dist/` — уже внутри production-образа nginx (`Dockerfile.server`); bind-mount исходников на оффлайн не используется
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
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

> **Важно:** оффлайн всегда запускайте с `docker-compose.server.yml`. Базовый `docker-compose.yml` + профиль `dev` — для разработки (`docker compose --profile dev up`); на сервере используйте production override без профиля.

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
| App (nginx) | http://localhost/ | карта, объекты |
| Backend API | http://localhost/api/v1/ | JSON |
| Admin | http://localhost/admin/ | Django admin |
| TileServer | http://localhost/tiles/ | список стилей |
| Unified style | http://localhost/tiles/styles/infolake-unified/style.json | JSON 200 |
| Vector tiles | http://localhost/tiles/data/openmaptiles/4/9/5.pbf | бинарный 200 |
| Media | http://localhost/media/markers/ | SVG/файлы 200 |

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

> **Production-сервер с ограниченным доступом:** используйте пакет
> `infolake_update_vX.Y.Z.tar` (или папку) и **`apply-update.bat`**
> (см. [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md) и руководство администратора).
> Ниже — ручной/классический путь через полный tar.

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
docker compose -f docker-compose.yml -f docker-compose.server.yml down
docker load -i infolake_full_offline.tar
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never
docker compose -f docker-compose.yml -f docker-compose.server.yml exec backend python manage.py migrate
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
| Ошибка векторной карты | nginx `/tiles/` доступен; `VITE_TILESERVER_URL=/tiles` в compose |
| PDF-отчёт: `timeout of 15000ms` / `ECONNABORTED` | Нужен код с таймаутом генерации 360 с и `GUNICORN_TIMEOUT=300` в compose; обновите проект + перезапустите контейнеры (образы из свежего `export-offline.ps1`) |
| PDF/DOCX долго формируется | Нормально на слабом ПК; не прерывайте запрос до ~5 мин; уменьшите число разделов/стран в шаблоне |
| Frontend «завис», `docker kill` / `compose down` не помогают, только reboot | Скорее WSL2/Docker Desktop thrashing (память), не баг React. См. раздел **8.1** ниже |
| nginx «завис», `docker kill` не отвечает (Docker без WSL2 / Hyper-V) | Диск/логи/память VM **или stale DNS upstream**. См. раздел **8.2** и [OFFLINE_DIAGNOSTICS.md §2.1](OFFLINE_DIAGNOSTICS.md) |
| Страна не в «Зоны действия» (только ТТХ) | `docker compose exec backend python manage.py audit_equipment_zones`; в admin → «Параметры техники» заполните «Тип зоны действия» (км); во вкладке «Зоны действия» смотрите жёлтый блок диагностики; в DevTools проверьте `deployed_equipment[].zones` и `zone_issues` в `GET /api/v1/targets/` |
| `bind: ... 0.0.0.0:80` / nginx не стартует (Windows) | Порт 80 занят HTTP.sys/IIS. В корне проекта создайте `.env` из `.env.example`: `NGINX_HTTP_PORT=8080`, затем `docker compose --profile dev up` → http://localhost:8080/ |

### 8.1. Зависание контейнера frontend (unkillable)

Симптом: после нескольких часов работы `infolake-frontend` перестаёт отвечать; `docker compose down` / `docker kill` зависают; помогает только перезагрузка ПК.

**Причина (наиболее вероятная):** исчерпание RAM у Docker Desktop / WSL2 (`vmmem`), а не «зависший» процесс Node. Когда VM уходит в swap-thrashing, демон Docker перестаёт отвечать на kill.

**Что уже сделано в проекте:**

- Оффлайн-скрипты поднимают nginx через `docker-compose.server.yml` (статика + reverse-proxy, **без** bind-mount исходников).
- У `nginx` / `backend` / `tileserver` заданы `mem_limit` / `cpus` и healthcheck — при утечке Docker OOM-kill'ит контейнер вместо всей VM.
- HMR и polling в Docker отключены (`VITE_ENABLE_HMR=false`).

**Если зависание повторится:**

1. До полной перезагрузки попробуйте `wsl --shutdown` (в PowerShell от администратора) — часто восстанавливает Docker быстрее reboot.
2. Ограничьте память WSL2 — создайте `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=6GB
processors=4
swap=2GB
```

Затем снова `wsl --shutdown` и перезапустите Docker Desktop.

3. Перед зависанием смотрите диспетчер задач (`vmmem` / Docker) и `docker stats` — рост памяти frontend/tileserver без отката указывает на источник давления.
4. Убедитесь, что на оффлайн-сервере **не** запущен чистый `docker compose up` без `-f docker-compose.server.yml`.

### 8.2. Зависание nginx на Docker Desktop без WSL2 (Hyper-V / Windows containers backend)

Симптом: после нескольких часов работы с картой (prod) сначала отваливаются тайлы/glyphs, затем `/api`, вкладка браузера крутится; позже `docker compose ... down` / `docker kill` зависают («cannot kill container»). Перезапуск браузера иногда временно помогает, полный reboot — всегда. `docker stats` при этом может выглядеть нормально.

**Типичные причины:**

1. **Stale DNS upstream (главная):** nginx без `resolver` кеширует IP `backend`/`tileserver` при старте; после OOM-рестарта upstream получает новый IP — прокси «залипает». Подробно: [OFFLINE_DIAGNOSTICS.md §2.1](OFFLINE_DIAGNOSTICS.md).
2. **Зомби-процесс в tileserver-gl** (`node` как PID 1 без init) — `docker compose down` пишет «PID ... is zombie and cannot be killed». Подробно: [OFFLINE_DIAGNOSTICS.md §7.1](OFFLINE_DIAGNOSTICS.md).
3. **Неограниченный рост логов** (`json-file` без `max-size`) — `/tiles/` генерирует сотни access-записей при pan/zoom и забивает диск Docker.
4. **Исчерпание памяти VM Docker Desktop** (Hyper-V) — лимиты задаются в GUI, не через `.wslconfig`.
5. **`worker_processes auto`** в stock nginx — на многоядерном хосте число воркеров растёт сверх `mem_limit` / `cpus`.

**Что уже сделано в проекте (после фикса):**

- У всех сервисов `logging: json-file` с `max-size: 10m`, `max-file: 3`.
- В prod/dev nginx: `access_log off` для `location /tiles/`.
- `mem_limit` nginx = `512m`; в образе `infolake-nginx` — `worker_processes 2`.
- `resolver 127.0.0.11 valid=10s` + `proxy_pass` через переменные; fail-fast `proxy_connect_timeout`.
- Upstream-watchdog (`nginx -s reload` → restart контейнера при длительном отказе).
- Healthcheck nginx проверяет `/tiles/...` и `/api/v1/` (не только статику).
- `mem_limit` tileserver `6g`, backend `3g`; `stop_grace_period: 20s` у nginx.
- **`init: true`** у `tileserver` / `nginx` / `backend` / `frontend` — tini как PID 1, reap зомби (maptiler/tileserver-gl#1236).

**Ограничить память Docker Desktop (без WSL2):**

1. Docker Desktop → **Settings** → **Resources** → **Advanced**.
2. Memory: рекомендуемо **12–16 GB** (сумма лимитов контейнеров ≈ 9.5g+; не оставляйте «весь RAM» хоста без запаса).
3. CPU: 2–4 ядра; Swap: 1–2 GB.
4. Apply & Restart.

**Если `docker kill` / `compose down` уже не отвечают (до reboot):**

1. PowerShell **от администратора:**

```powershell
Restart-Service com.docker.service -Force
```

Или Services.msc → перезапуск **Docker Desktop Service** / `com.docker.service`.

2. Если служба не поднимается — перезагрузка ПК.

**Чек-лист диагностики (пока ещё отвечает, до полного зависания):**

```powershell
docker stats --no-stream
docker system df
Get-PSDrive C,D
docker inspect tileserver-gl infolake-backend infolake-nginx --format "{{.Name}} restarts={{.RestartCount}} oom={{.State.OOMKilled}} started={{.State.StartedAt}}"
docker exec infolake-nginx getent hosts backend tileserver
docker inspect -f "{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" tileserver-gl infolake-backend
docker inspect infolake-nginx --format "{{.LogPath}}"
docker inspect infolake-nginx --format "{{json .HostConfig.LogConfig}}"
```

Ожидается: в LogConfig видны `max-size` / `max-file`; размер лога не уходит в гигабайты; при актуальном образе — в `nginx -T` есть `resolver` и `$backend_upstream`. Если `StartedAt` upstream позже nginx и IP не совпадают — это §2.1 в [OFFLINE_DIAGNOSTICS.md](OFFLINE_DIAGNOSTICS.md).

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
- [ ] http://localhost/ открывается, API `/api/v1/`, карта отображается

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
