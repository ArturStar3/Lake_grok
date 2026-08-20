# Перенос и запуск InfoLake (PRODUCTION + PostgreSQL 17 в Docker)

Отдельный вариант production: те же `infolake-nginx` / `infolake-backend` / tileserver, плюс контейнер **`postgres:17`**. PostgreSQL на Windows **не нужен**.

Существующий prod с БД на хосте не заменяется — см. [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md).

Связанные документы: [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md), [import-and-start-postgres.ps1](import-and-start-postgres.ps1)

---

## Что нужно перенести

| Что | Обязательно | Примечание |
|-----|-------------|------------|
| `infolake_full_offline_prod_postgres.tar` | Да | `.\export-offline.ps1 -Postgres` |
| Папка проекта | Да | Нужны `docker-compose.yml`, `docker-compose.server.yml`, `docker-compose.postgres.yml` |
| `tileserver/data/map.mbtiles` | Да | Не в git |
| `backend/.env` | Да | Из `backend/.env.example` |
| `backend/media/` | По необходимости | |

**Не нужно:** установка PostgreSQL на хосте, `pg_dump` (первый запуск — пустая БД + миграции Django).

Образы в архиве:

- `infolake-backend:latest`
- `infolake-nginx:latest`
- `maptiler/tileserver-gl:latest`
- `postgres:17`

---

## Подготовка на машине с интернетом

```powershell
cd D:\Artur\Проект\Lake_grok
.\export-offline.ps1 -Postgres
```

Результат: **`infolake_full_offline_prod_postgres.tar`** (+ копия с датой).

---

## Настройка на офлайн-сервере

### 1. Файл `backend/.env`

```env
DB_NAME=infolake_db
DB_USER=infolake
DB_PASSWORD=change_me
DB_HOST=host.docker.internal
DB_PORT=5432
ALLOWED_HOSTS=localhost,127.0.0.1,172.16.80.207
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://172.16.80.207
FRONTEND_URL=http://172.16.80.207:8080
DEBUG=False
```

`DB_HOST` в файле может остаться `host.docker.internal` — **compose переопределяет его на `postgres`**.

`DB_NAME` / `DB_USER` / `DB_PASSWORD` должны совпадать с переменными контейнера Postgres (по умолчанию `infolake_db` / `infolake` / `change_me`). Если меняете пароль — задайте те же значения в **корневом** `.env`:

```env
NGINX_HTTP_PORT=8080
POSTGRES_DB=infolake_db
POSTGRES_USER=infolake
POSTGRES_PASSWORD=change_me
POSTGRES_HOST_PORT=5431
```

Смените `change_me` на рабочий пароль **до первого** `up`: volume уже инициализированного Postgres пароль из env не меняет.

### 2. Карта

```
tileserver/data/map.mbtiles
```

### 3. Остановите другой стек InfoLake

Общие имена контейнеров `infolake-nginx` / `infolake-backend`. Скрипт импорта останавливает nginx-prod, dev и direct сам.

---

## Запуск

```powershell
cd D:\InfoLake\Lake_grok
.\import-and-start-postgres.ps1
```

Вручную:

```powershell
docker load -i infolake_full_offline_prod_postgres.tar
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml up -d --no-build --pull never
```

На офлайн-машине **не запускать** `docker compose build` / `pull` / `docker pull`.

Хост с ~8 ГБ RAM — добавьте `-f docker-compose.resources-8gb.yml`.

### Первый запуск БД

Миграции выполняются при старте backend (`docker-entrypoint.sh`). Суперпользователь:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml exec backend python manage.py createsuperuser
```

---

## Проверка

| URL (пример, порт 8080) | Ожидание |
|-------------------------|----------|
| `http://172.16.80.207:8080/` | UI |
| `http://172.16.80.207:8080/api/v1/` | API |
| `http://172.16.80.207:8080/admin/` | Django admin |
| `http://172.16.80.207:8080/tiles/` | TileServer |

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml ps
```

Должны быть `infolake-postgres` (healthy), `infolake-backend`, `infolake-nginx`, `tileserver-gl`.

---

## Данные Postgres

По умолчанию живут в Docker volume **`infolake_pgdata`** (внутри disk image Docker Desktop — файл `.vhdx` с ext4).

```powershell
# Остановить стек, данные сохранить:
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down

# Удалить named volume (необратимо):
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down -v
```

Порт **5431** на хосте проброшен в контейнер на 5432 (не пересекается с Windows PostgreSQL на 5432). Подключение с хоста: `localhost:5431`, пользователь `infolake`, БД `infolake_db`. Другой порт хоста: `POSTGRES_HOST_PORT` в корневом `.env`.

### Почему нельзя `POSTGRES_DATA_DIR=Q:/db` на Windows

`postgres:17` при инициализации делает `chown` / `chmod 0700` для каталога данных. Bind mount папки Windows (`Q:/db`, `D:/InfoLake/postgres-data` и т.п.) внутри Docker Desktop — это **drvfs/9p** (WSL2) или **SMB** (Hyper-V): Linux-владелец и режимы файлов **не поддерживаются**. Типичные ошибки в логах:

```text
initdb: error: could not change permissions of directory "/var/lib/postgresql/data": Operation not permitted
FATAL:  data directory "/var/lib/postgresql/data" has invalid permissions
DETAIL:  Permissions should be u=rwx (0700) or more restrictive.
```

На Windows/Docker Desktop **не задавайте** `POSTGRES_DATA_DIR` в `.env` (скрипт `import-and-start-postgres.ps1` остановится с предупреждением). Кластер остаётся в named volume `infolake_pgdata`. Чтобы физически хранить данные на другом диске (в т.ч. VeraCrypt-том `Q:`), перенесите **Disk image** Docker Desktop.

### Данные Postgres на отдельном диске (VeraCrypt-том)

Цель: volume `infolake_pgdata` живёт внутри `docker_data.vhdx` (ext4), а сам `.vhdx` лежит на `Q:\Docker`.

#### Подготовка

1. Смонтируйте том в VeraCrypt как **обычный локальный диск** (не включайте «Mount volume as removable medium»).
2. Создайте каталог:

```powershell
New-Item -ItemType Directory -Force -Path "Q:\Docker"
```

3. Остановите стек (**без** `-v`):

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down
```

4. **Quit Docker Desktop**. Для backend WSL2:

```powershell
wsl --shutdown
```

#### Основной способ (GUI)

1. Запустите Docker Desktop.
2. **Settings → Resources → Advanced → Disk image location** → укажите `Q:\Docker` → **Apply & restart**.
3. Проверка:

```powershell
docker info
# Docker Root Dir / данные должны относиться к новому расположению

Get-ChildItem -Recurse "Q:\Docker" -Filter "*.vhdx" | Select-Object FullName, Length
```

Ожидание (имена зависят от версии Docker Desktop):

- WSL2: `Q:\Docker\...\disk\docker_data.vhdx` (часто `DockerDesktopWSL\disk\`)
- Hyper-V: `Q:\Docker\DockerDesktop.vhdx` или похожий путь

#### Если GUI отвечает «Failed to apply settings»

**Вариант A — старая раскладка WSL2** (`wsl -l -v` показывает `docker-desktop-data`):

```powershell
wsl --shutdown
wsl --manage docker-desktop-data --move "Q:\Docker\data"
```

Если `--manage ... --move` недоступен:

```powershell
wsl --shutdown
wsl --export docker-desktop-data "Q:\Docker\docker-desktop-data.tar"
wsl --unregister docker-desktop-data
New-Item -ItemType Directory -Force -Path "Q:\Docker\data"
wsl --import docker-desktop-data "Q:\Docker\data" "Q:\Docker\docker-desktop-data.tar" --version 2
```

После успешного импорта исходный `.tar` можно удалить.

**Вариант B — новая раскладка** (есть distro `docker-desktop`, файл `%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx`):

1. Quit Docker Desktop, `wsl --shutdown`.
2. **Перенесите** (cut/move, не только правку настроек) `docker_data.vhdx` и при наличии `main\ext4.vhdx` в каталог на `Q:\Docker` (сохраните структуру подпапок, которую ожидает ваша версия Docker, либо перенесите содержимое `...\Docker\wsl\` целиком).
3. В `%APPDATA%\Docker\settings-store.json` задайте `"DataFolder": "Q:\\Docker"` (в старых версиях — ключ `customWslDistroDir` в `settings.json`).
4. Запустите Docker Desktop.

**Важно:** если поменять только `DataFolder` **без** переноса `.vhdx`, Docker создаст **пустой** диск — образы и volume «пропадут» (старые файлы останутся на `C:`).

**Вариант C — переустановка с флагом** (крайний случай; существующие данные на старом диске не переносятся автоматически):

```powershell
# WSL2 backend:
Start-Process -Wait -FilePath "Docker Desktop Installer.exe" -ArgumentList "install --accept-license --wsl-default-data-root=Q:\Docker"

# Hyper-V backend:
# Start-Process -Wait -FilePath "Docker Desktop Installer.exe" -ArgumentList "install --accept-license --hyper-v-default-data-root=Q:\Docker"
```

#### После переноса

Если disk image создан заново (пустой):

```powershell
docker load -i infolake_full_offline_prod_postgres.tar
.\import-and-start-postgres.ps1
```

Проверка:

```powershell
docker volume inspect infolake_pgdata
Get-ChildItem -Recurse "Q:\Docker" -Filter "*.vhdx" | Select-Object FullName, Length
```

Размер `.vhdx` должен расти после работы со стеком.

#### Эксплуатация с VeraCrypt

- В Docker Desktop: **Settings → General** — отключите автозапуск при входе в Windows.
- **Включение:** смонтировать `Q:` → запустить Docker Desktop → `.\import-and-start-postgres.ps1` (или `compose ... up`).
- **Выключение:** `compose ... down` → Quit Docker Desktop → `wsl --shutdown` (если WSL2) → размонтировать том в VeraCrypt.
- **Никогда** не делайте Force Dismount при работающем Docker.
- Регулярно делайте `pg_dump` через `localhost:5431` и храните дамп **вне** зашифрованного тома (отдельный носитель / другой диск).

### Linux-хост (bind mount допустим)

Только если Docker Engine работает на Linux (не Docker Desktop на Windows):

```bash
sudo mkdir -p /srv/infolake/pgdata
sudo chown -R 999:999 /srv/infolake/pgdata
```

В корневом `.env`:

```env
POSTGRES_DATA_DIR=/srv/infolake/pgdata
```

Папка должна быть пустой или уже содержать валидный PGDATA. Не используйте каталог данных хостового PostgreSQL.

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| `No such image: postgres:17` | Загружен обычный prod tar. Нужен `infolake_full_offline_prod_postgres.tar` |
| Backend: password authentication failed | `DB_PASSWORD` ≠ `POSTGRES_PASSWORD`, или volume создан со старым паролем |
| Backend не дожидается БД | Дождитесь `healthy` у `infolake-postgres`, затем `compose ... logs backend` |
| `initdb: could not change permissions` / `Operation not permitted` / `invalid permissions` | `POSTGRES_DATA_DIR` указывает на диск Windows — закомментируйте переменную; данные в `infolake_pgdata`, диск — через Disk image location (раздел выше) |
| Postgres не стартует, «directory exists but is not empty» | На **Linux**-хосте папка `POSTGRES_DATA_DIR` не пустая и это не PGDATA — очистите или укажите другую |
| Docker стартовал без смонтированного `Q:` («пропали» образы/БД) | Не делайте `down -v`. Quit Docker → смонтируйте том → проверьте `DataFolder` / Disk image location → запустите Docker снова |
| Смешали со стеком на хостовой БД | Сначала `down` одного варианта, потом `up` другого |

---

## Переключение на prod с хостовым Postgres

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down
.\import-and-start.ps1
```
