# Первый запуск InfoLake (production)

Инструкция для установки **рабочей (production)** версии на отдельный компьютер.
Разработка ведётся на других ветках; на этом компьютере используется только ветка **`production`**.

Оператор на месте **не обязан** знать Docker или Git: после первой установки дальнейшие обновления выполняются двойным щелчком `apply-update.bat`.

Подробнее по эксплуатации: [docs/admin-guide/](docs/admin-guide/) (руководство администратора).

---

## 1. Что нужно заранее

| Компонент | Назначение |
|-----------|------------|
| **Windows 10/11** (64-bit) | Целевая ОС |
| **Docker Desktop** | Запуск контейнеров (включите WSL2, если предложит установщик) |
| **PostgreSQL 14+** на хосте | База данных (не в Docker) |
| **Git for Windows** | Нужен один раз для первичной установки и для скрипта обновлений |
| Свободное место | ≥ 20 ГБ на диске с проектом и образами; карта `map.mbtiles` может быть десятки ГБ |

От администратора/разработчика вы должны получить:

1. **`infolake_full_offline.tar`** — Docker-образы (первый запуск) **или** пакет `infolake_update_vX.Y.Z.tar` (содержит `images.tar` + `update.bundle`).
2. Папку/архив **кода** ветки `production` (или `update.bundle` для `git clone`).
3. Файл **`tileserver/data/map.mbtiles`** (карта; в git не входит).
4. Параметры БД для файла `backend/.env` (имя БД, пользователь, пароль).

---

## 2. Установка PostgreSQL и создание БД

1. Установите PostgreSQL с официального сайта (оставьте порт **5432**).
2. В pgAdmin или `psql` выполните (подставьте свой пароль):

```sql
CREATE USER infolake WITH PASSWORD 'your_password';
CREATE DATABASE infolake_db OWNER infolake;
```

3. Убедитесь, что PostgreSQL принимает подключения с локальной машины (по умолчанию — да).

---

## 3. Установка Docker Desktop

1. Установите Docker Desktop и перезагрузите ПК при необходимости.
2. Запустите Docker Desktop и дождитесь статуса **Running**.
3. В PowerShell проверка:

```powershell
docker version
docker compose version
```

---

## 4. Размещение проекта

Выберите один способ.

### Вариант A — готовая папка проекта (проще)

1. Скопируйте папку `Lake_grok` на диск (например `D:\InfoLake\Lake_grok`).
2. Убедитесь, что внутри есть `docker-compose.yml`, `docker-compose.server.yml`, папки `backend`, `frontend`, `tileserver`.
3. В этой папке должна быть ветка git `production`:

```powershell
cd D:\InfoLake\Lake_grok
git branch --show-current
```

Ожидается: `production`. Если нет — выполните `git checkout production` (если ветка уже есть локально).

### Вариант B — из git bundle (полностью офлайн)

```powershell
cd D:\InfoLake
git clone update.bundle Lake_grok
cd Lake_grok
git checkout production
```

Файл `update.bundle` берётся из пакета обновления / первичной поставки.

---

## 5. Карта и настройки

1. Скопируйте **`map.mbtiles`** в:

```
Lake_grok\tileserver\data\map.mbtiles
```

2. Создайте `backend\.env` из примера:

```powershell
copy backend\.env.example backend\.env
```

3. Откройте `backend\.env` в Блокноте и заполните минимум:

```env
DB_NAME=infolake_db
DB_USER=infolake
DB_PASSWORD=your_password
DB_HOST=host.docker.internal
DB_PORT=5432

SECRET_KEY=длинная-случайная-строка
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
```

> **Важно:** в production всегда `DEBUG=False`. Иначе страницы ошибок 404/500 не покажутся, а на экран могут попасть технические детали.

---

## 6. Загрузка образов и запуск

Положите `infolake_full_offline.tar` в корень проекта (или укажите полный путь).

```powershell
cd D:\InfoLake\Lake_grok
docker load -i infolake_full_offline.tar
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --no-build --pull never
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

Либо один скрипт (если есть архив и скрипт в корне):

```powershell
.\import-and-start.ps1
```

Он уже использует production-compose (`docker-compose.server.yml`).

Дождитесь статуса контейнеров **Up** / **healthy**.

---

## 7. Первый вход и данные

Миграции обычно выполняются при старте backend. Для суперпользователя:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml exec backend python manage.py createsuperuser
```

Опционально:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml exec backend python manage.py seed_security_groups
docker compose -f docker-compose.yml -f docker-compose.server.yml exec backend python manage.py seed_report_templates
```

---

## 8. Проверка

| Адрес | Ожидание |
|-------|----------|
| http://localhost:5173 | Открывается карта / форма входа |
| http://localhost:8000/admin/ | Админка Django |
| http://localhost:8000/api/v1/ | JSON API |
| http://localhost:8080/ | TileServer |

Войдите пользователем, созданным на шаге 7.

---

## 9. Как применять обновления дальше

1. Разработчик передаёт файл **`infolake_update_vX.Y.Z.tar`** (или папку с `apply-update.bat`, `update.bundle`, `images.tar`).
2. Оператор **распаковывает** архив (например в `D:\InfoLake\updates\v1.0.1\`).
3. Дважды щёлкает **`apply-update.bat`**.
4. Ждёт зелёное сообщение **«ОБНОВЛЕНИЕ ЗАВЕРШЕНО»**.
5. При красном **«ОШИБКА — ВЫПОЛНЕН ОТКАТ»** — **не чинит сам**, отправляет разработчику файл `Lake_grok\logs\update-….log`.

Скрипт сам: делает бэкап БД, обновляет код и образы, перезапускает сервисы, проверяет доступность; при сбое откатывает код/образы.

---

## 10. Dev vs production

| | Development | Production (этот компьютер) |
|--|-------------|------------------------------|
| Ветка | `develop_report` и др. | только `production` |
| Frontend | `npm run dev`, bind-mount | собранная статика (`vite preview`) |
| Compose | `docker compose up` | `docker-compose.yml` **+** `docker-compose.server.yml` |
| `DEBUG` | `True` | `False` |
| Обновления | git pull / правка кода | `apply-update.bat` |

На машине разработчика можно продолжать работу в `develop_report` без влияния на этот сервер.

---

## 11. Куда смотреть при проблемах

- [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md) — офлайн-пакет, WSL2/зависания (§8.1)
- Руководство администратора — `docs/admin-guide/`
- Журналы обновлений — `logs\update-*.log`
- Логи Docker: `docker compose -f docker-compose.yml -f docker-compose.server.yml logs --tail 100`
