# Перенос и запуск InfoLake на офлайн-компьютере БЕЗ nginx

Дополнительный режим: контейнер nginx не запускается. Браузер ходит на три порта напрямую.

| Сервис | Порт по умолчанию | Что открывать |
|--------|-------------------|---------------|
| Frontend | **5173** | UI приложения |
| Backend | **8000** | `/api/v1/`, `/admin/`, `/media/`, `/static/` |
| TileServer | **8080** | стили и тайлы карты |

Используйте этот вариант, если nginx на Docker Desktop зависает, либо нужен прямой доступ к API и админке.

Связанные документы: [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md), [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md), [OFFLINE_DEPLOY_DEV.md](OFFLINE_DEPLOY_DEV.md), [OFFLINE_DIAGNOSTICS.md](OFFLINE_DIAGNOSTICS.md)

---

## Два подрежима

| | Production (рекомендуется офлайн) | Dev |
|--|-----------------------------------|-----|
| Архив | `infolake_full_offline_direct.tar` | `infolake_full_offline_dev.tar` (тот же, что для nginx-dev) |
| Сборка | `.\export-offline.ps1 -Direct` | `.\export-offline.ps1 -Dev` |
| Запуск | `.\import-and-start-direct.ps1` | `.\import-and-start-direct-dev.ps1` |
| Frontend | образ `infolake-frontend-static` (`serve` + `dist`) | Vite в `infolake-frontend`, bind-mount `frontend/` |
| Nginx | нет | нет |

Не запускайте nginx-стек и direct-стек одновременно: порты 8000/8080/5173 и контейнеры `infolake-backend` / `tileserver-gl` общие.

---

## Что нужно перенести

| Что | Production direct | Dev direct |
|-----|-------------------|------------|
| `infolake_full_offline_direct.tar` | Да | — |
| `infolake_full_offline_dev.tar` | — | Да |
| Папка проекта `Lake_grok/` | Да (`docker-compose.yml`, `docker-compose.direct.yml`) | Да + исходники `frontend/` |
| `tileserver/data/map.mbtiles` | Да | Да |
| `backend/.env` | Да | Да |
| `backend/media/` | По необходимости | По необходимости |

Образы в **direct**-архиве:

- `infolake-backend:latest`
- `infolake-frontend-static:latest`
- `maptiler/tileserver-gl:latest`

В архиве **нет** `infolake-nginx` и `nginx:1.27-alpine`.

---

## Подготовка на машине с интернетом

```powershell
cd D:\Artur\Проект\Lake_grok
.\export-offline.ps1 -Direct
# dev без nginx использует обычный dev-архив:
.\export-offline.ps1 -Dev
# все три архива (prod / dev / direct):
.\export-offline-both.ps1
```

Результат production-direct: **`infolake_full_offline_direct.tar`**.

---

## Настройка на офлайн-сервере

### 1. PostgreSQL

Как в [OFFLINE_DEPLOY_PROD.md](OFFLINE_DEPLOY_PROD.md).

### 2. Файл `backend/.env`

Скопируйте `backend/.env.example` → `backend/.env`. Для IP `172.16.80.207`:

```env
DB_HOST=host.docker.internal
ALLOWED_HOSTS=localhost,127.0.0.1,172.16.80.207
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://172.16.80.207:5173
CORS_ALLOW_ALL_ORIGINS=False
FRONTEND_URL=http://172.16.80.207:5173
DEBUG=False
```

**CORS обязателен:** UI на `:5173`, API на `:8000` — разные origin. Без строки `http://<IP>:5173` в `CORS_ALLOWED_ORIGINS` браузер заблокирует `/api`. На закрытой сети можно временно `CORS_ALLOW_ALL_ORIGINS=True`.

### 3. Порты (корень проекта, `.env`)

По умолчанию: UI 5173, API 8000, tiles 8080. Если 8080 занят (раньше на нём был nginx):

```env
BACKEND_HTTP_PORT=8000
TILESERVER_HTTP_PORT=8081
FRONTEND_HTTP_PORT=5173
FRONTEND_PUBLIC_URL=http://172.16.80.207:5173
```

Если меняете `TILESERVER_HTTP_PORT` / `BACKEND_HTTP_PORT` в **production-direct**, контейнер `infolake-frontend-static` при старте перезаписывает `/runtime-config.js` из этих env (entrypoint `direct-entrypoint.sh`) — **пересборка образа не нужна**. В **dev-direct** порты также читаются из Vite env (`VITE_BACKEND_PORT` / `VITE_TILESERVER_PORT`).

Режим direct включается через `window.__INFOLAKE_CONFIG__.directMode` (prod-static) или `VITE_DIRECT_MODE=true` / локальный DEV на портах 5173/4173. Production-бандл **без** runtime-config не включает direct только из-за порта 5173.

### Хост ~8 ГБ RAM

Добавьте override лимитов памяти:

```powershell
docker compose -f docker-compose.yml -f docker-compose.direct.yml -f docker-compose.resources-8gb.yml --profile direct-prod up -d --no-build --pull never
```

См. [docker-compose.resources-8gb.yml](docker-compose.resources-8gb.yml).

### 4. Карта

```
tileserver/data/map.mbtiles
```

### 5. Остановите nginx-стек (если был)

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml down
docker compose --profile dev down
```

`import-and-start-direct.ps1` делает это сам.

---

## Запуск

### Production (без nginx)

```powershell
cd D:\InfoLake\Lake_grok
.\import-and-start-direct.ps1
```

Эквивалент вручную:

```powershell
docker load -i infolake_full_offline_direct.tar
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile direct-prod up -d --no-build --pull never
```

### Dev (без nginx)

```powershell
.\import-and-start-direct-dev.ps1
```

Эквивалент:

```powershell
docker load -i infolake_full_offline_dev.tar
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile dev up -d --no-build --pull never
```

На офлайн-машине **не запускать** `docker compose build` / `pull`.

### Первый запуск БД

Миграции выполняются при старте backend. Суперпользователь:

```powershell
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile direct-prod exec backend python manage.py createsuperuser
```

Для dev-direct замените `--profile direct-prod` на `--profile dev`.

---

## Проверка

Подставьте IP офлайн-ПК (пример `172.16.80.207`):

| URL | Ожидание |
|-----|----------|
| `http://172.16.80.207:5173/` | UI |
| `http://172.16.80.207:8000/api/v1/` | JSON API |
| `http://172.16.80.207:8000/admin/` | Django admin (статика через WhiteNoise) |
| `http://172.16.80.207:8000/media/markers/` | файлы media |
| `http://172.16.80.207:8080/` | TileServer GL |

```powershell
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile direct-prod ps
```

Контейнера `infolake-nginx` быть не должно. Ожидаются: `infolake-backend`, `tileserver-gl`, `infolake-frontend-static` (prod) или `infolake-frontend` (dev).

---

## Переключение nginx ↔ direct

**Остановить direct prod:**

```powershell
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile direct-prod down
```

**Остановить direct dev:**

```powershell
docker compose -f docker-compose.yml -f docker-compose.direct.yml --profile dev down
```

**Запустить nginx production:**

```powershell
.\import-and-start.ps1
```

---

## Частые ошибки

| Симптом | Решение |
|---------|---------|
| CORS / сеть в консоли браузера на `/api` | Добавьте `http://<IP>:5173` в `CORS_ALLOWED_ORIGINS`, перезапустите backend |
| Карта AJAX Error, UI открывается | Проверьте `:8080` и `tileserver/data/map.mbtiles`; Host tileserver — `TILESERVER_GL_ALLOWED_HOSTS=*` в direct-compose |
| `No such image: infolake-frontend-static` | Загружен prod/dev tar вместо `infolake_full_offline_direct.tar` |
| Порт 8080 занят | Остановите nginx-стек (`NGINX_HTTP_PORT=8080`) или смените `TILESERVER_HTTP_PORT` (dev-direct) |
| Админка без стилей | Открывайте `http://<IP>:8000/admin/`, не `:5173/admin/` |
| Плитка Ubuntu / WSL не связана | Direct-режим не требует WSL; это только Docker-порты |

---

## Как это устроено

Frontend в direct-режиме (`VITE_DIRECT_MODE` / runtime-config) сам собирает URL:

- API: `http://<hostname>:<backendPort>` (по умолчанию 8000)
- тайлы: `http://<hostname>:<tileserverPort>` (по умолчанию 8080, без префикса `/tiles/`)

hostname берётся из адресной строки браузера. В **production-direct** порты задаются при старте контейнера через `/runtime-config.js` (env `BACKEND_HTTP_PORT` / `TILESERVER_HTTP_PORT`).
