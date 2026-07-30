# Перенос и запуск InfoLake на офлайн-компьютере (DEV)

Dev-режим: Vite dev server в контейнере `infolake-frontend`, nginx проксирует на порт 5173. Для HMR и правок frontend без пересборки образа.

**Важно:** production-архив (`export-offline.ps1` без `-Dev`) **не подходит** для dev — в нём нет `infolake-frontend:latest`.

Связанные документы: [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md), [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md)

---

## Что нужно перенести

| Что | Обязательно | Примечание |
|-----|-------------|------------|
| `infolake_full_offline_dev.tar` | Да | Собран: `.\export-offline.ps1 -Dev` |
| Папка проекта `Lake_grok/` | Да | Нужны исходники `frontend/`, `nginx/dev.conf` |
| `tileserver/data/map.mbtiles` | Да | Не в git |
| `backend/.env` | Да | Как в production |
| `backend/media/` | По необходимости | |

В dev-архиве образы:
- `infolake-backend:latest`
- `infolake-frontend:latest`
- `nginx:1.27-alpine`
- `maptiler/tileserver-gl:latest`

---

## Подготовка на машине с интернетом

```powershell
cd D:\Artur\Проект\Lake_grok
.\export-offline.ps1 -Dev
# или оба архива сразу: .\export-offline-both.ps1
```

Результат: **`infolake_full_offline_dev.tar`**.

Скопируйте на офлайн-сервер:
- `infolake_full_offline_dev.tar` (или датированную копию)
- полную папку проекта (или `Lake_grok_code.zip` из `scripts/offline/prepare-transfer-package.ps1`)
- `map.mbtiles`

---

## Настройка на офлайн-сервере

### 1. `backend/.env`

Как в production — см. [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md).

Пример для `172.16.80.207`:

```env
DB_HOST=host.docker.internal
ALLOWED_HOSTS=localhost,127.0.0.1,172.16.80.207
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://172.16.80.207
FRONTEND_URL=http://172.16.80.207
```

### 2. Порт nginx

В корне проекта `.env` (если порт 80 занят):

```env
NGINX_HTTP_PORT=8080
```

### 3. Остановите production-стек (если был запущен)

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml down
```

---

## Запуск (dev)

```powershell
cd D:\InfoLake\Lake_grok
.\import-and-start-dev.ps1
```

Или вручную:

```powershell
docker load -i infolake_full_offline_dev.tar
docker compose --profile dev up -d --no-build --pull never
```

Проверка образов после `docker load`:

```powershell
docker images --format "{{.Repository}}:{{.Tag}}" | findstr "infolake nginx maptiler"
```

Ожидается: `infolake-frontend:latest`, `infolake-backend:latest`, `nginx:1.27-alpine`, `maptiler/tileserver-gl:latest`.

Статус контейнеров:

```powershell
docker compose --profile dev ps
```

---

## Проверка

| URL | Ожидание |
|-----|----------|
| `http://172.16.80.207/` | UI (через nginx → Vite) |
| `http://172.16.80.207:8080/` | Если `NGINX_HTTP_PORT=8080` |
| `http://172.16.80.207/api/v1/` | API |

В браузере: **Ctrl+F5** после изменений в коде.

---

## Важно

На офлайн-машине **не запускать**:

- `docker compose build`
- `docker compose pull`
- `npm install` на хосте (зависимости в образе `infolake-frontend`)

Обязательно: `--no-build --pull never`.

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| Ошибка «нет node» / нет `infolake-frontend` | Загружен production tar. Пересоберите: `export-offline.ps1 -Dev` |
| `no such image nginx:1.27-alpine` | Dev tar не загружен или запуск без `--no-build --pull never` |
| Frontend не стартует | Проверьте `docker compose --profile dev logs frontend` |
| Смешали prod и dev | Сначала `down` для обоих вариантов compose, затем один режим |

---

## Переключение prod ↔ dev

**Остановить dev:**

```powershell
docker compose --profile dev down
```

**Запустить production:**

```powershell
.\import-and-start.ps1
```

Или см. [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md).
