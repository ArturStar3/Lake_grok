# project_context.md

**Проект:** infolake / lake_grok  
**Тип:** Веб-приложение электронной разведывательной сводки (карта + формуляры объектов + события).  
**Стек:** Django 6.0 + DRF + PostgreSQL (backend) | Vite + React 18 + Leaflet + axios (frontend)  
**Дата последнего обновления:** 2026-06-18 (полная очистка избыточной истории)

---

## Инструкция для агентов (ОБЯЗАТЕЛЬНО)

**Правило работы с этим файлом (высший приоритет):**
- **Используй ТОЛЬКО этот файл** как источник правды о проекте.
- Если информации недостаточно — **сначала обнови этот файл**, а не читай исходники заново.
- Обновляй контекст **перед** любыми чтениями/правками кода (list_dir, read_file, grep по src).
- После обновления работай исключительно на его основе.

---

## 0. Текущее состояние проекта (кратко)

**Основные возможности:**
- Карта (Leaflet + TileServer GL) с кластеризацией флагов и non-flag маркеров.
- Объекты (Target): страна + вид/род войск + маркер + действия (несколько радиусов) + формуляр.
- Иерархия объектов (parent/children).
- Группировка в таблице: по странам + по TargetType (ранее MilitaryBranch, функционал консолидирован).
- Зоны действия (Action Zones): статичные, с фильтрами по странам и action_type, радар-спицы, пересечения, hover/click.
- Масштабная линейка (только fullscreen).
- Полноценный редактор формуляров + attachments.
- Оффлайн Docker workflow (docker save/load).

**Ключевые файлы-оркестраторы:**
- `frontend/src/components/Formular/Formular.jsx` — центральное состояние, загрузка данных, фильтры, модалы.
- `backend/api/views.py` + `serializers.py` — кастомная логика Target + Formular bulk.

**Важные особенности (не ломать):**
- Frontend ожидает **массивы** от большинства `/api/v1/*` (пагинация отключена на уровне ViewSet или отсутствует).
- `/api/v1/formular/<target_id>/` возвращает `{formular: [...], subordinates: [...]}`.
- `Target.country` related_name='contries' (опечатка в коде).
- Все `permission_classes = [AllowAny]`.

---

## 1. Архитектура

### Backend
- `backend/infolake/` — Django + DRF (CORS_ALLOW_ALL_ORIGINS, DEBUG, PostgreSQL).
- `backend/formular/` — модели + очень кастомная админка (inlines, prefetch, SVG-превью).
- `backend/api/` — DRF (ViewSet + кастомные APIView для formular и country).

### Frontend
- Чистый SPA.
- Состояние почти полностью в `Formular.jsx` (useState + useMemo/useEffect).
- Карта: `MapComponent.jsx` + утилиты кластеризации.
- Модалы редактирования используют локальные `loadData` + хуки (useTargetFormData и т.д.).

### Docker
- `docker-compose.yml`: tileserver (8080), backend (8000), frontend (5173).
- PostgreSQL на хосте (`host.docker.internal`).
- Для Windows: polling + `VITE_HMR_HOST: host.docker.internal`.
- Оффлайн: `image:` + `pull_policy: never` в compose, `docker save/load`.

---

## 2. Модели данных (`formular/models.py`)

**Справочники:**
- `Country` (title, title_short, iso_code, color)
- `CountrySections` / `FormularSections` (иерархические, parent self-FK)
- `Marker` (SVG, top/width/height/scale/order, is_flag)
- `EventMarker`
- `ActionType` (title, animation — legacy)
- `TargetType`, `EventType`
- `TargetType` (title, M2M countries — применимо к странам; поглотил функционал бывшего MilitaryBranch)

**Основные:**
- `Target`
  - `country` (FK → Country, related_name='contries')
  - `branch` (FK → TargetType, null/blank; используется для группировки "вид/род войск")
  - `parent` (self FK, related_name='children')
  - `title`, `label`, `marker`, `type`
  - `lat`, `lng`, `action_radius` (legacy)
  - Связи: `actions` (TargetAction), `children`
- `TargetAction` (target, action_type, radius)
- `Event` (shape JSONField, country, event_type, marker)
- `Formular` (target + section + content) — уникальность (target, section)
- `CountryInfo`, `FormularAttachment`, `CountryAttachment`

**Примечания:**
- Много реальных данных в `backend/media/`.
- seed: `python manage.py seed_test_targets --count N`

---

## 3. Бизнес-логика и ключевые алгоритмы

### Формуляр объекта
- Загрузка: GET `/api/v1/formular/<target_id>/` → `{formular: [items], subordinates: [...]}`.
- Сохранение: POST `/bulk/` массивом `{section_id, content}` (update_or_create).
- Attachments отдельно (query ?target=).

### Кластеризация маркеров (MapComponent + markerClusteringUtils + NonFlagMarkerUtils)
- **Флаги** (`is_flag=true`): группировка по стране → близкие (< ~38px) собираются → вертикальный оффсет (overlap 80%).
- **Non-flag**: географическая кластеризация та же, но визуальное схлопывание **только если выбраны все** в кластере. Иначе — показываются по отдельности. При полном выборе — один счётчик + круг при hover.
- Кэширование по ключам (zoom + selected + paths).

### Зоны действия (Action Zones) — текущее состояние
**Управление:**
- В обычном режиме — панель в левом sidebar (после FilterPanel).
- В fullscreen — в Features (map_sidebar) через радиокнопки: "Зоны пересечения" / "Настройка отображения".

**Фильтры:**
- По странам + action_type.title (чекбоксы, indeterminate, "Всё"/"Ничего").
- `actionZoneFilters`, `showZoneIntersections`, `actionZoneViewMode`.

**Визуалы (MapComponent):**
- Статичные круги (без анимаций).
- Цвет + dashArray + (для "Радар") 10 статических радиальных линий — всё строго по `action_type.title`.
- Низкая opacity.
- Hover: подсвечивает все покрытые маркеры.
- Click: ensure selected (+ контекстное меню при пересечении зон).

**Пересечения:** считаются в Formular (circleIntersection.js), фильтруются по видимым зонам.

**Файлы:** Formular.jsx (state), Features/* (ActionZoneFilters + Features), MapComponent.jsx.

### Другие
- Измерения (Ctrl+click).
- Рисование событий (shape как JSON).
- Подчинённые: показываются в FormularModal, ленивая загрузка.

---

## 4. API (DRF)

**Базовый путь:** `/api/v1/`

**ViewSets (прямые списки — массивы):**
- targets, countries, markers, event-markers, action-types, target-types, event-types, events, country-sections, formular-sections, attachments и т.д.

**Специальные эндпоинты:**
- `GET /formular/<target_id>/` → `{ "formular": [...], "subordinates": [...] }`
- `POST /formular/<target_id>/bulk/` → массив `{section_id, content}`
- `GET /country/<iso_code>/`

**Важно для фронтенда:**
- Большинство ответов — чистый массив `[]` (нет пагинации в рантайме).
- Target create/update пересоздаёт actions.
- Все права — AllowAny.

---

## 5. Ключевые компоненты и поток данных

- **Formular.jsx** — загрузка всех данных, фильтры, selected/hovered, передача в Map и таблицы, открытие модалов.
- **EditTargetModal / FormularEditor** — свои `loadData` (Promise.all справочников + отдельный fetch формуляра).
- **MapComponent** — рендер + все инструменты (зоны, кластеры, события, измерения).
- **ObjectsTable** — группировка по country + branch (TargetType).
- Хуки: useTargetFormData, useActionsArray, useDropdownWithSearch.

**Загрузка в модале редактирования (EditTargetModal):**
Promise.all: target + countries + markers + action-types + target-types + formular-sections + targets (для parent). military-branches эндпоинт удалён (используй target-types).

---

## 6. Docker и оффлайн

См. `docker-compose.yml` и `docker_instruction.md`.

**Ключевые моменты:**
- `image:` + `pull_policy: never` на целевой машине.
- Экспорт: `docker save -o images.tar ...`
- HMR на Windows: `VITE_HMR_HOST: host.docker.internal` + polling.

---

## 7. Известные особенности и gotchas

- `related_name='contries'` на Target.country — не менять без миграции.
- Frontend ожидает массивы от API (после реверта оптимизаций).
- Non-flag маркеры ведут себя иначе при кластеризации (только при полном selected).
- Зоны всегда статичные.
- В админке тяжёлый prefetch и кастомный рендер SVG.
- Нет тестов. Нет аутентификации.

---

## 8. Текущие основные возможности (as-built)

- **Иерархия объектов** — parent + отображение прямых подчинённых + счётчики в админке.
- **Группировка по TargetType** (поле branch) в таблице объектов (после стран).
- **Зоны действия** — полный набор фильтров + визуалы по типу + интерактивность (см. раздел 3).
- **Масштабная линейка** — только fullscreen, военный стиль, dropdown выбора, точный Web Mercator расчёт.
- **Редактирование с формуляром** — работает (в т.ч. после фикса `formularRes.data.formular`).

---

**Дата очистки:** 2026-06-18. Удалена вся промежуточная история сессий, дубли алгоритмов, verbose планы и as-built отдельных тикетов. Оставлено только то, что необходимо для понимания текущего состояния и безопасной работы с кодом.

---

## 9. Рефакторинг MilitaryBranch → TargetType (2026-06-21)

**Решение:** модели TargetType и MilitaryBranch выполняли одну функцию. Консолидировано в TargetType.

**Изменения:**
- В `TargetType` добавлено поле `countries` (M2M на Country, с related_name='applicable_target_types').
- Поле `Target.branch` теперь FK на `TargetType` (вместо MilitaryBranch).
- Удалена модель `MilitaryBranch`, ViewSet, Serializer, эндпоинт `/api/v1/military-branches/`, админ-регистрация.
- `TargetTypeSerializer` теперь возвращает `countries` (как раньше MilitaryBranchSerializer).
- Frontend: загрузка militaryBranches теперь из `/target-types`. Логика фильтра по странам и dropdown'ы branch работают без изменений (данные идентичны по форме).
- Группировка в ObjectsTable продолжает использовать `item.branch`, но источник — TargetType.
- Создана миграция `0030_targettype_countries_remove_militarybranch.py`.

**Влияние на данные:**
- Применить миграцию: `python manage.py migrate`
- Старые значения `branch` будут потеряны (нужно будет переназначить в админке или повторно импортировать).
- В seed_test_targets branch не использовался.

**API / Frontend:**
- Используй `/api/v1/target-types/` для справочника "вид/род войск".
- В модалях Add/EditTargetModal и хуке useTargetFormData — военные ветки теперь приходят как targetTypes.

---

*При необходимости добавляй новые разделы в конец, сохраняя структуру. Не накапливай историю.*