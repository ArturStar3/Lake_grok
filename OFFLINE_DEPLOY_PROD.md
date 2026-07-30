# Перенос и запуск InfoLake на офлайн-компьютере (PRODUCTION)

Production-режим: frontend собран в Docker-образе `infolake-nginx`, nginx раздаёт статику и проксирует API, tiles и media.

Связанные документы: [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md), [import-and-start.ps1](import-and-start.ps1), [OFFLINE_DIAGNOSTICS.md](OFFLINE_DIAGNOSTICS.md)

---

## Что нужно перенести

| Что | Обязательно | Примечание |
|-----|-------------|------------|
| `infolake_full_offline_prod.tar` | Да | Собран на online-машине: `.\export-offline.ps1` (без `-Dev`) |
| Папка проекта `Lake_grok/` | Да | Код, `docker-compose.yml`, `docker-compose.server.yml` |
| `tileserver/data/map.mbtiles` | Да | Не в git, копировать отдельно |
| `backend/.env` | Да | Создать на целевой машине из `backend/.env.example` |
| `backend/media/` | По необходимости | Маркеры, фото, вложения |

**Не копировать:** `node_modules/`, `frontend/dist/` (уже внутри образа nginx).

---

## Подготовка на машине с интернетом

```powershell
cd D:\Artur\Проект\Lake_grok
.\export-offline.ps1
# или оба архива сразу: .\export-offline-both.ps1
```

Результат: **`infolake_full_offline_prod.tar`** (+ копия с датой `infolake_full_offline_prod_YYYYMMDD_HHMMSS.tar`).

В архиве образы:
- `infolake-backend:latest`
- `infolake-nginx:latest`
- `maptiler/tileserver-gl:latest`

---

## Настройка на офлайн-сервере

### 1. PostgreSQL

Создайте БД и пользователя (пример):

```sql
CREATE USER infolake WITH PASSWORD 'your_password';
CREATE DATABASE infolake_db OWNER infolake;
```

### 2. Файл `backend/.env`

Скопируйте `backend/.env.example` → `backend/.env` и укажите параметры **офлайн-сервера**.

Пример для IP `172.16.80.207`:

```env
DB_HOST=host.docker.internal
ALLOWED_HOSTS=localhost,127.0.0.1,172.16.80.207
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://172.16.80.207
FRONTEND_URL=http://172.16.80.207
DEBUG=False
```

Если порт 80 занят (Windows), в корне проекта создайте `.env`:

```env
NGINX_HTTP_PORT=8080
```

Тогда `FRONTEND_URL=http://172.16.80.207:8080`.

### 3. Карта

Положите файл:

```
tileserver/data/map.mbtiles
```

---

## Запуск (production)

В корне проекта на офлайн-машине:

```powershell
cd D:\InfoLake\Lake_grok
.\import-and-start.ps1
```

Скрипт выполняет:
1. `docker load -i infolake_full_offline_prod.tar`
2. `docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never`

### Вручную (эквивалент)

```powershell
docker load -i infolake_full_offline_prod.tar
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never
```

### Первый запуск БД

Миграции выполняются при старте backend. При необходимости:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml exec backend python manage.py createsuperuser
```

---

## Проверка

| URL | Ожидание |
|-----|----------|
| `http://172.16.80.207/` | Приложение открывается |
| `http://172.16.80.207/api/v1/` | JSON |
| `http://172.16.80.207/admin/` | Django admin |
| `http://172.16.80.207/tiles/` | Список стилей |
| `http://172.16.80.207/media/markers/` | SVG/файлы |

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

---

## Важно

На офлайн-машине **никогда не запускать**:

- `docker compose build`
- `docker compose pull`
- `docker pull`
- `docker compose --profile dev up` (это dev-режим, см. [OFFLINE_DEPLOY_DEV.md](OFFLINE_DEPLOY_DEV.md))

Production всегда через **`docker-compose.server.yml`**.

Если nginx через несколько часов «зависает» и `docker kill` не отвечает — см. [OFFLINE_DIAGNOSTICS.md](OFFLINE_DIAGNOSTICS.md) и [OFFLINE_MIGRATION.md §8.2](OFFLINE_MIGRATION.md).

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| `no such image nginx:1.27-alpine` | Запускали без `--no-build --pull never` или пытались `build`. Используйте `import-and-start.ps1` |
| `No such image: infolake-nginx` | Не выполнен `docker load` или загружен dev-архив вместо production |
| Карта пустая | Нет `tileserver/data/map.mbtiles` |
| Backend не подключается к БД | Проверьте `DB_HOST=host.docker.internal`, PostgreSQL запущен |
