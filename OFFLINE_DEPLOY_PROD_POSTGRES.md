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

По умолчанию живут в Docker volume **`infolake_pgdata`** (диск виртуальной машины Docker Desktop).

```powershell
# Остановить стек, данные сохранить:
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down

# Удалить named volume (необратимо). Папку bind mount на диске это не трогает:
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down -v
```

Порт **5431** на хосте проброшен в контейнер на 5432 (не пересекается с Windows PostgreSQL на 5432). Подключение с хоста: `localhost:5431`, пользователь `infolake`, БД `infolake_db`. Другой порт хоста: `POSTGRES_HOST_PORT` в корневом `.env`.

### Каталог на выбранном диске (bind mount)

Чтобы файлы кластера лежали, например, на `D:`, а не внутри Docker:

1. Остановите стек (`down` **без** `-v`, если named volume ещё нужен).
2. Создайте **пустую** папку:

```powershell
New-Item -ItemType Directory -Force -Path "D:\InfoLake\postgres-data"
```

3. В **корневом** `.env` проекта (рядом с `docker-compose.yml`):

```env
POSTGRES_DATA_DIR=D:/InfoLake/postgres-data
```

На Windows для Docker указывайте **прямые слэши** (`D:/...`), не `D:\...`.

4. Папка на первом старте должна быть пустой либо уже содержать валидный PGDATA. Посторонние файлы — ошибка инициализации Postgres.
5. Запустите стек тем же набором compose-файлов (`import-and-start-postgres.ps1` или `up` вручную).
6. Проверка: в папке появятся `PG_VERSION`, `base`, `pg_wal`. Подключение с хоста по-прежнему `localhost:5431`.

Не используйте каталог данных установленного Windows PostgreSQL.

Если раньше данные были в `infolake_pgdata` и их нужно сохранить: не копируйте файлы volume вручную на NTFS. Либо начните с пустой папки (migrate + `createsuperuser` заново), либо пока volume ещё смонтирован сделайте `pg_dump` на `localhost:5431` и после смены пути — restore.

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| `No such image: postgres:17` | Загружен обычный prod tar. Нужен `infolake_full_offline_prod_postgres.tar` |
| Backend: password authentication failed | `DB_PASSWORD` ≠ `POSTGRES_PASSWORD`, или volume/папка созданы со старым паролем |
| Backend не дожидается БД | Дождитесь `healthy` у `infolake-postgres`, затем `compose ... logs backend` |
| Postgres не стартует, «directory exists but is not empty» | Папка `POSTGRES_DATA_DIR` не пустая и это не PGDATA — очистите или укажите другую |
| Смешали со стеком на хостовой БД | Сначала `down` одного варианта, потом `up` другого |

---

## Переключение на prod с хостовым Postgres

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down
.\import-and-start.ps1
```
