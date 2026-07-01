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
- Администрирование справочников и контента через Django Admin **и** модальное окно «Справочники» на карте (каталог техники, типы зон действия).

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
| Зоны действия | Отображение окружностей по `TargetAction` **и** по технике на объекте (`deployed_equipment`); фильтр по типам действий |
| События | Вкладка «События»: таблица + оверлеи на карте; CRUD с геометрией в JSON |
| Информация по стране | Клик по стране на карте → модальное окно; редактирование разделов и вложений |
| Каталог техники | Справочник образцов (авиация, танки, ЗРК) с ТТХ; CRUD в UI «Справочники»; привязка к объекту с количеством; зоны дальности из каталога |
| Справочники в UI | Модальное окно «Справочники»: вкладка «Вооружение и техника» (образцы, категории, параметры ТТХ, единицы) и «Типы зон действия» |

**Текущая ветка:** `develop-weaponlist` — каталог вооружения и зоны из ТТХ. Детальный план: [`weaponlist_plan.md`](weaponlist_plan.md).

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
| Админка UI | django-unfold 0.67.0 (оффлайн: без CDN, локальная статика) |
| Статика prod | whitenoise 6.9.0 (`collectstatic` в `docker-entrypoint.sh`) |
| Драйвер БД | psycopg2-binary 2.9.12 |
| Очереди | Не используются |
| Внешние сервисы | Нет (self-hosted) |
| Сборка/деплой | Docker (`python:3.12-slim`), `docker-entrypoint.sh` (migrate + collectstatic + runserver) |

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
| Оффлайн | `export-offline.ps1`, `import-and-start.ps1`, `weaponlist_import.md`, `offline/python-wheels/` |
| Данные для seed | `Data.xlsx`, папка `Значки/` (SVG-иконки) |

---

## 3. Структура проекта

```
Lake_grok/
├── backend/                 # Django API + Admin + доменные модели
│   ├── infolake/            # settings, urls, unfold_settings, admin_base
│   ├── api/                 # REST-слой: views, serializers, urls
│   ├── formular/            # ОР, события, формуляры, TargetEquipment (through)
│   ├── equipment/           # Каталог техники (таблицы formular_*)
│   ├── media/               # Загруженные файлы (маркеры, вложения)
│   ├── manage.py
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── requirements.txt
│   └── .env                 # Секреты БД (не в git)
├── frontend/                # React SPA
│   ├── src/
│   │   ├── components/      # UI: Formular, MapComponent, ReferenceData, TargetEquipment, модалки
│   │   ├── hooks/           # useReferenceData, hooks/formular/*, hooks/referenceData/*
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
├── weaponlist_plan.md       # План и статус: каталог техники + зоны (ветка develop-weaponlist)
├── project_analysis.md      # Аудит кода (проблемы, рекомендации)
└── project_context.md       # Этот файл
```

### Назначение папок

| Папка | Назначение | Связи |
|-------|------------|-------|
| `backend/infolake/` | Конфигурация Django-проекта | Подключает `api`, `formular`; точка входа WSGI |
| `backend/formular/` | Объекты, события, формуляры, **TargetEquipment** (through) | Используется `api/`; M2M к `equipment` |
| `backend/equipment/` | Каталог техники и ТТХ (`db_table=formular_*`) | FK из `formular`; admin + seed |
| `backend/api/` | REST API (тонкий слой над моделями) | Вызывается фронтендом по `/api/v1/` |
| `frontend/src/components/Formular/` | Главный orchestrator UI (~475 строк) | axios → backend; props → MapComponent |
| `frontend/src/components/ReferenceData/` | Модальное окно «Справочники» (техника, типы зон, **типы объектов**) | CRUD → `/api/v1/equipment*`, `/api/v1/action-types/`, `/api/v1/target-types/` |
| `frontend/src/components/TargetEquipment/` | Редактор и отображение техники на объекте | EditTargetModal, FormularModal |
| `frontend/src/components/MapComponent/` | Leaflet-карта, маркеры, зоны, события | Тайлы ← tileserver; данные ← Formular |
| `frontend/src/hooks/formular/` | Состояние Formular (targets, events, зоны) | Разгрузка `Formular.jsx` |
| `frontend/src/hooks/referenceData/` | Админ-хуки справочников в UI | `useEquipmentCatalogAdmin`, `useActionTypesAdmin`, `useTargetTypesAdmin` |
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

1. **Справочники** (countries, markers, action-types, target-types) — `useReferenceData` / `fetchReferenceData`, кэш 5 минут, SVG маркеров предзагружаются. После CRUD в UI — `invalidateReferenceDataCache()` + `subscribeReferenceDataInvalidation()` (перезагрузка открытых форм).
2. **Объекты (targets)** — полная загрузка списка в `Formular`, фильтрация на клиенте.
3. **События** — загрузка с серверной фильтрацией (`date_from`, `countries`, …).
4. **Зоны действия** — `Target.actions[]` **и** `deployed_equipment[].zones[]` → Leaflet `Circle`; пересечения в `circleIntersection.js` на клиенте.
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

Модели разделены между **`formular`** (ОР, события, формуляры) и **`equipment`** (каталог техники). Таблицы каталога в БД: префикс `formular_*` (`db_table` в `equipment/models.py`).

### ER-описание (текст)

```
Country 1──* Target
Country 1──* CountryInfo
Country 1──* CountryAttachment
Country 1──* Event
Country *──* TargetType (M2M)
TargetType 0..1──* TargetType (parent/order — дерево типов объектов)

Target *──* Equipment (M2M through TargetEquipment: target, equipment, quantity)
Equipment 1──* EquipmentParameterValue
EquipmentParameterDefinition 1──* EquipmentParameterValue
EquipmentParameterDefinition *──o| ActionType (maps_to_zone)
EquipmentCategory 0..1──* EquipmentCategory (parent)
EquipmentCategory 1──* Equipment

Target 1──* TargetAction
Target 1──* Formular
Target 0..1──* Target (parent/children)

… (события, формуляры, разделы — без изменений, см. ниже)
```

### Каталог техники (`backend/equipment/models.py`)

| Модель | Назначение | Ключевые поля |
|--------|------------|---------------|
| **EquipmentCategory** | Дерево категорий (ВВС, танки, ЗРК) | `title`, `parent`, `order` |
| **UnitOfMeasure** | Единицы ТТХ | `title`, `symbol` |
| **EquipmentParameterDefinition** | Шаблон показателя | `code`, `unit`, M2M `categories`, FK `action_type` |
| **Equipment** | Образец техники | `title`, `designation`, `category`, `origin_country` |
| `EquipmentImage` | Изображение образца | `equipment`, `title`, `image`, `order` |
| **EquipmentParameterValue** | Значение ТТХ | `equipment`, `parameter`, `value` (float) |

**Зоны из каталога:** `Equipment.catalog_zone_values()` — параметры с `action_type` и `value > 0`.

### Размещение на объекте (`formular/models.py`)

| Модель | Назначение | Ключевые поля |
|--------|------------|---------------|
| **TargetEquipment** | Through M2M: техника на площадке | `target`, `equipment`, **`quantity`** (≥1) |
| **Target.equipment** | M2M через `TargetEquipment` | `related_name='targets'` на Equipment |

`quantity` не умножает круги на карте — один набор зон на образец.

### Основные сущности formular (кратко)

| Модель | Назначение |
|--------|------------|
| **Country**, **Marker**, **ActionType** | Справочники |
| **TargetType** | Справочник типов объектов: `title`, M2M `countries`, дерево `parent` + `order` |
| **Target** | Объект разведки: `lat`, `lng`, FK country/marker/type/parent |
| **TargetAction** | Ручная зона: `action_type`, `radius` (км) |
| **Event**, **Formular**, **CountryInfo** | События и текстовый контент |

### Важные замечания по моделям

- Поля `Target.lat` / `Target.lng` в verbose_name подписаны как «Долгота» / «Широта» — **возможна путаница**; фронт использует их как lat/lng Leaflet.
- `Target.country.related_name = 'contries'` — опечатка.
- `action_radius` на Target — **legacy**; зоны: `TargetAction` + техника.
- **`ActionType`:** `color`, `line_type` (solid/dashed/…); поле `animation` удалено.
- **Нет** `TargetEquipmentZone` и переопределения радиуса на площадке — только каталог.

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
| **Ответ (list)** | `TargetListSerializer`: без `parent`, `children_count`, `action_radius`; `type` без `countries`; `deployed_equipment[].equipment` без `category` |
| **Ответ (retrieve)** | `TargetSerializer`: полный объект + `deployed_equipment[]`, `children_count` |
| **Сервисы** | `TargetViewSet`, `TargetListSerializer`, `_target_list_queryset()` |

#### `GET/PUT/PATCH/DELETE /api/v1/targets/{uuid}/`

| | |
|---|---|
| **Назначение** | Детали / обновление / удаление объекта |
| **PUT/PATCH** | При передаче `actions` — атомарная замена всех TargetAction; при `deployed_equipment` — замена TargetEquipment |
| **PUT/PATCH body** | + `deployed_equipment: [{equipment_id, quantity}]` |
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

#### `GET/POST/PUT/PATCH/DELETE /api/v1/action-types/`

| | |
|---|---|
| **Назначение** | CRUD типов зон действия |
| **Тело** | `{title, color, line_type}` (`color` — `#RRGGBB`) |
| **Ответ** | `{id, title, color, line_type}` |
| **UI** | Вкладка «Типы зон действия» в `ReferenceDataModal` |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/equipment-categories/`

| | |
|---|---|
| **Назначение** | CRUD категорий техники (дерево) |
| **Тело (write)** | `{title, parent_id, order}` |
| **Ответ (read)** | `{id, title, parent, order}` |
| **UI** | Подвкладка «Категории» в `EquipmentReferencePanel` |
| **Удаление** | 400 если есть подкатегории или образцы в категории |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/equipment-units/`

| | |
|---|---|
| **Назначение** | CRUD единиц измерения ТТХ |
| **Тело** | `{title, symbol}` (`symbol` уникален) |
| **UI** | Подвкладка «Единицы измерения» в `EquipmentReferencePanel` |
| **Удаление** | 400 если единица используется в параметрах |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/equipment-parameters/`

| | |
|---|---|
| **Назначение** | CRUD шаблонов параметров ТТХ |
| **Query** | `?maps_to_zone=true` — только с `action_type`; `?category=<id>` |
| **Тело (write)** | `{title, code, help_text, unit_id, action_type_id, category_ids: [int]}` |
| **Ответ (read)** | + `categories[]`, `category_ids[]`; nested `unit`, `action_type` |
| **UI** | Подвкладка «Параметры ТТХ» в `EquipmentReferencePanel` |
| **Валидация** | `code` — snake_case; зона → unit «км»/«km» обязателен |
| **Удаление** | 400 если есть значения на образцах |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/equipment/`

| | |
|---|---|
| **Назначение** | CRUD каталога образцов |
| **Тело (write)** | `{title, designation, description, category_id, origin_country_id, parameter_values: [{parameter_id, value}]}` |
| **Ответ** | `parameter_values[]`, category, origin_country, **`images[]`** |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/equipment-images/`

| | |
|---|---|
| **Назначение** | CRUD изображений образца техники |
| **Query (list)** | **Обязателен** `?equipment=<id>` (иначе пустой список) |
| **POST body** | `multipart/form-data`: `equipment`, `image`, опционально `title`, `order` |
| **Ответ** | `{id, equipment, title, image, order, created_at}` |
| **Сервисы** | `EquipmentViewSet`; write — `EquipmentWriteSerializer` + `equipment_utils.replace_equipment_parameter_values` |

#### `GET/POST/PUT/PATCH/DELETE /api/v1/target-types/`

| | |
|---|---|
| **Назначение** | CRUD типов объектов (дерево) |
| **Тело (write)** | `{title, parent_id, order, country_ids}` (`country_ids` — M2M; пустой список = все страны) |
| **Ответ (read)** | `{id, title, parent, order, countries: [int]}` |
| **Вложенный в targets** | `TargetTypeBriefSerializer`: `{id, title, parent}` |
| **UI** | Вкладка «Типы объектов» в `ReferenceDataModal` |
| **Удаление** | 400 если есть дочерние типы или объекты (`Target.type`) |

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

- `/admin/` — **django-unfold** (русская навигация, вкладки inline, autocomplete).
- Отдельный раздел **«Техника»** (`equipment` app); редиректы со старых URL: `equipment/admin_redirects.py`.
- **Target** — вкладки: общее, действия, **вооружение и техника** (`TargetEquipment` + `quantity`), формуляр, подчинённые.
- **Фронтенд:** кнопка «Справочники» в `Formular` → `ReferenceDataModal` (CRUD техники, типов зон и **типов объектов** без админки).
- Ссылка «Открыть сайт» → `FRONTEND_URL` (карта, по умолчанию `http://localhost:5173`).

---

## 7. Бизнес-логика

### Объекты разведки (Target)

- Иерархия через `parent` → `children`; API отдаёт `children_count`.
- При создании/обновлении `actions` — связка тип действия + радиус (км); старые actions удаляются и пересоздаются.
- Фильтр `?parent=` для получения прямых потомков.
- Тип объекта (`TargetType`) — **дерево** (`parent`, `order`); CRUD в UI и API. Может быть ограничен странами через M2M; пустой список = все страны.
- Таблица объектов группирует: страна → дерево типов (`ObjectsTable` + `targetTypeTree.js`). Фильтр по типу каскадный: выбор родителя включает потомков (`FilterPanel`).

### Зоны действия

- **Два источника кругов** (центр = `Target.lat/lng`, радиус в км):
  1. `TargetAction` — ручные зоны объекта.
  2. `deployed_equipment[].zones[]` — из каталога ТТХ (`EquipmentParameterValue` + `parameter.action_type`).
- На карте объединяются в `buildVisibleZones.js` (`getObjectZoneActions`).
- Фильтр по стране + `action_type.title` (`actionZoneFilters`).
- `quantity` на зоны **не влияет** (один набор кругов на образец).
- Пересечения — на клиенте (`circleIntersection.js`), O(n²).
- Legacy: `Target.action_radius` — не основной источник.

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
- Справочники кэшируются 5 минут; сброс через `invalidateReferenceDataCache()`; подписка `subscribeReferenceDataInvalidation()` в `useTargetFormData`, `EditTargetModal`, `useReferenceData`.
- Параллельные запросы справочников защищены счётчиком seq в `useFormularReferenceLists`, `useActionTypesAdmin`, `useEquipmentCatalogAdmin`.
- Отмена запросов через `AbortController`.

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
| `FRONTEND_URL` | URL фронта для ссылки «Открыть сайт» в admin | `http://localhost:5173` |

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
| `backend/infolake/settings.py` | Django: apps, DB, CORS, MEDIA, UNFOLD, WhiteNoise |
| `backend/infolake/unfold_settings.py` | Тема админки, sidebar, оффлайн (без CDN) |
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
- `STATIC_ROOT = backend/staticfiles`, `collectstatic` в `docker-entrypoint.sh`.
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
| seed_equipment_demo | `equipment/management/commands/` | Каталог техники + 6 демо-площадок (`seed:equipment:*`) |
| Django Admin | formular + equipment | Unfold UI, каталог и размещение техники |

---

## 10. Потенциально критичные места

### Сложный код

| Место | Риск |
|-------|------|
| `frontend/src/components/MapComponent/` | Кластеризация флагов/non-flag, зоны, события, measure mode, fullscreen-sidebar |
| `frontend/src/components/Formular/Formular.jsx` | Orchestrator: состояние разнесено в `hooks/formular/`, но связность с MapComponent высокая |
| `backend/api/views.py` EventViewSet filters | Сложная Q-логика дат/времени, дублирование веток |
| `backend/formular/admin.py` MarkerAdmin | Синхронная обработка SVG на каждой строке списка |

### Узкие места производительности

| Место | Проблема |
|-------|----------|
| `GET /api/v1/targets/` без пагинации | Полная загрузка всех объектов |
| Клиентские пересечения зон | O(n²) при большом числе видимых actions |
| `Formular.jsx` + `MapComponent` | Много состояния; полный ре-рендер при изменениях на карте |
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
| Каталог техники / ТТХ | `equipment/models.py` → migration → `api/` + `equipment_utils.py` → `ReferenceData` / admin |
| CRUD справочников в UI | `ReferenceDataModal`, `EquipmentReferencePanel`, `hooks/referenceData/*`, invalidate кэша |
| Логика зон техники | `buildVisibleZones.js`, `target_utils.serialize_deployed_equipment` |
| Справочник (read-кэш) | `useReferenceData.js`, `subscribeReferenceDataInvalidation` |
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
| `frontend/src/components/Formular/Formular.jsx` | Главный orchestrator UI (~475 строк, хуки в `hooks/formular/`) | Критическая |
| `frontend/src/components/ReferenceData/ReferenceDataModal.jsx` | Модальное окно «Справочники» | Высокая |
| `frontend/src/components/ReferenceData/EquipmentReferencePanel.jsx` | Подвкладки каталога: образцы, категории, параметры, единицы | Высокая |
| `frontend/src/components/ReferenceData/EquipmentCatalogPanel.jsx` | CRUD образцов техники в UI | Высокая |
| `frontend/src/components/ReferenceData/EquipmentCategoriesPanel.jsx` | CRUD категорий техники в UI | Высокая |
| `frontend/src/components/ReferenceData/EquipmentParametersPanel.jsx` | CRUD шаблонов ТТХ в UI | Высокая |
| `frontend/src/components/ReferenceData/EquipmentUnitsPanel.jsx` | CRUD единиц измерения в UI | Высокая |
| `frontend/src/components/ReferenceData/ActionTypesPanel.jsx` | CRUD типов зон действия в UI | Высокая |
| `frontend/src/components/ReferenceData/TargetTypesPanel.jsx` | CRUD типов объектов (дерево) в UI | Высокая |
| `frontend/src/components/TargetEquipment/TargetEquipmentEditor.jsx` | Редактор техники на объекте | Высокая |
| `frontend/src/components/TargetEquipment/DeployedEquipmentDisplay.jsx` | ТТХ и зоны в FormularModal | Высокая |
| `frontend/src/components/TargetEquipment/EquipmentAutocomplete.jsx` | Поиск образца при добавлении | Средняя |
| `backend/api/equipment_utils.py` | Замена `parameter_values` при write equipment | Высокая |
| `backend/api/target_utils.py` | `serialize_deployed_equipment`, bulk actions/equipment | Высокая |
| `frontend/src/hooks/referenceData/useEquipmentCatalogAdmin.js` | API-логика образцов в UI | Высокая |
| `frontend/src/hooks/referenceData/useEquipmentCategoriesAdmin.js` | API-логика категорий в UI | Высокая |
| `frontend/src/hooks/referenceData/useEquipmentParametersAdmin.js` | API-логика параметров ТТХ в UI | Высокая |
| `frontend/src/hooks/referenceData/useEquipmentUnitsAdmin.js` | API-логика единиц измерения в UI | Средняя |
| `frontend/src/hooks/referenceData/useActionTypesAdmin.js` | API-логика типов зон в UI | Высокая |
| `frontend/src/hooks/referenceData/useTargetTypesAdmin.js` | API-логика типов объектов в UI | Высокая |
| `frontend/src/hooks/useDeployedEquipmentArray.js` | Массив `deployed_equipment` в формах | Средняя |
| `frontend/src/utils/equipmentCatalogUtils.js` | Поиск и подписи образцов | Средняя |
| `backend/api/serializers.py` | Сериализация / десериализация | Критическая |
| `backend/formular/models.py` | ОР, события, формуляры, TargetEquipment | Критическая |
| `backend/equipment/models.py` | Каталог техники и ТТХ | Критическая |
| `backend/equipment/admin.py` | Админка каталога | Высокая |
| `backend/equipment/catalog/data.py` | 49 образцов: ВВС, СВ, ПВО, ВМФ (СНГ, NATO, EU, США) | Высокая |
| `backend/equipment/catalog/data_images.py` | Источники фото (Wikimedia Commons) | Высокая |
| `backend/equipment/catalog/loader.py` | Загрузка, экспорт, импорт, очистка | Высокая |
| `backend/equipment/catalog/fixtures/` | catalog.json + manifest.json (данные без фото) | Высокая |
| `backend/equipment/catalog/EQUIPMENT_CATALOG_OFFLINE.md` | Оффлайн: загрузка, фикстуры, экспорт, удаление | Высокая |
| `backend/equipment/management/commands/seed_equipment_demo.py` | Демо-данные техники | Средняя |
| `backend/infolake/unfold_settings.py` | Настройки django-unfold | Высокая |
| `backend/infolake/admin_base.py` | Базовый ModelAdmin / TabularInline | Средняя |
| `weaponlist_plan.md` | План ветки develop-weaponlist | Высокая |
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
| `frontend/src/components/Formular/Formular.jsx` | Главный orchestrator UI (~475 строк) | Критическая |
| `frontend/src/components/MapComponent/MapComponent.jsx` | Leaflet-карта | Критическая |
| `frontend/src/components/MapComponent/markerClusteringUtils.js` | Кластеризация маркеров | Высокая |
| `frontend/src/components/MapComponent/MapUtils.jsx` | Рендер флаговых маркеров | Высокая |
| `frontend/src/components/MapComponent/NonFlagMarkerUtils.jsx` | Рендер обычных маркеров | Высокая |
| `frontend/src/hooks/useReferenceData.js` | Кэш справочников | Высокая |
| `frontend/src/hooks/useTargetFormData.js` | Данные для форм target | Высокая |
| `frontend/src/config/api.js` | Базовый URL API | Критическая |
| `frontend/src/config/tiles.js` | URL тайлов TileServer | Критическая |
| `frontend/src/utils/buildVisibleZones.js` | Сбор зон: `actions[]` + `deployed_equipment[].zones[]` | Высокая |
| `frontend/src/utils/circleIntersection.js` | Геометрия пересечений зон | Высокая |
| `frontend/src/utils/markerFilters.js` | Фильтрация маркеров | Средняя |
| `frontend/src/utils/targetTypeTree.js` | Дерево типов объектов: build/flatten, группировка таблицы, каскадный фильтр | Высокая |
| `frontend/src/components/ObjectsTable/ObjectsTable.jsx` | Таблица объектов: группировка страна → дерево типов | Высокая |
| `frontend/src/components/FilterPanel/FilterPanel.jsx` | Фильтры объектов, каскадный фильтр по типу | Высокая |
| `backend/formular/migrations/0041_targettype_parent_order.py` | Миграция: `TargetType.parent`, `order` | Высокая |
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

## 13. Направление develop-weaponlist (продолжение работ)

**Статус ветки:** MVP backend + карта + админка + **фаза 2 (UI + API write)** — **готово**. Детали: [`weaponlist_plan.md`](weaponlist_plan.md).

### Сделано (backend + карта)

| Область | Результат |
|---------|-----------|
| Каталог | App `equipment`, 12 демо-образцов (авиация, танки, БМП, артиллерия, ЗРК) |
| ТТХ | Float-параметры, привязка к `ActionType` для зон (км) |
| Размещение | `TargetEquipment` (through) + **`quantity`** |
| API | `deployed_equipment[]` в targets; CRUD `/equipment/`; CRUD `/action-types/` |
| Карта | `buildVisibleZones.js` — зоны из каталога + ручные actions |
| Админка | django-unfold, вкладка «Вооружение и техника», autocomplete |
| Seed | `python manage.py seed_equipment_demo` |
| Каталог (полный) | `load_equipment_catalog` (без фото по умолчанию), `build_equipment_catalog_fixture`, `import/export/clear_equipment_catalog` — см. `equipment/catalog/EQUIPMENT_CATALOG_OFFLINE.md` |

### Сделано (фаза 2 — UI)

| Область | Результат |
|---------|-----------|
| API write | `deployed_equipment: [{equipment_id, quantity}]` в POST/PUT/PATCH |
| Detail specs | `specs[]` в `deployed_equipment` только в `TargetSerializer` (retrieve) |
| EditTargetModal | Вкладка «Вооружение и техника», `TargetEquipmentEditor`, autocomplete |
| FormularModal | `DeployedEquipmentDisplay` — quantity, ТТХ, зоны |
| Справочники UI | `ReferenceDataModal` + `EquipmentReferencePanel`: CRUD образцов, категорий, параметров ТТХ, единиц; типы зон; **типы объектов (дерево)** |
| Formular | Рефакторинг (~475 строк), хуки в `hooks/formular/` |
| Стабильность | Инвалидация кэша справочников, защита от гонок запросов |
| Схема каталога | `EquipmentReferencePanel`: CRUD категорий, параметров ТТХ, единиц измерения; write API |
| Fullscreen | Пункт «Зоны действия» убран из меню «Инструменты» (доступ через вкладку сайдбара) |

| Дерево типов объектов | `TargetType.parent/order`, CRUD API + `TargetTypesPanel`; `ObjectsTable` / `FilterPanel` / Add-Edit modals через `targetTypeTree.js` |

### Ручной тест-план: дерево типов объектов

1. «Справочники → Типы объектов»: создать «СВ» → дочерний «Танки».
2. Назначить объектам разные типы; в таблице: страна → СВ → Танки → объекты.
3. Фильтр: выбрать «СВ» — видны объекты и «Танки», и прямо «СВ».
4. «Свернуть/развернуть все» — корректно для вложенных типов.
5. Удаление типа с объектами или с дочерними — ошибка в UI.

### Возможные следующие шаги

1. Пагинация или серверный поиск `/equipment/` при росте каталога.
2. CRUD маркеров, типов событий, разделов формуляра и стран в UI «Справочники».
3. Автотесты API для `deployed_equipment` и справочников техники.

### Команды для старта сессии

```bash
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_equipment_demo
```

Демо-объекты на карте: фильтр зон для **России**, метки `seed:equipment:*`.

### Ключевые контракты для фронта

```json
"deployed_equipment": [
  {
    "equipment": { "id", "designation", "title", "category", "images": [{ "id", "title", "image", "order" }] },
    "quantity": 12,
    "specs": [{ "title", "value", "unit" }],
    "zones": [
      { "parameter_title", "action_type": { "title", "color", "line_type" }, "radius_km" }
    ]
  }
]
```

---

*Документ обновлён под ветку `develop-weaponlist`. Дата: 2026-06-29.*
