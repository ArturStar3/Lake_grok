# Оффлайн-миграция InfoLake (ветка develop-weaponlist)

Полная инструкция по переносу проекта на компьютер **без интернета**: Docker-образы, база данных, каталог вооружения (49 образцов, ВВС / СВ / ПВО / ВМФ).

Связанные документы:

- [docker_instruction.md](docker_instruction.md) — детали по Docker save/load
- [backend/equipment/catalog/EQUIPMENT_CATALOG_OFFLINE.md](backend/equipment/catalog/EQUIPMENT_CATALOG_OFFLINE.md) — только каталог техники
- [tileserver_start_guide.md](tileserver_start_guide.md) — карта (MBTiles)

---

## Содержание

1. [Обзор](#1-обзор)
2. [Что нужно на обеих машинах](#2-что-нужно-на-обеих-машинах)
3. [Подготовка на машине с интернетом](#3-подготовка-на-машине-с-интернетом)
4. [Пакет для переноса](#4-пакет-для-переноса)
5. [Развёртывание на оффлайн-машине](#5-развёртывание-на-оффлайн-машине)
6. [Импорт каталога вооружения](#6-импорт-каталога-вооружения)
7. [Дополнительные данные (опционально)](#7-дополнительные-данные-опционально)
8. [Обновление существующей оффлайн-установки](#8-обновление-существующей-оффлайн-установки)
9. [Проверка работоспособности](#9-проверка-работоспособности)
10. [Частые проблемы](#10-частые-проблемы)
11. [Чек-лист](#11-чек-лист)

---

## 1. Обзор

Оффлайн-развёртывание состоит из трёх независимых частей:

| Часть | Что переносится | Как |
|-------|-----------------|-----|
| **Приложение** | Backend, Frontend, TileServer | `infolake_full_offline.tar` (Docker-образы) |
| **Код проекта** | Папка репозитория | USB / локальная сеть / архив |
| **Каталог техники** | 49 образцов, категории, ТТХ | Уже в репозитории: `backend/equipment/catalog/fixtures/` |
| **Карта** | `tileserver/data/map.mbtiles` | Отдельно (не в git, 1–90+ ГБ) |
| **БД** | Объекты, события, формуляры | PostgreSQL на хосте (создаётся локально или dump) |

> **Важно:** на оффлайн-машине **никогда** не запускайте `docker compose build` и `docker compose pull`. Только `docker load` + `docker compose up -d --no-build`.

---

## 2. Что нужно на обеих машинах

### Обязательно

| Компонент | Версия |
|-----------|--------|
| Docker Desktop / Docker Engine | актуальная |
| docker compose | v2+ |
| PostgreSQL | 14+ (на **хосте**, не в Docker) |
| PowerShell | 5.1+ (Windows) или bash (Linux) |

### На машине с интернетом дополнительно

- Доступ к Docker Hub (сборка образов)
- Git (клонирование / обновление репозитория)

### На оффлайн-машине

- Те же Docker + PostgreSQL
- Свободное место: **≥ 5 ГБ** (образы ~1.8 ГБ + проект + БД + карта)

---

## 3. Подготовка на машине с интернетом

### 3.1. Обновить код

```powershell
cd d:\Artur\Проект\Lake_grok
git checkout develop-weaponlist
git pull
```

### 3.2. Собрать образы и создать архив

```powershell
.\export-offline.ps1
```

Скрипт:

1. Выполняет `docker compose build`
2. Сохраняет образы в **`infolake_full_offline.tar`** (стабильное имя)
3. Создаёт копию с датой: `infolake_full_offline_YYYYMMDD_HHMMSS.tar`

Образы в архиве (из `docker-compose.yml`):

- `infolake-backend:latest`
- `infolake-frontend:latest`
- `maptiler/tileserver-gl:latest`

Пропустить пересборку (если образы уже актуальны):

```powershell
.\export-offline.ps1 -SkipBuild
```

Чистая сборка без кэша:

```powershell
.\export-offline.ps1 -NoCache
```

### 3.3. Актуализировать фикстуру каталога (если меняли data.py)

```powershell
docker compose up -d
docker compose exec backend python manage.py build_equipment_catalog_fixture
```

Проверка: в `backend/equipment/catalog/fixtures/manifest.json` должно быть `"equipment_count": 49`.

### 3.4. (Опционально) Экспорт БД с рабочей машины

Если нужно перенести **существующие** объекты карты, события и формуляры:

```powershell
pg_dump -h localhost -U map_user -d map -F c -f map_backup.dump
```

Файл `map_backup.dump` положите в пакет переноса.

### 3.5. (Опционально) Карта MBTiles

Файл `tileserver/data/map.mbtiles` **не хранится в git**. Скопируйте его отдельно или скачайте на машине с интернетом (см. [tileserver_start_guide.md](tileserver_start_guide.md)).

---

## 4. Пакет для переноса

Соберите на USB / в общую папку:

```
перенос/
├── infolake_full_offline.tar          # Docker-образы (~1.8 ГБ)
├── Lake_grok/                         # весь проект (git clone или архив)
│   ├── docker-compose.yml
│   ├── import-and-start.ps1
│   ├── export-offline.ps1
│   ├── weaponlist_import.md           # эта инструкция
│   ├── backend/
│   │   ├── .env                       # создать из env-example (см. ниже)
│   │   └── equipment/catalog/fixtures/
│   │       ├── catalog.json           # 49 образцов
│   │       └── manifest.json
│   ├── frontend/
│   └── tileserver/
│       └── data/
│           └── map.mbtiles            # отдельно, если нужна карта
└── map_backup.dump                    # опционально: дамп PostgreSQL
```

Минимальный набор **без карты и без дампа БД**:

- `infolake_full_offline.tar`
- папка проекта (с `fixtures/`)
- `backend/.env`

---

## 5. Развёртывание на оффлайн-машине

### 5.1. PostgreSQL

1. Установите PostgreSQL (если ещё нет).
2. Создайте БД и пользователя:

```sql
CREATE USER map_user WITH PASSWORD 'qwerty123~';
CREATE DATABASE map OWNER map_user;
GRANT ALL PRIVILEGES ON DATABASE map TO map_user;
```

3. Разрешите подключения с Docker. В `pg_hba.conf` добавьте (для Docker Desktop на Windows):

```
host    all    all    172.16.0.0/12    scram-sha-256
host    all    all    192.168.0.0/16   scram-sha-256
```

В `postgresql.conf`: `listen_addresses = '*'`

Перезапустите PostgreSQL.

### 5.2. Файл backend/.env

Скопируйте `backend/env-example` → `backend/.env`:

```env
DB_NAME=map
DB_USER=map_user
DB_PASSWORD=qwerty123~
DB_HOST=localhost
DB_PORT=5432
```

> В контейнере `DB_HOST` переопределяется на `host.docker.internal` через `docker-compose.yml`.

### 5.3. Загрузка Docker-образов

```powershell
cd путь\к\Lake_grok

# Автоматически: последний infolake_full_offline*.tar
.\import-and-start.ps1

# Или явно:
.\import-and-start.ps1 -TarFile "..\infolake_full_offline.tar"
```

Вручную:

```powershell
docker load -i infolake_full_offline.tar
docker compose up -d --no-build
```

### 5.4. Миграции БД

При первом запуске `docker-entrypoint.sh` выполняет `migrate` автоматически.  
Если контейнер уже был запущен ранее:

```powershell
docker compose exec backend python manage.py migrate
```

### 5.5. Восстановление дампа БД (если есть map_backup.dump)

```powershell
# Остановить backend, чтобы не было активных соединений
docker compose stop backend

pg_restore -h localhost -U map_user -d map -c map_backup.dump

docker compose start backend
```

Флаг `-c` удаляет существующие объекты перед восстановлением. Без него — только добавление данных.

---

## 6. Импорт каталога вооружения

Каталог техники **не входит** в Docker-образ. Данные лежат в репозитории и импортируются командой Django.

### 6.1. Основной способ — фикстура из репозитория

Подходит для **чистой** установки и обновления каталога без интернета:

```powershell
docker compose exec backend python manage.py migrate

docker compose exec backend python manage.py import_equipment_catalog `
  --input equipment/catalog/fixtures
```

Что импортируется:

| Данные | Количество |
|--------|------------|
| Образцы техники | 49 |
| Категории | 20 (ВВС, СВ, ПВО, ВМФ и подкатегории) |
| Параметры ТТХ | 7 |
| Страны | get_or_create по ISO (RU, US, DE, FR, GB, …) |

Изображения **не импортируются** (данные и ТТХ только).  
Для фото: скопируйте `backend/equipment/catalog/images/` и выполните импорт с `--with-images` или `load_equipment_catalog --with-images`.

### 6.2. Альтернатива — загрузка из data.py

Если на оффлайн-машине есть полный код `backend/equipment/catalog/data.py`:

```powershell
docker compose exec backend python manage.py load_equipment_catalog --clear-first
```

Флаги:

| Флаг | Назначение |
|------|------------|
| `--clear-first` | Очистить старый каталог перед загрузкой |
| `--with-images` | Прикрепить фото из `catalog/images/`, если файлы есть |
| `--no-clear` (import) | Добавить к существующим без очистки |

### 6.3. Импорт из bundle (если экспортировали с другой машины)

На машине с интернетом:

```powershell
docker compose exec backend python manage.py export_equipment_catalog `
  --output equipment/catalog/bundle
```

Скопируйте папку `backend/equipment/catalog/bundle/` на оффлайн-машину:

```powershell
docker compose exec backend python manage.py import_equipment_catalog `
  --input equipment/catalog/bundle
```

### 6.4. Что затрагивает импорт / очистка каталога

**Импорт и `clear_equipment_catalog` изменяют только:**

- `Equipment`, `EquipmentCategory`, `EquipmentParameterDefinition`
- `EquipmentParameterValue`, `EquipmentImage`, `UnitOfMeasure`

**Не затрагивают:**

- Объекты карты (`Target`), события, формуляры
- Справочник стран (`Country`) — существующие записи не удаляются
- Типы зон (`ActionType`)

**Побочный эффект:** при очистке каталога удаляются связи `TargetEquipment` на объектах (CASCADE). Сами объекты остаются.

Удалить только каталог:

```powershell
docker compose exec backend python manage.py clear_equipment_catalog --yes
```

---

## 7. Дополнительные данные (опционально)

### Демо-размещение техники на карте

Создаёт 6 демо-площадок с привязкой техники (отдельно от полного каталога):

```powershell
docker compose exec backend python manage.py seed_equipment_demo
```

### Тестовые объекты из Excel

Требует `Data.xlsx` в корне проекта (не в git):

```powershell
docker compose exec backend python manage.py seed_test_targets
```

---

## 8. Обновление существующей оффлайн-установки

### Обновление Docker-образов

На машине **с интернетом**:

```powershell
git pull
.\export-offline.ps1
```

На **оффлайн-машине**:

```powershell
docker compose down
docker load -i infolake_full_offline.tar
docker compose up -d --no-build
docker compose exec backend python manage.py migrate
```

### Обновление только каталога техники

Скопируйте обновлённую папку `backend/equipment/catalog/fixtures/` (или весь `backend/equipment/catalog/`):

```powershell
docker compose exec backend python manage.py import_equipment_catalog `
  --input equipment/catalog/fixtures
```

Импорт по умолчанию **очищает** старый каталог и загружает новый.

### Обновление кода без пересборки образов

Если изменился только Python/JS-код (volumes монтируют `./backend` и `./frontend`):

1. Скопируйте обновлённые файлы поверх проекта
2. `docker compose restart backend frontend`
3. `docker compose exec backend python manage.py migrate`

Пересборка образов нужна при изменении `Dockerfile`, `requirements.txt`, `package.json`.

---

## 9. Проверка работоспособности

```powershell
docker compose ps
```

| Сервис | URL | Ожидание |
|--------|-----|----------|
| Frontend | http://localhost:5173 | Карта загружается |
| Backend API | http://localhost:8000/api/v1/ | JSON-ответ |
| Admin | http://localhost:8000/admin/ | Django Unfold |
| TileServer | http://localhost:8080 | Карта / health |
| Каталог техники | Справочники → Вооружение | 49 образцов, категории ВМФ |

Проверка каталога в консоли:

```powershell
docker compose exec backend python manage.py shell -c `
  "from equipment.models import Equipment; print(Equipment.objects.count())"
```

Ожидаемый результат после импорта: **49**.

Логи:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 10. Частые проблемы

| Проблема | Решение |
|----------|---------|
| `docker compose up` пытается собрать образы | Используйте `--no-build` |
| `pull access denied` / `unable to pull` | Образы не загружены: `docker load -i infolake_full_offline.tar` |
| Backend не подключается к PostgreSQL | Проверьте `.env`, `pg_hba.conf`, что PostgreSQL слушает сеть |
| Пустая карта | Нет `tileserver/data/map.mbtiles` — скопируйте отдельно |
| Каталог техники пуст | Выполните `import_equipment_catalog` (раздел 6) |
| После импорта каталога пропала техника на объектах | Ожидаемо при `--clear-first`: связи TargetEquipment удалены CASCADE; добавьте заново в UI |
| Frontend не видит API | `VITE_API_URL` задаётся при сборке образа; пересоберите frontend на машине с интернетом |
| HMR не работает по IP LAN | Измените `VITE_HMR_HOST` в `docker-compose.yml`, пересоберите frontend |

---

## 11. Чек-лист

### Машина с интернетом

- [ ] `git pull` (ветка `develop-weaponlist`)
- [ ] `.\export-offline.ps1` → `infolake_full_offline.tar`
- [ ] `build_equipment_catalog_fixture` (если меняли data.py)
- [ ] (опционально) `pg_dump` / копия `map.mbtiles`
- [ ] Скопировать пакет на носитель

### Оффлайн-машина

- [ ] PostgreSQL установлен, БД `map` создана
- [ ] `backend/.env` настроен
- [ ] `docker load -i infolake_full_offline.tar`
- [ ] `docker compose up -d --no-build`
- [ ] `migrate` выполнен
- [ ] `import_equipment_catalog --input equipment/catalog/fixtures`
- [ ] (опционально) `pg_restore` / `seed_equipment_demo`
- [ ] `map.mbtiles` на месте
- [ ] http://localhost:5173 открывается, в справочнике 49 образцов

---

## Команды — краткая шпаргалка

```powershell
# === Оффлайн-машина: первый запуск ===
docker load -i infolake_full_offline.tar
docker compose up -d --no-build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py import_equipment_catalog --input equipment/catalog/fixtures

# === Проверка ===
docker compose ps
docker compose logs -f backend

# === Обновление каталога ===
docker compose exec backend python manage.py import_equipment_catalog --input equipment/catalog/fixtures

# === Удалить только каталог (остальная БД не затрагивается) ===
docker compose exec backend python manage.py clear_equipment_catalog --yes
```

---

**Дата документа:** 2026-06-26  
**Версия каталога:** 49 образцов (manifest v1)  
**Размер `infolake_full_offline.tar`:** ~1.8 ГБ (актуализирован при сборке образов develop-weaponlist)
