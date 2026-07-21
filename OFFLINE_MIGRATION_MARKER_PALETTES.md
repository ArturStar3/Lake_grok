# Оффлайн-миграция: палитры цветов маркеров стран

Дополнение к [OFFLINE_MIGRATION.md](OFFLINE_MIGRATION.md). Описывает обновление с версии, где у страны было поле **`Country.color`** (enum: blue, green, …), на **`Country.marker_palette`** (справочник из 4 hex-цветов).

Миграция БД: **`formular.0052_marker_color_palette`** — создаёт палитры, переносит страны, удаляет столбец `color`. Данные палитр зашиты в миграцию (интернет не нужен).

---

## 1. Что меняется

| Было | Стало |
|------|--------|
| `country.color` в API | `country.marker_palette` (объект с `color_first` … `color_forth`) |
| CSS `.icon__blue` и т.д. | Inline `--marker-c1` … на `.marker-palette` |
| Выбор цвета в админке (enum) | **Формуляр → Палитры маркеров** + FK у **Стран** |

Frontend и backend должны обновляться **вместе**. Старый фронт с новым API (или наоборот) даст пустые/серые маркеры.

---

## 2. Машина с интернетом (подготовка)

### 2.1. Проверка и сборка одной командой

```powershell
cd D:\Artur\Проект\Lake_grok
git pull
.\scripts\offline\prepare-marker-palette-release.ps1
```

Скрипт:

- проверяет наличие миграции `0052` и ключевых файлов фронта;
- запускает `api.tests.test_marker_color_palettes` в Docker;
- вызывает `export-offline.ps1` (образы + `infolake_full_offline.tar`).

Без пересборки образов (код уже собран):

```powershell
.\scripts\offline\prepare-marker-palette-release.ps1 -SkipOfflineExport
.\export-offline.ps1 -SkipBuild
```

### 2.2. Минимальный набор файлов для переноса (помимо tar)

Убедитесь, что на носителе есть **актуальный код**, не только Docker-образ:

- `backend/formular/migrations/0052_marker_color_palette.py`
- `backend/formular/models.py`, `admin.py`, `api/*` (serializers, views, urls)
- `backend/formular/management/commands/verify_marker_palette_migration.py`
- `backend/formular/management/commands/export_marker_palettes.py`
- `frontend/src/utils/markerPalette.js`, `svgUtils.js`, `MapComponent.*`, модалки стран/объектов
- `scripts/offline/*.ps1`, этот файл

> Backend в Docker монтирует `./backend:/app` — **миграции на диске обязательны**, даже если образ backend пересобран.

---

## 3. Оффлайн-сервер (обновление)

### 3.1. Резервная копия БД (рекомендуется)

PostgreSQL на **хосте** (см. `DB_HOST` в `backend/.env`):

```powershell
cd D:\InfoLake\Lake_grok
.\scripts\offline\backup-postgres-before-migrate.ps1
```

Файл появится в `backups\infolake_pre_migrate_YYYYMMDD_HHMMSS.dump`.

Вручную (если нет скрипта):

```powershell
pg_dump -h localhost -U infolake -Fc -f backups\before_0052.dump infolake_db
```

### 3.2. Обновить код и образы

1. Скопировать папку проекта и `infolake_full_offline.tar`.
2. Полный цикл (load + up + migrate + проверка):

```powershell
cd D:\InfoLake\Lake_grok
.\scripts\offline\post-update-offline.ps1
```

Или по шагам:

```powershell
.\import-and-start.ps1
.\scripts\offline\apply-marker-palette-migration.ps1 -ExpectSeedPalettes
```

### 3.3. Что делает `apply-marker-palette-migration.ps1`

1. `python manage.py migrate --noinput`
2. `python manage.py verify_marker_palette_migration --min-palettes 5 --expect-seed-palettes`
3. `python manage.py export_marker_palettes` → JSON в `backups/` (аудит после миграции)

---

## 4. Проверка после миграции

### 4.1. CLI

```powershell
docker compose exec backend python manage.py verify_marker_palette_migration --min-palettes 5 --expect-seed-palettes
```

Ожидание: **`Проверка палитр маркеров: OK`**, 5 палитр, все страны с `marker_palette`.

### 4.2. API (с токеном пользователя)

```http
GET http://localhost:8000/api/v1/marker-color-palettes/
GET http://localhost:8000/api/v1/countries/
```

У страны **не должно** быть поля `color`. Должен быть вложенный `marker_palette` с четырьмя hex.

### 4.3. UI

| Место | Проверка |
|--------|----------|
| Карта | Маркеры раскрашены как раньше (по палитре страны) |
| Админка Django | **Палитры маркеров** — 5 записей; **Страны** — выбор палитры |
| Редактирование страны (UI) | Select «Палитра маркера», не enum blue/green |
| Браузер | **Ctrl+F5** (старый JS мог закэшироваться) |

---

## 5. Стандартные палитры после 0052

Создаются автоматически (значения из прежнего `MapComponent.css`):

| Название | color_first | color_second | color_third | color_forth |
|----------|-------------|--------------|-------------|-------------|
| Синий | #008DD2 | #FEFEFE | #00A0E3 | #A2D9F7 |
| Зелёный | #0e970e | #FEFEFE | #0bc214 | #a2f7bc |
| Красный | #970e0e | #FEFEFE | #c20b0b | #f7baa2 |
| Жёлтый | #8e970e | #FEFEFE | #c2bf0b | #f7f1a2 |
| Морской | #0077BE | #5aad73 | #35a5e6 | #95d3f7 |

Сопоставление: старый `Country.color` (`blue`, `green`, …) → соответствующая палитра; неизвестное значение → **Синий**.

---

## 6. Настройка цветов без интернета

1. **Админка** → **Палитры маркеров** — создать/изменить 4 цвета (#RRGGBB).
2. **Страны** — выбрать палитру для каждой страны.
3. Обновить карту (Ctrl+F5). Перезапуск контейнеров не нужен.

Экспорт текущих настроек (архив/аудит):

```powershell
docker compose exec backend python manage.py export_marker_palettes -o /app/media/palettes.json
```

Файл на хосте: `backend\media\palettes.json`.

---

## 7. Откат

1. Остановить приложение: `docker compose down`
2. Восстановить dump **до** migrate:

```powershell
pg_restore -h localhost -U infolake -d infolake_db --clean --if-exists backups\infolake_pre_migrate_XXXXXX.dump
```

3. Откатить **код** проекта на предыдущий коммит (без 0052) и загрузить **старый** `infolake_full_offline.tar`.
4. `import-and-start.ps1`

> Откат только БД без отката кода/образов приведёт к несовместимости схемы и приложения.

---

## 8. Частые проблемы

| Симптом | Причина | Действие |
|---------|---------|----------|
| Маркеры серые / без градиента | Старый frontend | Ctrl+F5; убедиться, что обновлён `MapComponent.css` и `markerPalette.js` |
| `column country.color does not exist` | Старый код + новая БД | Обновить backend/frontend с диска или образ |
| `marker_palette_id violates not-null` | migrate не дошёл до конца | `migrate`; проверить лог; назначить палитру в admin |
| API отдаёт `color` | Старый backend | Обновить код в `./backend`, перезапустить контейнер |
| verify: нет «Синий» | Пустая БД / migrate с нуля без 0052 | `migrate formular 0052` |
| Нет `0052` на диске | Скопировали только tar | Скопировать полный git/zip проекта |

---

## 9. Скрипты

| Скрипт | Где | Назначение |
|--------|-----|------------|
| [prepare-marker-palette-release.ps1](scripts/offline/prepare-marker-palette-release.ps1) | Online | Тесты + export-offline |
| [backup-postgres-before-migrate.ps1](scripts/offline/backup-postgres-before-migrate.ps1) | Offline | pg_dump перед migrate |
| [apply-marker-palette-migration.ps1](scripts/offline/apply-marker-palette-migration.ps1) | Offline | migrate + verify + export JSON |
| [post-update-offline.ps1](scripts/offline/post-update-offline.ps1) | Offline | import-and-start + apply migration |

Management-команды (в контейнере backend):

- `verify_marker_palette_migration`
- `export_marker_palettes`

---

## 10. Чек-лист оффлайн-обновления (палитры)

**Online**

- [ ] `prepare-marker-palette-release.ps1` без ошибок
- [ ] `infolake_full_offline.tar` + полная папка проекта на носителе

**Offline**

- [ ] `backup-postgres-before-migrate.ps1`
- [ ] `post-update-offline.ps1` или import + `apply-marker-palette-migration.ps1`
- [ ] `verify_marker_palette_migration` → OK
- [ ] Карта и админка «Палитры маркеров»
- [ ] JSON-экспорт в `backups/` сохранён
