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

Живут в Docker volume **`infolake_pgdata`**.

```powershell
# Остановить стек, данные сохранить:
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down

# Удалить и БД тоже (необратимо):
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down -v
```

Порт 5432 на хост **не публикуется** — можно оставить Windows PostgreSQL установленным, он этому стеку не мешает (и не используется).

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| `No such image: postgres:17` | Загружен обычный prod tar. Нужен `infolake_full_offline_prod_postgres.tar` |
| Backend: password authentication failed | `DB_PASSWORD` ≠ `POSTGRES_PASSWORD`, или volume создан со старым паролем (`down -v` только если данные не нужны) |
| Backend не дожидается БД | Дождитесь `healthy` у `infolake-postgres`, затем `compose ... logs backend` |
| Смешали со стеком на хостовой БД | Сначала `down` одного варианта, потом `up` другого |

---

## Переключение на prod с хостовым Postgres

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml -f docker-compose.postgres.yml down
.\import-and-start.ps1
```
