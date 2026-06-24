# project_context.md — InfoLake (Lake_grok)

> Самодостаточный справочник по архитектуре проекта для AI-агентов и разработчиков.  
> Обновляйте этот документ при изменении API, моделей, конфигурации или ключевых потоков данных.

---

## 1. Назначение проекта

### Основная цель

**InfoLake** — веб-система электронной разведывательной сводки (ОР — объекты разведки). Объединяет интерактивную карту, справочники, формуляры объектов, события и аналитические инструменты (зоны действия, пересечения) в едином интерфейсе.

### Бизнес-задачи

- Ведение и отображение объектов разведки на карте с привязкой к странам, типам и иерархии подчинённости.
- Хранение и редактирование **формуляров** — структурированных текстовых карточек по разделам с вложениями.
- Управление **событиями** (точки, окружности, полигоны) с фильтрацией по дате, времени, стране и типу.
- Справочная информация по **странам** (разделы, тексты, изображения).
- Визуализация **радиусов действия** по типам действий и поиск **пересечений** зон на карте.
- Инструменты измерения расстояний на карте.
- Администрирование справочников и контента через Django Admin.

### Основные пользователи

- Операторы / аналитики разведывательной сводки — работа с картой, объектами, событиями, формулярами.
- Администраторы контента — настройка справочников (страны, маркеры, типы, разделы) через `/admin/`.
- Разработчики / DevOps — развёртывание в Docker (в т.ч. полностью оффлайн).

### Ключевые сценарии использования

| Сценарий | Описание |
|----------|----------|
| Просмотр объектов на карте | Загрузка targets, фильтрация по стране/типу/названию, кластеризация маркеров, fly-to |
| CRUD объекта | Создание/редактирование через модальные окна; привязка маркера, типа, родителя, actions |
| Формуляр объекта | Просмотр и массовое редактирование разделов; вложения по разделам |
| Зоны действия | Отображение окружностей по `TargetAction`; фильтр по типам действий; расчёт пересечений |
| События | Вкладка «События»: таблица + оверлеи на карте; CRUD с геометрией в JSON |
| Информация по стране | Клик по стране на карте → модальное окно; редактирование разделов и вложений |
| Оффлайн-развёртывание | Сборка образов на машине с интернетом → `docker save` → перенос → `docker load` → `docker compose up -d --no-build` |

---

## 2. Технологический стек

### Backend (`backend/`)

| Категория | Технология |
|-----------|------------|
| Язык | Python 3.12 |
| Фреймворк | Django 6.0.6 |
| API | Django REST Framework 3.17.1 |
| ORM | Django ORM → PostgreSQL |
| БД | PostgreSQL (на хосте, `host.docker.internal` из контейнера) |
| Конфигурация | django-environ 0.13.0 |
| CORS | django-cors-headers 4.9.0 |
| Медиа | Pillow 12.2.0 |
| Утилиты | openpyxl 3.1.5 (seed), watchdog 6.0.0 |
| Драйвер БД | psycopg2-binary 2.9.12 |
| Очереди | Не используются |
| Внешние сервисы | Нет (self-hosted) |
| Сборка/деплой | Docker (`python:3.12-slim`), `docker-entrypoint.sh` (migrate + runserver) |

### Frontend (`frontend/`)

| Категория | Технология |
|-----------|------------|
| Язык | JavaScript (ES modules) |
| UI | React 18.2 |
| Сборка | Vite 7 |
| HTTP | axios 1.4.0 |
| Карта | Leaflet 1.9.4, react-leaflet 4.2.1 |
| Маршрутизация | react-router-dom установлен, **не используется** |
| Кластеризация | Собственная реализация (`markerClusteringUtils.js`) |
| Очереди | Нет |
| Сборка/деплой | Docker (`node:20-alpine`), dev-сервер Vite на порту 5173 |

### TileServer (`tileserver/`)

| Категория | Технология |
|-----------|------------|
| Сервер | maptiler/tileserver-gl (Docker) |
| Данные | MBTiles (`map.mbtiles`), стили `borders-labels`, `basic` |
| Порт | 8080 |

### Инфраструктура (корень)

| Категория | Технология |
|-----------|------------|
| Оркестрация | docker-compose.yml (3 сервиса) |
| Оффлайн | `export-offline.ps1`, `import-and-start.ps1`, `offline/python-wheels/` |
| Данные для seed | `Data.xlsx`, папка `Значки/` (SVG-иконки) |

---

## 3. Структура проекта

```
Lake_grok/
├── backend/                 # Django API + Admin + доменные модели
│   ├── infolake/            # Настройки проекта (settings, urls, wsgi)
│   ├── api/                 # REST-слой: views, serializers, urls
│   ├── formular/            # Доменные модели, admin, migrations, seed
│   ├── media/               # Загруженные файлы (маркеры, вложения)
│   ├── manage.py
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── requirements.txt
│   └── .env                 # Секреты БД (не в git)
├── frontend/                # React SPA
│   ├── src/
│   │   ├── components/      # UI: Formular, MapComponent, модалки, таблицы
│   │   ├── hooks/           # useReferenceData, useTargetFormData, ...
│   │   ├── config/          # api.js, tiles.js
│   │   ├── utils/           # геометрия, фильтры, SVG
│   │   └── constants/       # mapConstants.js
│   ├── public/              # Статика (sprite, geo JSON — ожидается custom.geo.json)
│   ├── Dockerfile
│   └── package.json
├── tileserver/              # Конфиг и данные для TileServer GL
│   ├── config.json
│   ├── data/                # map.mbtiles
│   ├── styles/              # borders-labels, maptiler-basic
│   └── fonts/               # PBF-шрифты (Open Sans)
├── offline/                 # Python wheels для оффлайн-установки
├── docker-compose.yml       # tileserver + backend + frontend
├── Data.xlsx                # Источник для seed_test_targets
├── export-offline.ps1       # Экспорт Docker-образов
├── import-and-start.ps1     # Импорт и запуск оффлайн
├── docker_instruction.md    # Подробная инструкция оффлайн-деплоя
├── project_analysis.md      # Аудит кода (проблемы, рекомендации)
└── project_context.md       # Этот файл
```

### Назначение папок

| Папка | Назначение | Связи |
|-------|------------|-------|
| `backend/infolake/` | Конфигурация Django-проекта | Подключает `api`, `formular`; точка входа WSGI |
| `backend/formular/` | Доменный слой (модели, admin, миграции) | Используется `api/`; данные в PostgreSQL |
| `backend/api/` | REST API (тонкий слой над моделями) | Вызывается фронтендом по `/api/v1/` |
| `frontend/src/components/Formular/` | Главный orchestrator UI (~1000 строк) | axios → backend; props → MapComponent |
| `frontend/src/components/MapComponent/` | Leaflet-карта, маркеры, зоны, события | Тайлы ← tileserver; данные ← Formular |
| `frontend/src/hooks/` | Кэш справочников, данные форм | `useReferenceData` → `/api/v1/markers` и др. |
| `tileserver/` | Оффлайн-карта (растровые тайлы) | Запросы браузера на `:8080` |
| `offline/` | Wheel-пакеты Python | Резерв для установки без PyPI |

---

## 4. Архитектура

### Слои приложения

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (React)                                   │
│  Formular → MapComponent, Tables, Modals, Features       │
├─────────────────────────────────────────────────────────┤
│  Client logic (hooks, utils)                             │
│  useReferenceData, circleIntersection, markerFilters     │
├─────────────────────────────────────────────────────────┤
│  API Client (axios)                                      │
│  config/api.js → http://host:8000/api/v1/               │
├─────────────────────────────────────────────────────────┤
│  REST API (Django REST Framework)                        │
│  api/views.py, api/serializers.py                        │
├─────────────────────────────────────────────────────────┤
│  Domain (Django models)                                  │
│  formular/models.py                                      │
├─────────────────────────────────────────────────────────┤
│  Persistence                                             │
│  PostgreSQL + MEDIA (файлы на диске)                     │
└─────────────────────────────────────────────────────────┘
```

### Точки входа

| Компонент | Точка входа | Порт |
|-----------|-------------|------|
| Frontend | `frontend/index.html` → `src/main.jsx` → `App.jsx` → `Formular` | 5173 |
| Backend | `manage.py` / `infolake/wsgi.py` | 8000 |
| Admin | `/admin/` | 8000 |
| API | `/api/v1/` | 8000 |
| TileServer | `tileserver/config.json` | 8080 |

### Маршруты запросов

**Типичный запрос данных объектов:**
```
Browser → GET /api/v1/targets/ → TargetViewSet → TargetSerializer → PostgreSQL
Browser → GET /api/v1/markers/ → MarkerViewSet (кэш 5 мин на клиенте)
Browser → GET :8080/styles/borders-labels/{z}/{x}/{y}.png → TileServer GL
```

**Создание объекта:**
```
AddTargetModal → POST /api/v1/targets/ → TargetCreateSerializer.create()
  → Target + bulk_create(TargetAction)
```

**Формуляр:**
```
FormularModal → GET /api/v1/formular/{uuid}/ → FormularView
FormularEditor → POST /api/v1/formular/{uuid}/bulk/ → FormularBulkUpdateView
```

### Взаимодействие компонентов

```
┌──────────┐     HTTP      ┌─────────────┐     SQL      ┌────────────┐
│ Browser  │──────────────▶│   Backend   │─────────────▶│ PostgreSQL │
│ (React)  │               │  (Django)   │              │  (host)    │
└────┬─────┘               └──────┬──────┘              └────────────┘
     │                            │
     │  tiles PNG                 │ media /media/
     ▼                            ▼
┌──────────┐               ┌─────────────┐
│TileServer│               │ backend/    │
│  GL:8080 │               │ media/      │
└──────────┘               └─────────────┘
```

### Потоки данных

1. **Справочники** (countries, markers, action-types, target-types) — загружаются при старте через `useReferenceData`, кэш 5 минут, SVG маркеров предзагружаются.
2. **Объекты (targets)** — полная загрузка списка в `Formular`, фильтрация на клиенте.
3. **События** — загрузка с серверной фильтрацией (`date_from`, `countries`, …).
4. **Зоны действия** — `Target.actions[]` с `radius` (км) → Leaflet `Circle`; пересечения считаются в `circleIntersection.js` на клиенте.
5. **Медиа** — URL вида `/media/markers/...` (DEBUG) или через backend.

### Текстовая диаграмма

```
                    ┌─────────────────────────────────────┐
                    │           Пользователь               │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
     │   Frontend     │    │    Backend     │    │  TileServer GL │
     │  React+Vite    │    │ Django+DRF     │    │  MBTiles       │
     │  Leaflet map   │    │  :8000         │    │  :8080         │
     └───────┬────────┘    └───────┬────────┘    └────────────────┘
             │                     │
             │  REST /api/v1       │
             └────────────────────▶│
                                   │
                                   ▼
                          ┌────────────────┐
                          │  PostgreSQL    │
                          │ (host machine) │
                          └────────────────┘
```

---

## 5. Модели данных

Все модели в `backend/formular/models.py`. 17 сущностей.

### ER-описание (текст)

```
Country 1──* Target
Country 1──* CountryInfo
Country 1──* CountryAttachment
Country 1──* Event
Country *──* TargetType (M2M: applicable_target_types)

CountrySections 1──* CountryInfo
CountrySections 1──* CountryAttachment
CountrySections 0..1──* CountrySections (parent/children)

Marker 1──* Target
EventMarker 1──* Event

TargetType 1──* Target
Target 0..1──* Target (parent/children, self-FK)
Target 1──* TargetAction
Target 1──* Formular
Target 1──* FormularAttachment

ActionType 1──* TargetAction

EventType 1──* Event

FormularSections 1──* Formular
FormularSections 1──* FormularAttachment
FormularSections 0..1──* FormularSections (parent/children)
```

### Основные сущности

| Модель | Назначение | Ключевые поля | Связи |
|--------|------------|---------------|-------|
| **Country** | Справочник стран | `title`, `title_short`, `iso_code`, `color` | → targets, infos, events |
| **CountrySections** | Дерево разделов инфо по стране | `title`, `order`, `parent`, `is_hidden` | self-FK, → infos, attachments |
| **CountryInfo** | Текст раздела для страны | `content` | FK country, section |
| **CountryAttachment** | Изображение раздела страны | `title`, `image`, UUID PK | FK country, section |
| **Marker** | SVG-маркер объекта | `path`, `top/width/height`, `scale`, `is_flag`, `order` | → targets |
| **EventMarker** | SVG-маркер события | `path` | → events |
| **ActionType** | Тип действия (зона) | `title`, `animation` (legacy) | → TargetAction |
| **TargetType** | Тип объекта разведки | `title` | M2M countries; → targets |
| **Target** | Объект разведки (ОР) | UUID PK, `title`, `label`, `lat`, `lng`, `action_radius` (legacy) | FK country, marker, type, parent; → actions, formular |
| **TargetAction** | Радиус действия по типу | `radius` (км) | FK target, action_type |
| **EventType** | Тип события | `title` | → events |
| **Event** | Событие на карте | `title`, даты/время, `color`, `shape` (JSON) | FK event_type, country, marker |
| **FormularSections** | Раздел формуляра | `title`, `order`, `parent`, `is_hidden` | self-FK; → formular, attachments |
| **Formular** | Пункт формуляра | `content` | FK target, section |
| **FormularAttachment** | Вложение формуляра | `title`, `image`, UUID PK | FK target, section |

### Важные замечания по моделям

- Поля `Target.lat` / `Target.lng` в verbose_name подписаны как «Долгота» / «Широта» — **возможна путаница**; фронт использует их как lat/lng Leaflet.
- `Target.country.related_name = 'contries'` — опечатка (должно быть `targets`).
- `action_radius` на Target и `animation` на ActionType — **legacy**, основная логика зон в `TargetAction`.
- `Country.iso_code` — unique закомментирован.
- `Event.shape` — JSON: `{type: 'point'|'circle'|'polygon', coordinates: ...}`.

---

## 6. API

Базовый префикс: **`/api/v1/`**  
Аутентификация: **отсутствует** (`AllowAny` на всех endpoints).  
Пагинация: **не настроена** (полные списки).

### ViewSets (стандартные CRUD: list, retrieve, create, update, partial_update, destroy — если не ReadOnly)

#### `GET/POST /api/v1/targets/`

| | |
|---|---|
| **Назначение** | Список / создание объектов разведки |
| **Query (list)** | `?parent=<id>` — фильтр по родителю |
| **POST body** | `country`, `title`, `label`, `marker`, `type`, `lat`, `lng`, `parent`, `action_radius`, `actions: [{action_type_id, radius}]` |
| **Ответ** | `TargetSerializer`: вложенные country, marker, type, actions, children_count |
| **Сервисы** | `TargetViewSet`, `TargetCreateSerializer`, `_target_list_queryset()` |

#### `GET/PUT/PATCH/DELETE /api/v1/targets/{uuid}/`

| | |
|---|---|
| **Назначение** | Детали / обновление / удаление объекта |
| **PUT/PATCH** | При передаче `actions` — атомарная замена всех TargetAction |
| **Сервисы** | `TargetViewSet.update` (@transaction.atomic) |

#### `GET /api/v1/targets/parent-options/`

| | |
|---|---|
| **Назначение** | Лёгкий список для выбора родителя |
| **Ответ** | `[{id, title, label}]` |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/countries/`

| | |
|---|---|
| **Назначение** | CRUD стран |
| **Ответ** | `{id, title, title_short, iso_code, color}` |

#### `GET /api/v1/markers/`, `GET /api/v1/markers/{id}/`

| | |
|---|---|
| **Назначение** | Справочник маркеров (read-only) |
| **Ответ** | `{id, title, path, top, width, height, order, scale, is_flag}` |

#### `GET /api/v1/event-markers/`

| | |
|---|---|
| **Назначение** | Маркеры событий (read-only) |

#### `GET /api/v1/action-types/`

| | |
|---|---|
| **Назначение** | Типы действий (read-only) |
| **Ответ** | `{id, title, animation}` |

#### `GET /api/v1/target-types/`

| | |
|---|---|
| **Назначение** | Типы объектов + список country PK |
| **Ответ** | `{id, title, countries: [int]}` |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/event-types/`

| | |
|---|---|
| **Назначение** | CRUD типов событий |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/events/`

| | |
|---|---|
| **Назначение** | CRUD событий |
| **Query** | `date_from`, `date_to`, `time_from`, `time_to`, `countries` (csv id), `title` (icontains), `event_types` (csv id) |
| **Ответ (read)** | Вложенные country, marker, event_type + shape, color, даты |
| **Сервисы** | `EventViewSet.get_queryset` — overlap-фильтры дат/времени |

#### `GET /api/v1/country-sections/`

| | |
|---|---|
| **Назначение** | Разделы информации по странам (read-only) |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/country-infos/`

| | |
|---|---|
| **Назначение** | CRUD текстов по странам |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/country-attachments/`

| | |
|---|---|
| **Назначение** | CRUD изображений стран |
| **Query (list)** | **Обязателен** `?country=` или `?section=` (иначе пустой список) |

#### `GET /api/v1/formular-sections/`

| | |
|---|---|
| **Назначение** | Разделы формуляра (read-only) |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/formular-attachments/`

| | |
|---|---|
| **Назначение** | CRUD вложений формуляра |
| **Query (list)** | **Обязателен** `?target=` или `?section=` |

### Отдельные endpoints

#### `GET /api/v1/country/{iso_code}/`

| | |
|---|---|
| **Назначение** | Вся CountryInfo для страны по ISO-коду |
| **Ответ** | `[{id, country, section: {...}, content}]` |
| **Ошибки** | 404 если страна не найдена |

#### `GET /api/v1/formular/{target_id}/`

| | |
|---|---|
| **Назначение** | Формуляр объекта + прямые подчинённые |
| **Ответ** | `{formular: [...], subordinates: [...]}` |

#### `POST /api/v1/formular/{target_id}/bulk/`

| | |
|---|---|
| **Назначение** | Массовый upsert пунктов формуляра |
| **Body** | `{items: [{section_id, content}]}` |
| **Ответ** | `{detail: "Formular updated successfully"}` |

### Django Admin

- `/admin/` — полное управление моделями (кроме Event, CountryInfo, Formular — только через inline).

---

## 7. Бизнес-логика

### Объекты разведки (Target)

- Иерархия через `parent` → `children`; API отдаёт `children_count`.
- При создании/обновлении `actions` — связка тип действия + радиус (км); старые actions удаляются и пересоздаются.
- Фильтр `?parent=` для получения прямых потомков.
- Тип объекта (`TargetType`) может быть ограничен странами через M2M; пустой список = все страны.

### Зоны действия

- Каждый `TargetAction` задаёт окружность: центр = координаты target, радиус в км.
- На карте зоны фильтруются по типам действий (чекбоксы по странам).
- **Пересечения** двух зон вычисляются на клиенте (`calculateCircleIntersections`, `findAllIntersections`) — O(n²) по видимым зонам.
- Legacy: поле `action_radius` на Target — не основной источник зон.

### События

- Геометрия в `shape` JSON: point, circle, polygon.
- Серверная фильтрация по пересечению диапазонов дат и времени (open-ended интервалы поддерживаются).
- Цвет события — hex (`#2f80ed` по умолчанию).

### Формуляры

- Структура разделов задаётся в `FormularSections` (дерево, `is_hidden` скрывает в UI).
- Контент хранится в `Formular` (одна запись на пару target + section).
- Bulk update: upsert по `section_id`, пропуск неизменённых, `transaction.atomic`.

### Страны

- Цвет маркера (`Colors` enum) влияет на отображение флаговых маркеров.
- Информация по стране: разделы + тексты + вложения; доступ по ISO через отдельный endpoint.

### Маркеры

- SVG-файлы с валидацией (`validate_svg`: расширение + MIME).
- `is_flag=true` — маркер-флаг (отдельная логика кластеризации); `false` — обычная иконка.
- Параметры подписи: `top`, `width`, `height`, `scale`.

### Клиентская фильтрация (Formular)

- `filteredObjects` — для карты (страна + тип + название).
- `tableObjects` — для таблицы (тип + название, группировка country → type).
- Справочники кэшируются 5 минут; отмена запросов через `AbortController`.

### Ограничения и проверки

- `CountrySections.clean()` — запрет parent = self.
- Attachments list без фильтра → пустой queryset (защита от полной выгрузки).
- `FormularBulkUpdateView` — валидация существования всех `section_id`.
- Радиусы ≥ 0 (`MinValueValidator`).
- Нет rate limiting, нет auth.

---

## 8. Конфигурация

### Переменные окружения

#### Backend (`backend/.env`)

| Переменная | Назначение | Пример (env-example) |
|------------|------------|----------------------|
| `DB_NAME` | Имя БД PostgreSQL | `map` |
| `DB_USER` | Пользователь БД | `map_user` |
| `DB_PASSWORD` | Пароль БД | *(секрет)* |
| `DB_HOST` | Хост БД | `localhost` / `host.docker.internal` |
| `DB_PORT` | Порт БД | `5432` |

#### Frontend (docker-compose / Vite)

| Переменная | Назначение | Дефолт |
|------------|------------|--------|
| `VITE_API_URL` | URL backend для браузера | `http://localhost:8000` |
| `VITE_TILESERVER_URL` | URL TileServer | `http://localhost:8080` |
| `VITE_HMR_HOST` | Host для Vite HMR WebSocket | `localhost` |
| `CHOKIDAR_USEPOLLING` | Polling для hot-reload в Docker | `true` |
| `CHOKIDAR_INTERVAL` | Интервал polling (мс) | `1000` |

#### TileServer (docker-compose)

| Переменная | Назначение |
|------------|------------|
| `TILESERVER_GL_ALLOWED_HOSTS` | Разрешённые хосты |

### Секреты (только названия)

- `SECRET_KEY` — захардкожен в `settings.py` (не из .env)
- `DB_PASSWORD`
- Содержимое `backend/.env`

### Ключевые конфигурационные файлы

| Файл | Назначение |
|------|------------|
| `docker-compose.yml` | Оркестрация 3 сервисов, env, volumes |
| `backend/infolake/settings.py` | Django: apps, DB, CORS, MEDIA |
| `backend/infolake/urls.py` | admin + api + media |
| `backend/api/urls.py` | Маршруты API |
| `frontend/vite.config.js` | Dev server, HMR, polling |
| `frontend/src/config/api.js` | API_URL |
| `frontend/src/config/tiles.js` | URL тайлов |
| `tileserver/config.json` | Стили, пути к mbtiles и шрифтам |

### Настройки приложения (важные)

- `DEBUG = True`, `ALLOWED_HOSTS = ['*']`, `CORS_ALLOW_ALL_ORIGINS = True` — **не для production без доработки**.
- `LANGUAGE_CODE = 'ru-ru'`, `TIME_ZONE = 'UTC'`.
- `MEDIA_ROOT = backend/media`, `MEDIA_URL = '/media/'`.
- PostgreSQL `CONN_MAX_AGE = 60`.

---

## 9. Зависимости между компонентами

| Компонент | Использует | Для чего |
|-----------|------------|----------|
| Frontend (Formular) | Backend `/api/v1/*` | CRUD объектов, событий, формуляров, стран |
| Frontend (MapComponent) | TileServer GL `:8080` | Растровые тайлы карты |
| Frontend (MapComponent) | `public/geo/custom.geo.json` | Границы стран (GeoJSON) |
| Frontend (hooks) | Backend справочники | countries, markers, types |
| Backend (api) | PostgreSQL | Персистентность всех моделей |
| Backend (api) | `formular.models` | Доменные сущности |
| Backend (Docker) | `host.docker.internal` | Доступ к PostgreSQL на хосте |
| Backend | `backend/media/` | Хранение SVG, изображений |
| TileServer GL | `tileserver/data/map.mbtiles` | Картографические данные |
| TileServer GL | `tileserver/styles/`, `fonts/` | Стили и подписи |
| docker-compose | 3 образа | Единый стек разработки/оффлайн |
| seed_test_targets | Data.xlsx, Значки/ | Генерация тестовых targets |
| Django Admin | formular.models | Ручное управление контентом |

---

## 10. Потенциально критичные места

### Сложный код

| Место | Риск |
|-------|------|
| `frontend/src/components/Formular/Formular.jsx` (~1000 строк) | Монолит: состояние, API, фильтры, модалки — высокая связанность |
| `frontend/src/components/MapComponent/` | Кластеризация флагов/non-flag, зоны, события, measure mode |
| `backend/api/views.py` EventViewSet filters | Сложная Q-логика дат/времени, дублирование веток |
| `backend/formular/admin.py` MarkerAdmin | Синхронная обработка SVG на каждой строке списка |

### Узкие места производительности

| Место | Проблема |
|-------|----------|
| `GET /api/v1/targets/` без пагинации | Полная загрузка всех объектов |
| Клиентские пересечения зон | O(n²) при большом числе видимых actions |
| `Formular.jsx` | 30+ useState, полный ре-рендер при изменениях |
| Admin MarkerAdmin | Чтение/парсинг SVG на каждый ряд |
| Отсутствие виртуализации таблиц | Тормоза при 500+ строк |

### Технический долг

- Нет аутентификации и авторизации API.
- `SECRET_KEY`, `DEBUG`, `CORS` захардкожены небезопасно.
- Legacy поля: `Target.action_radius`, `ActionType.animation`.
- Опечатки: `contries`, `list_filer` в admin.
- `react-router-dom`, `react-leaflet-cluster` — неиспользуемые зависимости.
- Мёртвый код: `App.jsx` imports, `data/objects.js`, `formular/views.py`, `ActionRadiusAnimations.jsx`.
- Frontend Docker запускает dev-сервер, не production build.
- `public/geo/custom.geo.json` отсутствует в репозитории.
- Путаница lat/lng в verbose_name модели Target.
- Дублирование логики создания TargetAction (serializer + view).
- Пустые тесты (`api/tests.py`, `formular/tests.py`).

### Высокая связанность

- `Formular` ↔ все дочерние компоненты и модалки (props drilling).
- `api/views.py` ↔ `api/serializers.py` ↔ `formular/models.py` — изменение модели требует синхронизации 3 файлов + фронт.
- Координаты и радиусы — контракт между backend (км) и frontend (Leaflet + circleIntersection).

---

## 11. Руководство для AI-агентов

### Перед изменением кода

AI обязан:

1. **Изучить соответствующий раздел** этого `project_context.md` (модели → §5, API → §6, конфиг → §8).
2. **Проверить зависимости** — таблица §9; для UI-смен — цепочка Formular → MapComponent → hooks.
3. **Проверить влияние на API** — все endpoints `AllowAny`; изменение сериализатора ломает фронт (axios без версионирования).
4. **Проверить влияние на БД** — миграции в `formular/migrations/`; PostgreSQL на хосте; не забыть MEDIA при добавлении FileField.
5. **Проверить влияние на тесты** — автотестов практически нет; при добавлении логики рекомендуется ручная проверка CRUD + карта.

### Типовые зоны изменений

| Задача | Файлы |
|--------|-------|
| Новое поле объекта | `formular/models.py` → migration → `serializers.py` → `Formular.jsx`, модалки |
| Новый API endpoint | `api/views.py` → `api/urls.py` → `frontend/src/config` + вызов в компоненте |
| Логика зон / пересечений | `circleIntersection.js`, `MapComponent/`, `Formular.jsx` |
| Справочник | модель + ViewSet + `useReferenceData.js` |
| Оффлайн-деплой | `docker-compose.yml`, Dockerfiles, `docker_instruction.md` |

### После изменения кода

AI обязан:

1. **Обновить `project_context.md`** при изменении API, моделей, env, архитектурных потоков или критичных мест.
2. **Проверить целостность архитектуры** — не нарушать разделение formular (домен) / api (REST) / frontend (UI).
3. **Проверить обратную совместимость** — фронт ожидает конкретные поля JSON; bulk formular и nested actions — хрупкие контракты.

---

## 12. Индекс файлов

| Файл | Назначение | Важность |
|------|------------|----------|
| `docker-compose.yml` | Оркестрация tileserver + backend + frontend | Критическая |
| `backend/infolake/settings.py` | Конфигурация Django | Критическая |
| `backend/infolake/urls.py` | Корневые URL (admin, api, media) | Критическая |
| `backend/api/urls.py` | Маршруты REST API | Критическая |
| `backend/api/views.py` | ViewSets, бизнес-логика API | Критическая |
| `backend/api/serializers.py` | Сериализация / десериализация | Критическая |
| `backend/formular/models.py` | Все доменные модели | Критическая |
| `backend/formular/admin.py` | Django Admin | Высокая |
| `backend/formular/admin_inlines.py` | Inline-редакторы в admin | Высокая |
| `backend/formular/enums.py` | Colors, ActionAnimations | Средняя |
| `backend/formular/validators.py` | validate_svg | Средняя |
| `backend/formular/management/commands/seed_test_targets.py` | Seed тестовых данных | Средняя |
| `backend/docker-entrypoint.sh` | migrate + runserver при старте | Высокая |
| `backend/requirements.txt` | Python-зависимости | Высокая |
| `backend/.env` / `env-example` | Подключение к PostgreSQL | Критическая |
| `frontend/src/main.jsx` | Точка входа React | Критическая |
| `frontend/src/App.jsx` | Корневой компонент | Высокая |
| `frontend/src/components/Formular/Formular.jsx` | Главный orchestrator UI | Критическая |
| `frontend/src/components/MapComponent/MapComponent.jsx` | Leaflet-карта | Критическая |
| `frontend/src/components/MapComponent/markerClusteringUtils.js` | Кластеризация маркеров | Высокая |
| `frontend/src/components/MapComponent/MapUtils.jsx` | Рендер флаговых маркеров | Высокая |
| `frontend/src/components/MapComponent/NonFlagMarkerUtils.jsx` | Рендер обычных маркеров | Высокая |
| `frontend/src/hooks/useReferenceData.js` | Кэш справочников | Высокая |
| `frontend/src/hooks/useTargetFormData.js` | Данные для форм target | Высокая |
| `frontend/src/config/api.js` | Базовый URL API | Критическая |
| `frontend/src/config/tiles.js` | URL тайлов TileServer | Критическая |
| `frontend/src/utils/circleIntersection.js` | Геометрия пересечений зон | Высокая |
| `frontend/src/utils/markerFilters.js` | Фильтрация маркеров | Средняя |
| `frontend/vite.config.js` | Vite dev/HMR | Высокая |
| `frontend/package.json` | NPM-зависимости | Высокая |
| `tileserver/config.json` | Конфиг TileServer GL | Высокая |
| `tileserver/data/map.mbtiles` | Картографические тайлы | Высокая |
| `export-offline.ps1` | Экспорт Docker-образов | Средняя |
| `import-and-start.ps1` | Оффлайн-импорт и запуск | Средняя |
| `docker_instruction.md` | Документация оффлайн-деплоя | Средняя |
| `project_analysis.md` | Аудит проблем кода | Справочная |
| `Data.xlsx` | Источник данных для seed | Низкая |
| `analyze_data.py` | Утилита анализа данных | Низкая |

---

*Документ сгенерирован на основе анализа репозитория Lake_grok (infolake). Дата: 2026-06-24.*
