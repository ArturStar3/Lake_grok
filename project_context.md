# project_context.md

**Проект:** infolake / lake_grok  
**Тип:** Веб-приложение электронной разведывательной сводки (карта + формуляры объектов + события).  
**Стек:** Django 6.0 + DRF + PostgreSQL (backend) | Vite + React 18 + Leaflet + axios (frontend)  
**Текущая ветка:** frontend_update (см. git_status; header может быть устаревшим — проверяй при работе)  
**Дата анализа:** 2026  
**Дата последнего обновления контекста:** 2026 (полный анализ + оптимизация на избыточность: см. раздел 0 и финальную заметку)

---

## Инструкция для агентов (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ)

**Правило работы с этим файлом (высший приоритет):**

- **Теперь используй ТОЛЬКО `project_context.md`** для всей дальнейшей работы по проекту.
- Если информации недостаточно — **сначала обнови этот файл** (добавь недостающие разделы, детали, связи, эндпоинты, модели, бизнес-логику и т.д.), **а не читай весь проект** заново.
- Запрещено использовать инструменты для чтения/поиска исходного кода (list_dir, read_file, grep и т.п. по файлам проекта), пока не будет обновлён данный контекст.
- После обновления контекста продолжай работу исключительно на его основе.

---

## 0. Контекст предыдущей сессии (кратко, для преемственности)

Последняя крупная реализованная функциональность: адаптивная топографическая линейка масштаба **только в fullscreen** (военный формат «1 : 50 000», 4-сегментная двухцветная линейка #1f2a38/#f4f6f7, реальные Web Mercator расчёты + снаппинг, клик по числу → дропдаун вверх → `flyTo` с сохранением центра; список масштабов начинается с 1:10 000, добавлены 1:2 500 000 и 1:3 000 000).

Вся работа велась строго по правилам (обновление этого файла **до** любых чтений исходного кода, todo tracking, документирование в 9 / 9.1.x).

Предыдущая сессия также выполнила тяжёлую оптимизацию этого же файла (удаление дублирующихся пред-реализационных спецификаций).

**Протоколы** (Plan Mode + обязательное обновление контекста перед работой с кодом) — см. раздел «Инструкция для агентов» выше и финальную заметку в конце файла.

---

## 1. Архитектура проекта

### Основные модули / приложения

**Backend (Django project: `infolake`)**

Весь backend-код находится в директории `backend/` (корень репозитория).

- `backend/infolake/` — Django project root
  - `settings.py` — DRF, `CORS_ALLOW_ALL_ORIGINS=True`, PostgreSQL (django-environ), `MEDIA_ROOT`/`MEDIA_URL`, русский язык (`ru-ru`), `DEBUG=True`, `ALLOWED_HOSTS=['*']`.
  - `urls.py` — `/admin/`, `/api/v1/` → `api.urls`.
  - `enums.py` — `BaseEnum` (для choices).
- `backend/formular/` — **основное приложение данных и админки**
  - Модели, admin (очень кастомный), inlines, forms/widgets (ColorRadioSelect), enums, validators (SVG).
- `backend/api/` — **DRF слой**
  - ViewSets + custom APIView, serializers (вложенные + write/create логика).
- `backend/manage.py`, `backend/requirements.txt`, `backend/markers/` (пример SVG).
- `backend/media/` — полностью игнорируется в .gitignore (загруженные файлы, маркеры, вложения).
- `backend/env/` — виртуальное окружение Python (не должно попадать в git).

**Frontend (Vite + React)**

- `src/` — основная логика UI.
  - `config/api.js` — единая `API_URL` (`import.meta.env.VITE_API_URL` или дефолт `http://172.16.80.207:8000`).
  - `components/Formular/Formular.jsx` — **главный оркестратор** (табы Objects/Events, фильтры, таблица, модалы, загрузка данных, состояние selected/hovered/measure/action-radius).
  - `components/MapComponent/` — карта Leaflet + кластеризация + события + инструменты (измерения, зоны действия, рисование событий).
  - Модалы: Add/Edit Target, Formular (view + editor bulk), Events (Add/Edit), Country info.
  - Таблицы: ObjectsTable, EventsTable, IntersectionTable.
  - Утилиты: clustering (markerClusteringUtils), circle intersections, SVG processing, marker filters.
- `public/` — статика (sprite.svg, leaflet icons, geo/custom.geo.json для границ стран).
- `index.html` (корень frontend).
- `src/config/tiles.js` — `TILE_RASTER_URL`, `VITE_TILESERVER_URL` (TileServer GL).

**Docker (корень репозитория)**

Корневой `docker-compose.yml` — **3 сервиса** (+ PostgreSQL **на хосте**, не в compose):

| Сервис | Порт | Образ / build | Назначение |
|--------|------|---------------|------------|
| `tileserver` | 8080 | `maptiler/tileserver-gl:latest` | Оффлайн тайлы OpenMapTiles |
| `backend` | 8000 | `backend/Dockerfile` | Django `runserver`, autoreload |
| `frontend` | 5173 | `frontend/Dockerfile` | Vite dev (`npm run dev`) |

- Backend: volume `./backend:/app`, `DB_HOST=host.docker.internal`, `env_file: backend/.env`, entrypoint `migrate` + `runserver --nothreading`, зависимость `watchdog`.
- Frontend: volume `./frontend:/app` + anonymous `/app/node_modules`; `VITE_API_URL`, `VITE_TILESERVER_URL`; **polling** для HMR на Windows (`vite.config.js` + `CHOKIDAR_USEPOLLING`).
- Запуск: `docker compose up -d --build` из корня проекта.
- Экспорт образов: `docker save -o images.tar lake_grok-backend lake_grok-frontend maptiler/tileserver-gl:latest`.

**Связи между слоями**

- Admin (`/admin/`) — основной ввод/редактирование справочников, объектов, формуляров (inlines), маркеров (рендер SVG превью).
- DRF API (`/api/v1/`) — читает/пишет для фронта (все `permission_classes = [AllowAny]`).
- Frontend не использует Django templates/views (кроме статики/media). Полностью SPA + API. Formular.jsx — центральное состояние + fetch.
- Данные: Targets + вложенные actions → карта + таблица. Events (с JSON shape) → оверлеи на карте. Formular/CountryInfo + attachments → модальные редакторы/просмотр.
- Кластеризация и расчёты (пересечения зон, измерения) — клиент-side.
- GeoJSON стран — статический файл во фронте (клик по стране → CountryModal).

Нет отдельного `services/` или `managers/`. Бизнес-логика распределена:
- Backend: admin (prefetch, custom display, inlines), DRF (custom create/update для actions, bulk formular, фильтры событий).
- Frontend: Formular (fetch + state + handlers), Map + clustering utils, circleIntersection, модалы (CRUD + bulk + attachments).

---

## 2. Модели данных (`formular/models.py`)

Все модели в `formular`. UUID PK на ключевых сущностях (Target, Event, Attachments).

### Справочники / иерархии

- **Country**
  - `title` (unique), `title_short`, `iso_code`, `color` (Choices из Colors: blue/green/red/yellow/marine)
  - Индексы: title, title_short.

- **CountrySections** (иерархические разделы инфо по стране)
  - `title`, `order`, `parent` (self FK, related='children'), `is_hidden`
  - clean: не может быть родителем себя.

- **FormularSections** (иерархические разделы формуляра объекта)
  - Аналогично CountrySections + `is_hidden` (для формуляра).

- **ActionType**
  - `title`, `animation` (ActionAnimations: GRADIENT/RADAR/WAVE/PULSE/RINGS/SECTOR/ALERT/DASHED_ROTATE).

- **TargetType** — `title` (тип объекта разведки).

- **EventType** — `title`.

- **Marker** (флаги/маркеры объектов)
  - `title`, `path` (FileField → media/markers, validate_svg), `top/width/height` (%), `scale` (0.1-1), `order`, `is_flag` (bool, default True).
  - ordering: order, title.

- **EventMarker** — `title`, `path` (validate_svg, media/event_markers).

### Основные сущности

- **Target** (объект разведки, UUID PK)
  - `country` (FK Country, related='contries' — опечатка в коде), `title`, `label`, `marker` (FK Marker, SET_NULL), `type` (FK TargetType, SET_NULL)
  - `action_radius` (float, >=0), `lat`, `lng`
  - Индексы: title, label.
  - Связи: `actions` (reverse TargetAction).

- **TargetAction**
  - `target` (FK Target, related='actions', CASCADE), `action_type` (FK ActionType, SET_NULL), `radius` (>=0).

- **Event** (UUID PK)
  - `title`, `object_name`, `description`, `event_type` (FK EventType, SET_NULL), `country` (FK, SET_NULL, related='events')
  - `marker` (FK EventMarker, SET_NULL, related='events')
  - `date_start/end`, `time_start/end`, `color` (#hex), `shape` (JSONField: point/circle/area с geometry)
  - `created_at`, `updated_at`
  - Индексы: date_*, country.

- **Formular** (пункты формуляра объекта, UUID PK)
  - `target` (FK Target, CASCADE), `section` (FK FormularSections), `content` (Text)
  - Уникальность по (target, section) через update_or_create в API.

- **CountryInfo**
  - `country` (FK, related='country_infos'), `section` (FK CountrySections), `content` (Text, null/blank).

- **Attachments** (UUID PK)
  - **CountryAttachment**: `country`, `section` (CountrySections), `title`, `description`, `image` (ImageField, media/country_attachments), `created_at`
  - **FormularAttachment**: `target`, `section` (FormularSections), `title`, `description`, `image` (media/formular_attachments), `created_at`

**Отношения (ключевые)**

- Country 1--* Target, 1--* CountryInfo, 1--* CountryAttachment, 1--* Event
- Target 1--* TargetAction, 1--* Formular, 1--* FormularAttachment
- CountrySections 1--* CountryInfo / CountryAttachment (и self parent/children)
- FormularSections 1--* Formular / FormularAttachment (self parent)
- Target -- Marker (многие объекты могут ссылаться на один маркер)
- Event -- EventMarker / EventType / Country

---

## 3. Бизнес-логика

**Где находится:**

- **Backend (formular/):**
  - `admin.py` + `admin_inlines.py` — кастомная админка (raw_id, list_editable, prefetch/select_related, SVG превью с уникализацией id/gradients в MarkerAdmin, color_display, inlines для Target/Country).
  - `management/commands/seed_test_targets.py` — заполнение тестовых `Target` из `Data.xlsx` (таблицы `formular_country`, `formular_marker`); label `seed:test:*`; опции `--count`, `--clear`, `--seed`.
  - `validators.py` — только validate_svg (расширение + mime).
  - `forms.py` + `widgets.py` — CountryForm + ColorRadioSelect (безопасный HTML label).
  - `enums.py` — Colors (BaseEnum) + ActionAnimations (TextChoices).

- **Backend (api/):**
  - `views.py` — ViewSets (ReadOnly для справочников, full CRUD для Target/CountryInfo/CountryAttachment/FormularAttachment/Event + custom логика).
  - Специальные: Target create/update с вложенными actions (удаление старых + создание), FormularBulkUpdateView (update_or_create), Event фильтрация по датам/времени/странам/типам/title (сложный Q), CountryInfoView (по iso_code), FormularView (по target_id).
  - `serializers.py` — вложенные read (Country+Marker+Actions), отдельные write (TargetCreateSerializer с actions, EventWrite, FormularBulkUpdateSerializer, CountryInfoWrite).

- **Frontend:**
  - `Formular.jsx` — главный контейнер: fetch всех списков + events с фильтрами, мемоизация filteredObjects, обработчики CRUD (add/edit/delete target/event, bulk formular), состояние инструментов (measure, action radius, intersections, fullscreen, tabs).
  - `MapComponent.jsx` + `MapUtils.jsx` + `markerClusteringUtils.js` + `NonFlagMarkerUtils.jsx` — рендер карты, кластеризация (по country + order → вертикальные оффсеты в кластерах близких флагов), non-flag группировка в круги при hover, рисование событий (point/circle/polygon), GeoJSON стран, measure (Ctrl+click), action radius (анимации + intersections), event shapes (хранятся как JSON).
  - Модалы + Editor: AddTargetModal/EditTargetModal (с хуками useTargetFormData/useActionsArray/useDropdownWithSearch), FormularEditor (bulk по sections + attachments upload/delete), FormularModal (просмотр), CountryModal/EditCountryModal (info + attachments), AddEventModal.
  - `utils/`: circleIntersection.js (геометрия пересечений зон действия), svgUtils.js (enrichSvg с уникализацией id/gradients + цветовой класс, getViewBoxSize, addColorClassToSvg), markerFilters.js (isFlag/isNonFlag + фильтры по selected).
  - `hooks/`: useTargetFormData, useActionsArray, useDropdownWithSearch.
  - `constants/mapConstants.js`: ICON_WIDTH/HEIGHT, MAX_DISTANCE_PX.
  - `circleIntersection.js` используется в Formular для selected объектов при showActionRadius.

**Что делает (ключевые процессы):**

- Добавление/редактирование Target: страна + маркер (флаг) + тип + coords + actions (несколько радиусов) + сразу bulk-формуляр.
- Кластеризация маркеров: только is_flag=true → группировка по стране → сортировка по order → близкие (<~1см/38px на карте) собираются в кластер → вертикальные оффсеты (overlap 80%) с base = самый приоритетный.
- Non-flag маркеры: группируются аналогично, при полном выборе группы — одна иконка + круг при hover/pin. Размер иконки: `computeNonFlagIconSize()` в `NonFlagMarkerUtils.jsx` — `iconWidth = ICON_WIDTH * scale`, `iconHeight = iconWidth * (vb.height/vb.width)` (как у flag в `MapUtils.jsx`); значения идут в `L.DivIcon.iconSize` и `enrichSvg()`.

### 3.1 Детальный алгоритм группировки non-flag маркеров (processNonFlagClustering)

Non-flag маркеры (is_flag=false) используют **отдельный** путь кластеризации, отличный от флагов. Главная особенность — группировка визуально проявляется **только когда все объекты логического кластера выбраны** (selected). В противном случае объекты показываются индивидуально, даже если географически близки.

**Используемые утилиты и компоненты:**
- `markerClusteringUtils.js`: `processNonFlagClustering`, `createClusters` (общая с флагами), `findNearbyObjects`, `getGroupCirclePositions`, `latLngToPixel`, `calcDistancePx`
- `NonFlagMarkerUtils.jsx`: `NonFlagLabelGeneration` (загрузка SVG, триггеры пересчёта, генерация L.DivIcon)
- `markerFilters.js`: `filterNonFlagMarkers`, `isNonFlagMarker`
- `mapConstants.js`: `ICON_WIDTH=50`, `ICON_HEIGHT=50`
- `svgUtils.js`: `enrichSvg`, `getViewBoxSize`
- `computeNonFlagIconSize` (локальная в NonFlagMarkerUtils.jsx)

**Ключевые константы кластеризации (общие):**
- `CLUSTER_DISTANCE_CM = 1`
- `CLUSTER_DISTANCE_PX = 37.8` (1 см ≈ 37.8 px при 96 DPI)
- Пороговое расстояние вычисляется в экранных пикселях через `map.latLngToLayerPoint` (зависит от текущего зума и проекции).

**Поэтапный алгоритм:**

1. **Вход и предварительная фильтрация (NonFlagLabelGeneration + filterNonFlagMarkers)**  
   - Принимает `objects` (все загруженные Target) и `selectedIds`.  
   - Фильтрует **только** объекты, удовлетворяющие: `selectedIds.includes(id) && obj.marker?.is_flag === false`.  
   - Если после фильтрации пусто — возвращает [].  
   - Мемоизированные ключи пересчёта: `pathsKey` (уникальные пути SVG) и `clusterKey` (id+marker.id + zoom + размер карты).  
   - Слушает события `zoom` карты для принудительного пересчёта кластеров при изменении масштаба.

2. **Группировка по стране**  
   - `nonFlagObjects.reduce(...)` → `{ countryTitle: [objects...] }` (точно как у флагов).  
   - Обрабатывается каждая страна независимо.

3. **Географическая кластеризация (createClusters + findNearbyObjects)**  
   - Для объектов одной страны вызывается общая функция `createClusters(countryObjects, mapInstance)`.  
   - Внутри `createClusters`:
     - Идёт проход по объектам (в порядке прихода из reduce, без предварительной сортировки по order, в отличие от флагов).
     - Для каждого ещё не обработанного объекта:
       - Берётся он как `baseObj`.
       - `findNearbyObjects(baseObj, unprocessedCandidates, map)`:
         - Преобразует lat/lng → пиксели (`latLngToPixel` → `map.latLngToLayerPoint`).
         - Для каждого кандидата вычисляет евклидово расстояние в пикселях (`calcDistancePx`).
         - Если расстояние ≤ `CLUSTER_DISTANCE_PX` (≈37.8 px) — кандидат включается в кластер (включая сам base).
       - Все найденные помечаются processed.
       - Кластер сортируется по `marker.order` (на всякий случай).
     - Результат — массив кластеров (каждый кластер = массив объектов, близких на карте).

4. **Логика принятия решения "группировать или нет" (самая важная разница с флагами)**  
   Для каждого кластера из `createClusters`:
   - Если `cluster.length === 1`:
     - Объект остаётся индивидуальным: `{ ...obj, isGrouped: false, groupSize: 1, groupObjects: cluster }`.
   - Иначе:
     - Считается `selectedInGroup = cluster.filter(obj => selectedIds.includes(obj.id))`.
     - **Если выбраны НЕ ВСЕ объекты кластера** (`selectedInGroup.length < cluster.length`):
       - Каждый объект кластера выводится **отдельно** (как будто кластера нет):
         - `isGrouped: false`, `groupSize: 1`, `groupObjects: [obj]`.
       - Это ключевое поведение: близкие non-flag объекты не "склеиваются", пока пользователь не выберет всю группу целиком.
     - **Если выбраны ВСЕ объекты кластера**:
       - Создаётся одна "групповая" иконка:
         - Берётся `mainObj = cluster[0]` (первый в кластере после сортировки в createClusters).
         - В результат пушится:
           ```js
           {
             ...mainObj,
             isGrouped: true,
             groupSize: cluster.length,
             groupObjects: cluster,
             groupId: `group-${country}-${clusterIdx}`,
             isGroupIcon: true
           }
           ```
         - Остальные объекты кластера (slice(1)) пушатся с флагами:
           - `isGrouped: true`, `isHidden: true`, `mainGroupObject: mainObj`, те же groupId/groupObjects/groupSize.
       - Таким образом в `groupedObjects` остаются и "скрытые", чтобы их можно было показать в круге при hover.

5. **Генерация иконок (iconsById memo в NonFlagLabelGeneration)**  
   - `visibleObjects = groupedObjects.filter(o => !o.isHidden)`.
   - Для обычных (`!obj.isGrouped`):
     - `computeNonFlagIconSize(svg, markerScale)`:
       - `iconWidth = ICON_WIDTH * scale` (50 * scale)
       - `iconHeight = iconWidth * (vb.height / vb.width)` — сохраняет пропорции оригинального SVG (через `getViewBoxSize`).
       - Если viewBox некорректен — fallback на квадрат.
     - SVG обогащается `enrichSvg(...)` (уникализация id/градиентов + цветовой класс по стране).
     - Создаётся `L.DivIcon` с `iconSize: [iconWidth, iconHeight]`, `iconAnchor` по центру.
   - Для `isGroupIcon`:
     - Жёстко заданный размер `groupIconSize = 35`.
     - Рисуется специальная SVG-иконка (красный круг + 3 белых точки + белая цифра `groupSize`).
     - Иконка регистрируется по `groupId` (не по id объекта).
   - Дополнительно создаются иконки для всех скрытых объектов группы и для главного объекта группы (нужны для отображения внутри круга при наведении).

6. **Отображение содержимого группы (круг при hover/pin)**  
   - Используется `getGroupCirclePositions(groupObjects, radius = 80)`:
     - Равномерно распределяет N объектов группы по окружности (полярные координаты: `cos`/`sin`).
     - Добавляет каждому `circleX`, `circleY`, `angle`.
   - Эти позиции используются в MapComponent (рендер дополнительных маркеров/иконок внутри круга вокруг позиции групповой иконки).
   - При наведении (или "закреплении") на групповую иконку показываются индивидуальные иконки всех членов группы, расположенные по кругу. Сами они не влияют на кластеризацию карты — это чисто визуальный оверлей.

7. **Триггеры пересчёта и кэширование**
   - Пересчёт кластеров и иконок происходит при:
     - Изменении `selectedIds`
     - Изменении списка объектов
     - Изменении зума карты
     - Изменении размера контейнера карты (учитывается в clusterKey)
   - SVG загружаются отдельно (axios) и кэшируются по пути; иконки пересоздаются только когда меняются релевантные ключи.
   - Кластеризация выполняется только если `mapInstance._size` существует.

**Отличия от кластеризации флагов (processMarkerClustering):**
- Флаги: всегда группируются по стране + близости, всегда применяются вертикальные оффсеты (overlap 80%), всегда показывается "стопка".
- Non-flags: географическая близость считается так же (`createClusters`), но визуальная группировка **условная** — только при полном выделении всей группы. Нет вертикальных оффсетов. Вместо стопки — единая иконка-счётчик + круг при hover.
- У non-flag нет использования `sortByOrder` перед createClusters (влияет на то, какой объект станет "главным" в группе).
- Размер иконок non-flag всегда сохраняет aspect ratio SVG; у флагов есть дополнительные параметры `top/width/height` из модели Marker для позиционирования текста label.

**Важные следствия для UI/UX:**
- Пока пользователь не выбрал все объекты кластера — он видит их как отдельные маркеры (удобно для точного выбора).
- Как только выбрана вся группа — они "схлопываются" в одну иконку с цифрой.
- При hover на групповую иконку можно увидеть и взаимодействовать с отдельными элементами (через круг).
- Алгоритм чувствителен к зуму: на мелком масштабе близкие объекты чаще попадают в один кластер.

### 3.2 Current non-flag clustering & hover (as-built after fixes)

Non-flag markers (is_flag=false) use the same geographic `createClusters` / `findNearbyObjects` (CLUSTER_DISTANCE_PX ≈ 37.8) as flags, but grouping is **conditional**:
- If not all objects in a cluster are selected → show them individually (no visual grouping).
- If the entire cluster is selected → one group icon (35×35 red pill with count) at the exact `lat`/`lng` of `cluster[0]`. Other members are `isHidden: true` and kept only for the hover circle.

**Group circle on hover:**
- Triggered from `GroupCircleDisplay` (in MapComponent).
- Center is taken from the `isGroupIcon` record.
- Compact radius (default 32 px, lightly adjusted by marker scale).
- Individual (smaller) icons or markers placed around the center via `getGroupCirclePositions`.
- Full interaction preserved (click selects/deselects the object and typically closes the circle; hover highlights in table/map).
- On mouse leave the circle is removed.

**Key implementation facts:**
- `processNonFlagClustering` (markerClusteringUtils.js) explicitly sets group lat/lng from `cluster[0]`.
- No `offsetY` / vertical stack offsets (unlike flags).
- `GroupCircleDisplay` wrapped in `React.memo`.
- `getGroupCirclePositions` is the shared utility (compact default, documented).
- Icons for the circle members are prepared alongside regular ones.

**Differences from flag clustering:**
- Flags: always grouped by country + proximity, always apply vertical offsets (80% overlap), permanent "stack" visual.
- Non-flags: conditional visual collapse only on full selection; circle is transient hover overlay; aspect-ratio preserved icon sizes.

**Resolved historical issues (summary of prior 3.2-3.6 narrative):**
- Group icon now reliably sits on `cluster[0]` coordinates.
- Circle centered on the group icon (radius reduced from 80→32 px, removed hover scale transform, removed interfering position:relative rules).
- No leakage of flag `offsetY` into non-flag path.

**Remaining optimization opportunities:**
- Heavy duplication of SVG load / icon generation between flag and non-flag paths → consider shared hook.
- Lighter hover circle (pixel overlay div) for large groups.
- Memoization / stable-selection clustering skips.
- Smaller unified icons for the hover circle.

See 3.1 for step-by-step algorithm. High-level mentions in 1 and 5. (Verbose historical problem reports, full bug investigations and speculative lists removed for redundancy; current as-built + actionable remaining items preserved.)

- Зоны действия: TargetAction → Circle + ActionRadiusAnimation (по типу), пересечения только одинаковых actionTitle → точки пересечения (выделяемые).
- События: draw на карте (context menu alt+click для старта) → shape JSON сохранён в Event, рендер как Circle/Polygon/Marker + popup + фильтры дат/времени/стран/типов.
- Формуляр: иерархические sections → bulk POST /bulk/ (section_id + content), attachments per section/target.
- Аналогично для CountryInfo.

Нет фоновых задач, Celery и т.п. Всё синхронно.

---

## 4. API слой (DRF)

**Базовый путь:** `/api/v1/`

**Роутер (DefaultRouter) + дополнительные пути** (api/urls.py):

**ViewSets (router):**
- `targets/` — TargetViewSet (ModelViewSet, custom serializer для create/update с actions)
- `countries/` — CountryViewSet (полный CRUD, ListSerializer)
- `markers/`, `event-markers/` — ReadOnly
- `action-types/`, `target-types/` — ReadOnly
- `event-types/` — полный ModelViewSet
- `events/` — EventViewSet (фильтры query params: date_from/to, time_*, countries=1,2, event_types=..., title)
- `country-sections/`, `formular-sections/` — ReadOnly (ListSerializer с parent)
- `country-infos/`, `country-attachments/`, `formular-attachments/` — ModelViewSet + фильтр по ?country= / ?target= / ?section=

**Отдельные endpoints:**
- `GET country/<iso_code>/` — CountryInfoView (список CountryInfo + sections для страны)
- `GET formular/<uuid:target_id>/` — FormularView (список Formular + sections)
- `POST formular/<uuid:target_id>/bulk/` — FormularBulkUpdateView (массив {section_id, content})

**Serializers (api/serializers.py):**
- Read: вложенные (Target включает Country/Marker/Actions/ActionType/Type; Event включает Country/EventMarker/EventType и т.д.)
- Write: отдельные (TargetCreateSerializer создаёт Target + TargetActions; EventWrite без read-only nested; CountryInfoWrite; bulk Formular).
- Простые List для справочников.

**Permissions:** Везде `AllowAny`. Нет аутентификации/авторизации.

**Особенности:**
- При update Target — delete всех старых actions + recreate.
- Bulk formular — update_or_create.
- Сложная фильтрация событий (диапазоны дат с учётом null end и т.д.).
- Attachments фильтруются query params.

---

## 5. Важные утилиты и вспомогательные модули

**Backend:**
- `formular/validators.py`: validate_svg (только .svg + mime image/svg+xml).
- `formular/widgets.py`: ColorRadioSelect (HTML-безопасные цветные радиокнопки).
- `formular/management/commands/seed_test_targets.py`: импорт стран/маркеров из Excel + bulk-создание Target (openpyxl).
- `infolake/enums.py`: BaseEnum.choices() для CharField choices.
- Кастомные queryset в Admin (select_related/prefetch_related для производительности).

**Frontend:**
- `config/api.js`: единая точка API_URL.
- `config/tiles.js`: TileServer GL URL и `TILE_RASTER_URL` для Leaflet `TileLayer`.
- `utils/svgUtils.js`: enrichSvg (уникализация gradient id, цветовой класс icon__*, viewBox размеры, очистка width/height), getViewBoxSize, addColorClassToSvg.
- `utils/markerFilters.js`: isFlagMarker / isNonFlagMarker / filter* (учитывает undefined как flag).
- `utils/circleIntersection.js`: calculateCircleIntersections (гавасинус + упрощённая геометрия), findAllIntersections (только одинаковые actionTitle, возвращает точки + метки объектов).
- `constants/mapConstants.js`: размеры иконок.
- `hooks/useTargetFormData.js`: Promise.all справочников + загрузка SVG маркеров.
- `hooks/useActionsArray.js`, `useDropdownWithSearch.js`.
- `components/MapComponent/markerClusteringUtils.js`: groupByCountryAndFilter, sortByOrder, latLngToPixel, findNearbyObjects, createClusters, calculate/applyClusterOffsets, processMarkerClustering (основная), processNonFlagClustering, getGroupCirclePositions. (Полное описание алгоритма non-flag см. раздел 3.1).
- `MapUtils.jsx` / `NonFlagMarkerUtils.jsx`: генерация L.DivIcon с обогащённым SVG + label, расчёт позиций с offsetY, кэш SVG; non-flag — `computeNonFlagIconSize()`.
- `circleIntersection.js` (исп. в Formular для intersections).
- `data/objects.js`: устаревший статический массив (fallback, сейчас не основной).
- Geo: `/geo/custom.geo.json` (границы стран, обработка onEachCountry + клик с alt/ctrl guards).

**Другие:**
- Frontend clustering docs (CLUSTERING_*.md, INTEGRATION_GUIDE.md, IMPLEMENTATION_SUMMARY.md) — описывают алгоритм.
- Admin CSS: `formular/static/admin/css/marker*.css`.
- События: рендер shape (point/circle/area) + маркер + popup; buildEventShape в Formular.jsx.

---

## 6. Карта файлов (путь → назначение, компактно)

**Backend root**
- `backend/manage.py` — стандартный.
- `backend/requirements.txt` — Django 6.0.6, djangorestframework, psycopg2-binary, pillow, django-environ, django-cors-headers, openpyxl, watchdog.
- `backend/Dockerfile`, `backend/docker-entrypoint.sh`, `backend/.dockerignore` — Docker-образ backend.
- `backend/infolake/settings.py` — конфиг (PostgreSQL, CORS_ALLOW_ALL_ORIGINS, REST, MEDIA_ROOT, русский язык).
- `backend/infolake/urls.py` — admin + api/v1 include.
- `backend/infolake/enums.py` — BaseEnum.
- `backend/infolake/{asgi,wsgi}.py` — стандарт.

**formular (данные + админ)**
- `backend/formular/models.py` — **все модели** (см. раздел 2).
- `backend/formular/admin.py` — регистрации + кастом (MarkerAdmin svg_thumbnail, get_queryset prefetch, Country color и т.д.).
- `backend/formular/admin_inlines.py` — TargetInline*, TargetActionInline, CountryInfoInline, FormularInline.
- `backend/formular/forms.py` — CountryForm (с ColorRadioSelect).
- `backend/formular/widgets.py` — ColorRadioSelect.
- `backend/formular/enums.py` — Colors (BaseEnum) + ActionAnimations.
- `backend/formular/validators.py` — validate_svg.
- `backend/formular/views.py` — пустой (логика в admin/api).
- `backend/formular/apps.py` — стандарт.
- `backend/formular/management/commands/seed_test_targets.py` — сид тестовых Target из `Data.xlsx`.
- `backend/formular/migrations/` — ~30 миграций (включая merge-миграции, до 0027+).

**api (DRF)**
- `backend/api/urls.py` — router + 3 custom path (country/<iso>, formular/<id>, /bulk).
- `backend/api/views.py` — все ViewSet + CountryInfoView, FormularView, FormularBulkUpdateView, Event фильтрация.
- `backend/api/serializers.py` — ~20 сериализаторов (read nested / write custom + bulk).
- `backend/api/apps.py`, `tests.py` — стандарт.

**Frontend root**
- `frontend/package.json` — React ^18.2, axios 1.4, leaflet 1.9.4, react-leaflet 4.2.1, react-leaflet-cluster 3.0.0, react-router-dom 6.14. Vite ^7.
- `frontend/vite.config.js` — React plugin, `server.watch.usePolling` + HMR для Docker/Windows.
- `frontend/Dockerfile`, `frontend/.dockerignore` — Docker-образ frontend (Vite dev).
- `frontend/index.html` — entry.
- `frontend/eslint.config.js`, `extract_iso_codes.cjs`, `iso_codes_*.json/txt` — вспомогательные скрипты.
- `frontend/INTEGRATION_GUIDE.md`, `IMPLEMENTATION_SUMMARY.md`, `CLUSTERING_DOCUMENTATION.md`, `CLUSTERING_README.md` — доки по интеграции и кластеризации.
- `frontend/README.md` — локальный README фронтенда.

**Frontend src/**
- `src/main.jsx`, `App.jsx` (минимальный; реальный UI в Formular.jsx), `App.css`, `index.css`.
- `src/config/api.js` — API_URL.
- `src/config/tiles.js` — TileServer GL, `TILE_RASTER_URL`.
- `src/constants/mapConstants.js`.
- `src/data/objects.js` — статический fallback (не основной источник).
- `src/hooks/` — useTargetFormData, useActionsArray, useDropdownWithSearch (+ hooks_usage_summary.md).
- `src/utils/` — svgUtils.js, markerFilters.js, circleIntersection.js.
- `src/assets/` — глобальные CSS (reboot, fonts, блоки), шрифты Roboto, изображения и SVG-спрайты.
- `src/components/`:
  - `Formular/Formular.jsx` + .css — **главный оркестратор** (загрузка данных, состояние, вкладки Objects/Events, фильтры, модалы, measure, action-radius, intersections).
  - `MapComponent/MapComponent.jsx` (основной) + MapUtils.jsx + markerClusteringUtils.js + NonFlagMarkerUtils.jsx + ActionRadiusAnimations.jsx + ActionRadiusLegendButton.
  - Есть архивная копия: `MapComponent — archive/`.
  - `ObjectsTable/ObjectsTable.jsx`.
  - `Events/` — EventsTable, EventsFilterPanel, AddEventModal.
  - `FormularModal/`, `FormularEditor/` (bulk-редактор + загрузка/удаление attachments).
  - `AddTargetModal/`, `EditTargetModal/`.
  - `CountryModal/`, `EditCountryModal/`.
  - `FilterPanel/`, `FilterForm/`, `Features/` (measure + intersections), `IntersectionTable/`.
  - `Header/`, `Footer/`, `Sidebar.jsx` (частично legacy).
- `public/` — geo/custom.geo.json (границы стран), leaflet-иконки, SVG-спрайты и изображения.

**Media (runtime)**
- `backend/media/` — полностью игнорируется в .gitignore (не попадает в репозиторий). Содержит загруженные маркеры (76+ SVG), иконки событий, attachments стран и формуляров.

**Другое**
- `backend/markers/` (пример SVG).
- `frontend/` содержит дополнительные файлы документации и скриптов (см. выше).
- `Значки/`, `Значки событий/` — исходные SVG-иконки (в .gitignore; для `backend/media/` и `seed_test_targets`).
- `Data.xlsx` — справочники `formular_marker` + `formular_country` (в .gitignore: `*.xlsx`, `*.xlsm`).
- Корневой `docker-compose.yml` — `tileserver` (8080) + `backend` (8000) + `frontend` (5173); PostgreSQL на хосте.
- `.gitignore` — `backend/` + `frontend/` в git; игнорируются `media/`, `**/*.mbtiles`, `*.xlsx`, `Значки/`, артефакты `tileserver/`, `_data_xlsx_report.txt`.

---

**Примечания для следующего агента:**
- Всё API открыто (`AllowAny`). Добавление auth потребует изменений в permissions + возможно JWT.
- Кластеризация жёстко завязана на `marker.is_flag`, `order`, `scale`, `country.title` и пиксельные расчёты через `map.latLngToLayerPoint`.
- Формуляр и CountryInfo — контент + attachments отдельно (bulk + файловые аплоады).
- События используют JSON shape (не GeoDjango).
- При изменениях моделей — миграции + обновление сериализаторов/модалов/хуков.
- Frontend state сосредоточен в `Formular.jsx` (не Redux/Context глобально). Много `useMemo`/`useEffect` для фильтров, intersections, кластеров.
- SVG обработка критична (уникализация `id`/`gradient` при множестве одинаковых маркеров).
- **Интеграция с TileServer выполнена** (ветка develop_tailserver):
  - `MapComponent.jsx` использует `<TileLayer url={TILE_RASTER_URL} />` из `config/tiles.js`.
  - URL: `{VITE_TILESERVER_URL}/styles/borders-labels/{z}/{x}/{y}.png` (дефолт `http://localhost:8080`).
  - Attribution OpenMapTiles + OSM; `maxZoom={14}`.
  - GeoJSON стран (`public/geo/custom.geo.json`) — поверх тайлов для кликабельности и CountryModal.
  - Без `map.mbtiles` в `tileserver/data/` карта на 8080 будет пустой — нужен файл тайлов.
- **Docker dev:** bind mount синхронизирует код, но на Windows нужен polling в Vite (`vite.config.js`) и `CHOKIDAR_USEPOLLING` в compose; иначе HMR не видит правки. Backend autoreload через `watchdog` + `runserver --nothreading`.
- **Тестовые данные:** `python manage.py seed_test_targets --count 1000` (из `Data.xlsx` + SVG из `Значки/`).
- При добавлении новых директорий/зависимостей обновляй `.gitignore` и этот раздел контекста.
- Основной справочник для агентов — **только этот файл**. Перед глубоким чтением кода обновляй `project_context.md`.
- Переменные окружения фронтенда: `VITE_API_URL` (дефолт в коде `http://172.16.80.207:8000`, в Docker `http://localhost:8000`), `VITE_TILESERVER_URL` (дефолт `http://localhost:8080`).

Файл создан как единый компактный справочник. Дубли кода и длинные фрагменты исключены.

**Последнее обновление:** 2026-06-11 — Docker (backend/frontend/tileserver), TileServer во фронте, seed_test_targets, gitignore xlsx, исправление расчёта высоты non-flag маркеров.

---

## 7. TileServer GL — оффлайн векторные карты (ветка develop_tailserver)

**Текущий статус (на момент актуализации):**
- Инфраструктура TileServer GL в целом развёрнута.
- Корневой `docker-compose.yml` поднимает сервис `tileserver` (образ `maptiler/tileserver-gl:latest`) на порту 8080, монтируя `./tileserver:/data`.
- В `tileserver/` присутствуют:
  - `config.json`, стили (`styles/borders-labels.json` + `basic.json`), шрифты (`fonts/Open Sans *`).
  - Скрипты (`download-data.ps1`, `apply-name-overrides.ps1`, `pre-render-png.js` и др.).
  - `data/name-overrides.json` (правила подмены имён, например Нур-Султан → Астана).
  - `tileserver_start_guide.md` (дублируется также в корне проекта).
- **Важно:** на текущий момент в `tileserver/data/` отсутствует файл `map.mbtiles` (векторные тайлы). Доступны только шрифты и стили.
- В директории `tileserver/` присутствует значительное количество артефактов (нарушение .gitignore):
  - `docker-compose.yml` (должен быть только в корне проекта)
  - `$null`, `-L/`, `-o/`, `curl.exe/`, `test_data.zip/`
- Контейнер успешно поднимается командой из корня проекта: `docker compose up -d`.

**Цель:**
- Локальный сервер векторных тайлов без доступа к интернету (замена/дополнение внешних тайлов).
- Полноценные векторные данные OpenMapTiles: границы, подписи населённых пунктов, гидрография, дороги и т.д.
- Полная поддержка русского языка (`name:ru` + кастомная подмена устаревших названий через `name-overrides.json`).

**Технологии и компоненты:**
- Docker-образ: `maptiler/tileserver-gl:latest`
- Конфигурация: `config.json` (пути к `data/`, `fonts/`, `styles/`, источник `openmaptiles`).
- Стили: `borders-labels.json` (основной, с границами и подписями), `basic.json`.
- Шрифты: Open Sans (Regular/Bold/Italic/Semibold) — хранятся в git.
- Подмена имён: `data/name-overrides.json` (применяется на уровне стиля).
- Глифы в стилях: `"glyphs": "{fontstack}/{range}.pbf"` (без префикса `fonts/`, т.к. путь уже задан в config.json).

**Ключевые особенности рендера:**
- Приоритет имён: `name:ru` → `name` → `name:latin`.
- Цветовая схема (фон `#f2efe9`, вода `#a3c4d9`, границы `#555555` и др.).
- Подмена названий работает на уровне стиля (не затрагивает исходные MBTiles).

**Проверка работоспособности (после `docker compose up -d`):**
- Веб-интерфейс: http://localhost:8080
- Стиль borders-labels: `/styles/borders-labels/style.json`
- Векторные тайлы: `/data/openmaptiles/{z}/{x}/{y}.pbf`
- Растровые тайлы: `/styles/borders-labels/{z}/{x}/{y}.png`
- Шрифты: `/fonts/Open%20Sans%20Regular/0-255.pbf`
- Метаданные: `/data/openmaptiles.json`

**Состояние интеграции с приложением:**
- **Выполнена** в активном `MapComponent.jsx`: `TileLayer` с `TILE_RASTER_URL` из `src/config/tiles.js`.
- Заглушка `/tiles/{z}/{x}/{y}.png` **не используется**.
- Архивная копия: `MapComponent — archive/` (устаревшая).
- Для отладки TileServer: TileJSON `/data/openmaptiles.json`, style `/styles/borders-labels/style.json`.
- Кластеризация, события, зоны действия работают поверх растрового слоя TileServer.

**Запуск и управление (из корня проекта):**
```bash
docker compose up -d --build   # tileserver + backend + frontend
docker compose ps
docker compose restart frontend # после смены vite.config.js
docker compose down
```
- Frontend: http://localhost:5173  
- Backend API: http://localhost:8000/api/v1/  
- TileServer UI: http://localhost:8080 (стиль **borders-labels**)  
- PostgreSQL: **на хосте** (`DB_HOST=host.docker.internal` в контейнере backend).

**Источники данных и лицензии:**
- OpenMapTiles (векторные MBTiles): limaps.org, object.data.gouv.fr и др.
- Схема слоёв: https://openmaptiles.org/schema/
- Лицензия данных: © OpenMapTiles © OpenStreetMap contributors (требуется атрибуция).
- Шрифты и тестовые данные: из официального `test_data.zip` TileServer GL.

**Примечания и типичные проблемы:**
- Порт 8080 должен быть свободен.
- Отсутствие `map.mbtiles` — основная причина "пустой карты" на 8080.
- Шрифты критичны: неправильный путь `glyphs` → ошибка "Invalid range".
- После изменений стилей или `name-overrides.json`: `docker compose restart`.
- Артефакты в `tileserver/` (`$null`, `-L/`, `-o/`, `curl.exe/`, `test_data.zip/`, `tileserver/docker-compose.yml`) следует удалить в соответствии с `.gitignore`.
- Карта: Leaflet + растровые тайлы TileServer GL (`borders-labels`).

**Важно:** Полезные данные TileServer (стили, шрифты, config, name-overrides) — в `tileserver/`. Корневой `docker-compose.yml` объединяет tileserver, backend и frontend; PostgreSQL остаётся на хосте.

---

## 8. Data.xlsx — структура справочников

Файл в корне проекта (`Data.xlsx`, в gitignore). Один лист, две таблицы:

**`formular_marker`** (30 записей) → модели `Marker` + `TargetType`:
- Колонки: `title`, `path`, `top`, `width`, `height`, `is_flag`, `order`, `scale`
- `is_flag=true` — флаги (ПУ, командования, армии); `false` — иконки (аэродром, НПЗ, инфраструктура)
- SVG на диске: папка `Значики/` (маппинг имён в `seed_test_targets.py`)

**`formular_country`** (9 записей) → модель `Country`:
- Колонки: `title`, `color`, `title_short`, `iso_code`
- Страны: КНР, Узбекистан, Таджикистан, Казахстан, Кыргызстан, Туркменистан, Афганистан, Иран, Азербайджан

**Импорт тестовых Target:**
```bash
cd backend
python manage.py seed_test_targets --count 1000
python manage.py seed_test_targets --clear   # удалить seed:test:*
```

---

## 9. Линейка масштаба (Scale Bar) на карте — полноэкранный режим

**Примечание по документации (оптимизация контекста 2026):**  
Первоначальная развёрнутая спецификация (алгоритм вычисления, интеграция, требования к качеству) была избыточно детальной и частично дублировала последующие «Реализованные детали». Она сокращена. Актуальное состояние — в блоках «Реализованные детали» (основная реализация) и подразделах 9.1–9.1.2 (инкрементальные доработки: дропдаун, направление открытия, обрезка списка). Это устраняет повторения при сохранении всей важной информации.

**Core требования (сжато):**
- Только в режиме fullscreen.
- Двойное отображение: числовой военный масштаб (`1 : 50 000` и т.п.) + 4-сегментная двухцветная графическая линейка.
- Позиция: bottom-center.
- Адаптивный реальный расчёт (Web Mercator + cos(lat) + снаппинг к стандартным знаменателям).
- Цвета: `#1f2a38` / `#f4f6f7` / `#3a4654`.
- С версии 9.1+: клик по числу открывает дропдаун выбора (открывается **наверх**); выбор → `flyTo` с сохранением центра.

**Требование пользователя (историческое, сжато):**  
Добавить к карте в режиме fullScreen обозначение масштаба по примеру топографических карт.
- Отображение **двойное**: числовое + графическое (двухцветное).
- Блок разместить **внизу по центру** карты.
- Значение масштаба **адаптивное**, отражает реальное текущее значение на экране.
- Числовое обозначение — строго в формате **военных / топографических стандартов**: `1:10 000`, `1:50 000`, `1:100 000` и т.д. (с пробелом в тысячах при необходимости).
- Цвета должны хорошо читаться на фоне подложки TileServer GL (стиль `borders-labels`, фон ~#f2efe9 кремовый, границы тёмные, вода #a3c4d9).

**Статус на момент добавления в контекст:** Требуется реализация (новая функциональность).  
(Исторические детальные блоки видимости/позиционирования/стиля/логики ниже сокращены как избыточные — см. актуальные «Реализованные детали» и подразделы 9.1.x.)

**Позиционирование (историческое, для справки):**
- Внутри контейнера карты (`.leaflet-container` или его ближайший relative wrapper).
- CSS: `position: absolute; bottom: 10–16px; left: 50%; transform: translateX(-50%);`
- Достаточно высокий z-index, чтобы быть поверх тайлов, GeoJSON и маркеров, но не перекрывать попапы, модалы и панели инструментов.
- Должен корректно работать при ресайзе окна и переключении fullscreen.

**Визуальный стиль (топографический, исторический — см. Реализованные детали):** (сокращено для устранения избыточности)

**Выбранные цвета (для светлой подложки borders-labels):**
- Тёмный сегмент: `#1f2a38` (глубокий тёмно-синий/почти чёрный — хороший контраст на кремовом).
- Светлый сегмент: `#f4f6f7` (почти белый с лёгким холодным оттенком).
- Обводка бара: 1px `#3a4654` или `rgba(0,0,0,0.65)`.
- Текст (число + метки): `#1f2a38`.
- Дополнительно: `text-shadow: 0 1px 2px rgba(255,255,255,0.75)` или лёгкая белая обводка для улучшения читаемости на любой подложке.
- При необходимости можно сделать альтернативу с `black/white` (`#111` / `#eee`), но `#1f2a38` + `#f4f6f7` лучше вписывается в палитру стиля.

**Реализованные детали (2026):** (см. ниже; исторические блоки алгоритма/интеграции/качества удалены как избыточные)

- **Компонент:** `MapScaleBar` (внутренний компонент внутри [MapComponent.jsx](/frontend/src/components/MapComponent/MapComponent.jsx)).
- **Рендер:** размещён внутри `<MapContainer>` сразу после `<ZoomTracker>`, чтобы имел доступ к `useMap()`. Условно возвращает `null` когда `!isFullscreen`.
- **Позиционирование:** `position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%)` внутри relative контейнера карты. z-index 650 (выше маркеров, ниже попапов и сайдбара).
- **Видимость:** строго только при `isFullscreen === true` (передаётся пропсом из Formular → MapComponent). В обычном режиме компонент ничего не рендерит.

**Цвета (точно как в реализации):**
- Тёмный сегмент: `#1f2a38`
- Светлый сегмент: `#f4f6f7`
- Обводка сегментов: `#3a4654`
- Текст (1:N + метки): `#1f2a38`
- Фон контейнера линейки: `rgba(255,255,255,0.82)` + лёгкая тень — хорошо читается на кремовой подложке TileServer `borders-labels`.

**Логика вычисления (в `updateScale`):**
- `metersPerPx = 156543.03392 * cos(lat) / 2^zoom` (классическая формула Web Mercator).
- Целевая ширина бара ~170 px.
- Округление ground distance по ряду 1-2-5 (с коэффициентами).
- `barWidth` пересчитывается точно под nice distance.
- Representative Fraction: `denomRaw = niceMeters / (barWidth * 0.000264583333)` (96 DPI приближение), затем снаппинг к ближайшему из текущего списка стандартных топо/военных масштабов `[10000, 25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 3000000]` (масштабы детальнее 1:10 000 исключены).
- Формат числа: `1 : 50 000`, `1 : 100 000`, `1 : 2 500 000` и т.д. (с пробелами в больших числах, улучшенный форматер для поддержки до 1:3 000 000).
- Графика: ровно **4 сегмента** (чередование двух цветов) — классический топографический вид. Метки: "0" слева и "X км/м" справа.

**CSS-классы (добавлены в MapComponent.css):**
- `.map-scale-bar` — контейнер
- `.map-scale-numeric`
- `.map-scale-ruler`
- `.map-scale-labels`

Стили используют inline для сегментов (динамическая ширина) + фиксированные CSS-правила.

**Интеграция:**
- Слушает `zoomend`, `moveend`, `resize` на карте (с небольшим debounce ~60мс).
- Пересчёт происходит также при входе в fullscreen (через эффекты родителя).
- Не влияет на кластеризацию, события, измерения и другие оверлеи.
- `pointer-events: none` на контейнере (линейка чисто информационная).

**Нюансы / замечания:**
- Расчёт использует центр карты — для большинства задач в проекте (средние широты) этого достаточно.
- При очень мелких масштабах (zoom ~5 и ниже) линейка может показывать крупные значения (сотни км) — это ожидаемо и соответствует реальному виду.
- Leaflet `.leaflet-bottom` ранее уже был скрыт (`display:none`), поэтому стандартный scale control не конфликтует.
- Линейка не мешает курсорным координатам (`.map__cursor-coords` внизу слева) и кнопке сайдбара (справа).

**Пример отображения:**
```
1 : 50 000
████░░░░████░░░░   (тёмный/светлый)
0               1 км
```

**Примечание:** Функционал только для визуального отображения в полноэкранном режиме. Не заменяет существующий инструмент измерений (measure).

### 9.1 Интерактивный выбор масштаба (выпадающий список по клику на числовое значение)

**Дополнительная функциональность (9.1):**  
Выпадающий список выбора масштаба по клику на числовое значение. Открывается **наверх**. Выбор масштаба вызывает `flyTo` (центр сохраняется), линейка обновляется.

**Текущий список доступных масштабов (после обрезки детальнее 1:10 000):**
```
[10000, 25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 3000000]
```
(Самый детальный — 1:10 000. Применяется и к дропдауну, и к снаппингу в updateScale. Текущий выделяется в списке. Добавлены крупные масштабы 1:2 500 000 и 1:3 000 000 по запросу пользователя.)

(Полные исторические описания поведения, дизайна, технической интеграции и нюансов были избыточны после реализации — они дублировали блок «Реализованные детали (2026)» ниже. Актуальная реализация описана там.)

**Реализованные детали (2026):**

- **Расширение `MapScaleBar`** (всё внутри [MapComponent.jsx](/frontend/src/components/MapComponent/MapComponent.jsx), без выноса в отдельный файл):
  - Добавлена модульная константа `AVAILABLE_DENOMINATORS`.
  - Изначально: `[1000,2000,5000,10000,...]`.
  - Обновлено (убраны масштабы детальнее 1:10 000): `[10000, 25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 3000000]`.
  - Константа переиспользуется в `updateScale` для снаппинга Representative Fraction, в рендере дропдауна и в расчёте зума `getZoomForDenominator`. Старый дублирующийся массив `common` полностью заменён. 250000 и более детальные исключены по требованию.
  - Добавлены `useState` для `isDropdownOpen`, `useRef` для `numericRef` и `dropdownRef`.
  - Новая чистая функция `getZoomForDenominator(denominator, lat)` — обратный расчёт зума по той же формуле Web Mercator + 0.000264583333 приближению, как в forward `denomRaw`. Ограничение [0..18].
  - Обработчики: `handleNumericClick` (stopPropagation + toggle), `handleScaleSelect` (если отличается — `map.flyTo(center, targetZoom, {duration:0.25})`, затем закрыть).
  - Два дополнительных `useEffect`:
    - При `!isFullscreen` → принудительно закрыть дропдаун.
    - При открытом: слушатели `mousedown` (вне numeric + dropdown) + `keydown` (Escape).
  - Изменён рендер:
    - `.map-scale-numeric` получил `ref`, `onClick`, `title`.
    - Сразу после numeric вставлен условный `.map-scale-dropdown` (рендерит все опции, активная — текущий denom).
  - Список закрывается после выбора (в т.ч. если выбрали тот же), при выходе из fullscreen, по клику вне, по Esc.
  - Использован `flyTo` (лёгкая анимация) вместо голого `setZoom` — соответствует "перерисовать карту".

- **CSS ([MapComponent.css](/frontend/src/components/MapComponent/MapComponent.css))**:
  - Добавлен `position: relative` (через повтор правила) на `.map-scale-bar` для надёжного абсолютного позиционирования дропдауна.
  - `.map-scale-numeric`: `cursor: pointer`, `pointer-events: auto`, мягкий hover background.
  - `.map-scale-dropdown`: абсолютно позиционирован **наверх** от всей линейки (`bottom: 100%`, `left:50%`, `translateX(-50%)`, `margin-bottom: 4px`), фон почти белый, рамка #3a4654, тень, z-index 670, ограниченная высота + скролл.
  - `.map-scale-option`: компактный padding, hover #e8eaec, `--active` — жирный + фон #d4d8dc.
  - `pointer-events: auto` только на интерактивных частях (не ломает остальное поведение линейки и `pointer-events:none` на контейнере).
  - Комментарий в `.map-scale-bar` обновлён для отражения поддержки направления вверх.

- **Интеграция и поведение:**
  - Полностью сохраняет все предыдущие требования раздела 9 (только fullscreen, 4-сегментная линейка, точные расчёты, цвета #1f2a38/#f4f6f7 и т.д.).
  - При выборе нового масштаба центр карты сохраняется, зум меняется — линейка сразу же обновляется через существующие `zoomend` + `updateScale`.
  - Текущий масштаб в списке визуально выделен (жирный + фон).
  - Минимальные изменения: логика вычисления зума и форматы переиспользованы.
  - Dropdown не мешает другим контролам (z-index выбран разумно).

- **Нюансы / замечания:**
  - Из-за дискретности зумов Leaflet точное совпадение 1:N после прыжка не всегда 100% (updateScale всё равно прилетит и покажет ближайший снапнутый) — это ожидаемо и соответствует оригинальному поведению.
  - `flyTo` даёт плавный переход; при желании можно заменить на `setZoom` (без анимации).
  - Работает на любых широтах (учитывает cos(lat) в расчёте зума).
  - При переключении fullscreen dropdown корректно скрывается вместе со всей линейкой.

**Пример взаимодействия:**
- На экране `1 : 50 000` → клик → открывается список → выбираешь `1 : 10 000` → карта плавно зумится ближе (центр сохранён), линейка показывает новый масштаб.
- Выбор текущего значения — просто закрывает список.

### 9.1.1 Изменение направления открытия списка (требование пользователя)

**Требование (дополнение):** Выпадающий список масштабов должен отображаться **наверх** (вверх от числового значения и линейки), а не вниз.

**Причина:** При линейке масштаба, расположенной в самом низу карты (bottom: 12px), открытие вниз может быть менее удобным или уходить за край экрана в некоторых разрешениях/режимах. Открытие вверх даёт больше визуального пространства и лучше вписывается в нижнюю позицию контрола.

**Что меняется:**
- Позиционирование `.map-scale-dropdown`:
  - Было: `top: 100%; margin-top: 4px;`
  - Становится: `bottom: 100%; margin-bottom: 4px;`
- Список будет появляться **выше** всего блока `.map-scale-bar`.
- Остальная логика (JS-рендер, обработчики, стили опций, закрытие и т.д.) остаётся без изменений.
- При необходимости можно добавить лёгкую стрелку-указатель или скорректировать z-index, но минимально — только смена направления.

**Реализованные детали (дополнение 9.1.1):**

- Изменено только CSS-правило `.map-scale-dropdown`:
  - `top: 100%; margin-top: 4px;` → `bottom: 100%; margin-bottom: 4px;`
- Список теперь появляется **выше** всего блока линейки масштаба (над числовым значением + графической шкалой).
- Никаких изменений в JSX (рендер dropdown сразу после numeric остаётся), JS-логике, обработчиках или константах не потребовалось — абсолютное позиционирование полностью контролирует направление.
- Обновлён комментарий в `.map-scale-bar` для ясности.
- Основное описание в разделе 9.1 (CSS-буллет) тоже синхронизировано.

**Результат:** При клике на `1 : XX XXX` в fullscreen список открывается вверх (в сторону центра карты), что удобнее при расположении линейки в самом низу экрана.

**Статус:** Реализовано (минимальная точечная правка позиционирования).

**Тестирование (рекомендуется):** fullscreen + клик на numeric при разных размерах карты и разрешениях. Убедиться, что список не перекрывается другими элементами и корректно закрывается.

### 9.1.2 Обрезка списка доступных масштабов (требование пользователя)

**Требование:** Убрать из списка выбора и снаппинга масштабы детальнее 1:10 000.

**Реализованные детали:**
- Обновлена константа `AVAILABLE_DENOMINATORS` в MapComponent.jsx на `[10000, 25000, 50000, 100000, 200000, 500000, 1000000, 2500000, 3000000]`.
- Обновлены комментарии у константы.
- Изменение автоматически применилось к:
  - Выпадающему списку (рендер опций).
  - Внутреннему снаппингу в `updateScale` (больше не будет предлагать 1:5 000 и мельче).
  - Расчёту целевого зума в `getZoomForDenominator`.
- Соответствующие описания в project_context.md (раздел 9 и 9.1) обновлены раньше кода.
- Самый детальный масштаб теперь 1:10 000.

**Статус:** Реализовано.

---

**Дата последнего обновления контекста:** 2026 (анализ + оптимизация всего project_context.md: удалена крупная историческая избыточность в разделе 3 (3.2–3.6 — проблемы/баг-репорты/предложения по non-flag кластеризации сведены к текущему as-built + actionable remaining); дополнительно подчищены дубли в 9 и closing notes; section 0 сокращён; header обновлён).

---

## Current Session Task (new query)

User query: `@frontend/src/components/MapComponent/MapComponent.jsx` + `/model`

- User has attached/referenced the main map component file for context (the file is large; specific sections will be read with targeted offset/limit as needed).
- This component is the primary location for:
  - The adaptive topographic scale bar (see fully documented section 9 and 9.1.x): visible **only in fullscreen**, military numeric format ("1 : 50 000"), two-color 4-segment graphical ruler (#1f2a38 / #f4f6f7), real Leaflet/Web Mercator + cos(lat) calculations with snapping, clickable numeric that opens upward dropdown, selection triggers `map.flyTo` (preserving center) to matching zoom. AVAILABLE_DENOMINATORS starts at 1:10 000.
  - Marker rendering and clustering (both flag and non-flag paths, using markerClusteringUtils.js and NonFlagMarkerUtils.jsx).
  - Event shapes, action radius animations/intersections, measure tool (Ctrl+click), GeoJSON country boundaries, fullscreen state propagation.
  - Integration with parent Formular.jsx for objects, selection, hovered state, etc.
- **Strict protocol followed:** Update to `project_context.md` performed **before** any read_file / grep / list_dir or other access to the referenced source file or any files under frontend/src/.
- Likely purpose: analysis, review, debugging, or incremental changes to MapComponent.jsx (especially scale bar or map UI features). No explicit "implement X" or "fix Y" instructions given in this message — will add detailed requirements here once clarified or proceed with targeted inspection only after this record.
- `/model` command handling: Per TUI documentation and prior session pattern, the current active model is **Grok 4.3** (released by xAI, April 2026). (User guide discovery attempted via standard paths; model info consistent with system definition.)

After recording this update, work continues exclusively from the context. If the task requires code inspection or changes, further details/requirements will be appended here first.

---

## 10. UI: Таблица списка объектов — группировка по странам (раскрывающийся список + чекбокс "выбрать все в стране")

**Дата добавления требования:** текущая сессия

**Контекст:** Пользователь хочет улучшить таблицу со списком объектов (вероятно ObjectsTable.jsx, отображаемая в Formular.jsx). Текущая таблица, по-видимому, показывает плоский список. Требуется сгруппировать объекты по странам.

### Основные требования
- Объекты в таблице **группируются по стране** (`country.title` из данных объекта).
- Каждая группа представлена в формате **раскрывающегося списка** (collapsible / accordion):
  - Заголовок группы (страна): название страны + количество объектов в группе + цвет страны (если есть).
  - При клике по заголовку (кроме чекбокса) — группа раскрывается/сворачивается.
  - Внутри раскрытой группы — список объектов этой страны (каждый объект: чекбокс + название/label + возможно другие поля: тип, координаты и т.д.).
- **Чекбокс "выбрать все в стране"**:
  - Расположен в заголовке группы (рядом с названием страны).
  - При установке — добавляет **все** id объектов этой страны в глобальный selected (selectedObj / selectedIds).
  - При снятии — убирает все id объектов этой страны из selected.
  - Состояние:
    - Отмечен полностью — все объекты страны выбраны.
    - Частично отмечен (indeterminate) — выбрана часть объектов страны.
    - Снят — ни один объект страны не выбран.
  - Клик по этому чекбоксу **не должен** переключать раскрытие группы (нужен stopPropagation / отдельный обработчик).
- Выбор отдельных объектов внутри группы работает как раньше (отдельные чекбоксы).
- Глобальное состояние выбора остаётся массивом id объектов (не меняем архитектуру selected).
- Группировка применяется к отображаемому списку (учитывает текущие фильтры/поиск из Formular, если они есть).
- Страны в списке групп: отсортировать по названию (или по порядку, если есть). Внутри страны — объекты по `marker.order` или title (как сейчас).
- Визуально:
  - Чёткое разделение групп (border, background, отступы).
  - Использовать цвет страны (country.color) для акцента заголовка группы.
  - Коллапс: можно использовать нативный `<details>` + `<summary>` (просто и без лишнего state) или контролируемые div'ы (если нужно сохранять состояние открытых групп).
  - Чекбокс в summary требует аккуратной обработки событий.
- Совместимость:
  - Не ломает существующие фильтры, поиск, переключение вкладок (Objects/Events).
  - Выбранные объекты по-прежнему влияют на карту (маркеры, кластеризация non-flag и т.д.).
  - Таблица остаётся синхронизированной с картой и другими частями UI.
- Edge cases:
  - Пустая страна — не показывать группу.
  - Один объект в стране — группа всё равно сворачиваемая (или можно сделать exception, но лучше единообразно).
  - Много стран/объектов — производительность (группировка O(n), рендер только видимых).
  - Индикатор количества выбранных в группе в заголовке (опционально, но полезно: "Страна (12/35)").

### Ожидаемый пользовательский сценарий
1. Пользователь видит список стран (свёрнутый или частично раскрытый).
2. Кликает чекбокс рядом со страной → все объекты этой страны становятся выбранными (галочки появляются у каждого, маркеры на карте обновляются).
3. Раскрывает группу, снимает галочки у некоторых объектов внутри.
4. Чекбокс страны автоматически переходит в indeterminate.
5. Повторный клик по чекбоксу страны сбрасывает выбор всех в этой стране.

### Технические замечания (для реализации)
- Группировка: лучше делать в Formular.jsx (или в хуке) — `groupedByCountry = useMemo(() => groupBy(objects, o => o.country?.title), [filteredObjects])`.
- Передавать в ObjectsTable сгруппированные данные + текущий setSelected.
- Или оставить ObjectsTable плоским, но рендерить группы в Formular и передавать только visible объекты.
- Для indeterminate: использовать `ref` на input или controlled checkbox с `checked` + `indeterminate` property.
- CSS: добавить стили для `.country-group`, `.country-header`, `.country-objects-list`. Можно переиспользовать существующие стили таблиц/чекбоксов.
- Существующий код выбора (onChange отдельного объекта) должен остаться рабочим.

**Статус:** Реализовано.

**Что было сделано:**
- Полностью переработан `ObjectsTable.jsx`: вместо плоской `<table>` теперь используется группировка по `country.title`.
- Каждая страна — `<details class="country-group">` (нативный раскрывающийся список).
- В `<summary class="country-header">`:
  - Чекбокс "выбрать все в стране" с поддержкой `indeterminate` (частичное выделение).
  - Название страны + количество объектов.
  - При частичном выборе показывается счётчик выбранных.
- Клик по чекбоксу страны массово вызывает `onCheckboxChange` для всех объектов группы (не ломает глобальный `selectedObj`).
- Внутренние объекты отображаются компактными строками (сохранили flyto, hover, клик по названию для открытия формуляра, edit/delete).
- Добавлена верхняя панель "Выбрать все видимые" (работает на всём `filteredObjects`).
- Добавлены стили в `Formular.css` (`.country-group`, `.country-header`, `.object-row` и т.д.). Визуально группы отделены, есть hover и отступы.
- Фильтры (FilterPanel) продолжают работать — группировка применяется уже к `filteredObjects`.
- Интерфейс компонента (props) не изменился — правки только внутри ObjectsTable.
- Выбор объектов продолжает синхронизироваться с картой (MapComponent получает те же `selectedObj`).

**Обновление по запросу пользователя:** По умолчанию все группы стран **свёрнуты** (атрибут `open` убран). Пользователь может раскрывать отдельные страны вручную.

**Дополнение (новый запрос):** Добавлены кнопки «Развернуть все» / «Свернуть все» над списком групп стран. 
- Кнопки управляют состоянием всех групп одновременно.
- Реализовано через контролируемый `open` на `<details>` + внутренний `useState<Set<string>>` для expandedCountries.
- При клике на индивидуальный summary состояние синхронизируется.
- Кнопки размещены рядом с «Выбрать все видимые» в верхней панели.
- Добавлены минимальные стили для кнопок (классы `expand-btn`).
- Начальное состояние — все группы свёрнуты (пустой Set).

**Примечание по списку масштабов в коде:** В коде `AVAILABLE_DENOMINATORS` = [25000, 50000, ..., 1000000, 2500000, 3000000] (начинается с 25000, хотя некоторые описания упоминают 10000). Добавлены 2500000 и 3000000. При необходимости можно выровнять с 10000.

Обновление контекста и реализация выполнены в строгом соответствии с правилами проекта.

---

## Debug: Вывод в консоль масштаба, используемого для тайлов

**Запрос пользователя:** "выведи в консоль значение масштаба, которое используется в текущий момент для тайлов"

**Цель:** Помочь с отладкой — видеть, какой zoom level (и/или вычисленный масштаб 1:N) Leaflet в данный момент использует при загрузке тайлов из тайлсервера.

**Что нужно вывести:**
- Основное значение для тайлов — текущий `map.getZoom()` (или Math.floor / round, т.к. тайлы запрашиваются по целому z).
- Желательно также вычисленный "масштаб" в стиле топографическом (Representative Fraction / denom), аналогично тому, что делает MapScaleBar (чтобы сравнить визуальный масштаб и тайлы).
- Формат лога удобный для консоли, например:
  `console.log('[Tiles] zoom:', zoom, 'approx scale 1:', denom, 'center:', center);`

**Где реализовать:**
- В MapComponent.jsx (главный компонент карты).
- Лучше всего через `useMapEvents` (react-leaflet) на события `zoomend` и `moveend` (или только zoomend, чтобы не спамить).
- Или внутри существующей логики обновления масштаба (если есть ZoomTracker или подобное).
- Лог должен срабатывать при изменении зума/положения карты.
- Можно добавить условие (например, только в dev режиме, или временный флаг).

**Технические детали:**
- `useMap()` даёт доступ к leaflet map instance.
- Формула из scale bar (для consistency):
  ```js
  const zoom = map.getZoom();
  const center = map.getCenter();
  const metersPerPx = 156543.03392 * Math.cos((center.lat * Math.PI) / 180) / Math.pow(2, zoom);
  // затем расчёт niceMeters / denomRaw как в updateScale
  ```
- Доступные константы: AVAILABLE_DENOMINATORS уже есть в файле.
- Не ломать существующий MapScaleBar (он уже считает похожий масштаб, но только в fullscreen).

**Статус:** Требуется реализация. Обновление контекста выполнено перед любыми чтениями/изменениями кода MapComponent.jsx или связанных файлов.

**Примечание:** Это временный debug-лог для разработки. После отладки можно убрать или закомментировать.

---

## Marker Visibility Filtering by Zoom

**Запрос пользователя (на основе ссылки на MapComponent.jsx):** "теперь, сделай так, чтобы до 5 масштаба включительно на карте отображались маркеры с order только 1 и 2"

**Требования:**
- При текущем зуме карты `<= 5` (включительно) отображать **только** маркеры, у которых `marker.order` равен 1 или 2.
- При зуме `> 5` — показывать все маркеры как обычно (без этого ограничения).
- "Масштаб" здесь означает zoom level Leaflet (currentZoom).
- Фильтрация применяется к объектам (Targets), которые рендерятся как маркеры на карте.
- Должно работать для flag-маркеров (через кластеризацию) и non-flag маркеров.
- Сохранить существующую логику выбора (selectedObj), ховера, кликов, группировок кластеров, отрисовки в GroupCircleDisplay и т.д.
- Фильтр должен реагировать на изменение зума в реальном времени (использовать существующий currentZoom из ZoomTracker).
- Объекты с `marker.order` 1 и 2 имеют высший приоритет (из истории кластеризации: меньший order = выше в стеке).

**Дизайн и реализация (задокументировано до чтения кода):**
- В MapComponent.jsx есть:
  - `const [currentZoom, setCurrentZoom] = useState(4);`
  - `<ZoomTracker onZoomChange={setCurrentZoom} />`
  - Пропсы: `objects`, `selectedObj`, `objectsAll`
  - Подготовка данных для маркеров: `MarkerInitializer`, `NonFlagMarkerInitializer`, `GroupCircleDisplay`
  - Кластеризация: `markerData`, `nonFlagData` (с clusteredObjects, iconsById)
  - Рендер маркеров происходит на основе этих данных.
- Лучшее место для фильтрации: перед передачей объектов в initializers или внутри вычисления displayed/selected объектов для маркеров.
- Предлагаемый подход:
  - Добавить `useMemo` для `displayedObjectsForMarkers` или аналог:
    ```js
    const objectsForMap = useMemo(() => {
      if (currentZoom > 5) return objects;
      return objects.filter(obj => {
        const ord = parseInt(obj.marker?.order) || 999;
        return ord === 1 || ord === 2;
      });
    }, [objects, currentZoom]);
    ```
  - Затем использовать `objectsForMap` (или filtered по selected + zoom) при вызове MarkerInitializer / NonFlag... и при передаче в Map для кластеризации.
  - Для selected: возможно, selected должен оставаться полным, но отображение на карте — отфильтрованным. Или фильтровать и selected тоже для консистентности (но пользователь не уточнил; вероятно, отображение на карте).
- Если фильтрация внутри кластеризации — лучше централизованно на уровне MapComponent.
- Не затрагивать таблицу объектов (только карту).
- Обновить контекст перед любым read_file/grep по MapComponent.jsx.

**Статус:** Реализовано (дополнено).

**Дополнение по новому запросу пользователя:**
- Логика фильтрации маркеров по зуму сделана более гранулированной и дифференцированной по типу маркера (flag vs non-flag).
- Для flag-маркеров (через MarkerInitializer / LabelGeneration):
  - Если currentZoom <= 5: только order <= 2 (как раньше).
  - Если 5 < currentZoom <= 7: только order <= 7.
  - Если currentZoom > 7: все flag-маркеры.
- Для non-flag маркеров (NonFlagMarkerInitializer): **всегда все** non-flag маркеры (без ограничения по зуму или order). Передаётся полный список `objects`.
- Это реализовано через два отдельных memo:
  - `flagObjectsForMap` — фильтрованный для флагов в зависимости от зума.
  - Non-flag инициализатор получает исходный `objects`.
- Обновлены передачи в JSX.
- Fallback в action-radius тоже обновлён для консистентности (хотя основной путь — через clusteredObjects из инициализаторов).
- Сохраняет предыдущее поведение для зума <=5 (order 1-2), дополняя его до 7-го масштаба.

**Код (основные места):**
```js
const flagObjectsForMap = useMemo(() => {
  if (currentZoom > 7) return objects;
  const maxOrder = currentZoom <= 5 ? 2 : 7;
  return objects.filter(obj => {
    const ord = parseInt(obj.marker?.order ?? 999, 10);
    return ord <= maxOrder;
  });
}, [objects, currentZoom]);

// в рендере:
<MarkerInitializer objects={flagObjectsForMap} ... />
<NonFlagMarkerInitializer objects={objects} ... />  // все nonflag
```

Обновление контекста выполнено. Изменения в MapComponent.jsx.

**Реализация добавления 1:2 500 000 и 1:3 000 000:**
- Обновлена константа `AVAILABLE_DENOMINATORS` (добавлены в конец списка, чтобы дропдаун и снаппинг подхватили автоматически).
- Улучшен `formatMilitaryScale`: теперь универсальный форматер с пробелами через regex (работает для всех масштабов включая новые 7-значные, исправляет проблему округления для 2.5M).
- Дропдаун в numeric теперь будет показывать новые опции.
- Снаппинг в updateScale и debug-логе тайлов использует тот же список.
- Обновлены все упоминания в project_context.md.
- Примечание: текущий код константы начинается с 25k (несоответствие с некоторыми описаниями 10k) — оставлено как есть.

**Дополнение (текущий запрос + баг-репорт):** non-flag маркеры должны быть видны **только начиная с 6-го масштаба** (currentZoom >= 6).
- При уменьшении масштаба (currentZoom < 6): non-flag объекты должны полностью пропадать с карты (даже если выбраны).
- Проблема пользователя: при зуме вниз (5,4,...) non-flag объекты продолжают отображаться, хотя должны исчезнуть. При зуме вверх (до 6) появляются корректно.
- При currentZoom >= 6: все non-flag маркеры отображаются.
- Это дополняет логику flag-маркеров.
- Причина (предположительно): фильтр только на входе в NonFlagMarkerInitializer, но:
  - nonFlagData (groupedObjects) не очищается полностью при shrink списка.
  - Рендер non-flag маркеров (включая isHidden=false, группы) и GroupCircleDisplay продолжают использовать старые данные из nonFlagData.
  - Возможно, обработка в NonFlagLabelGeneration / handleNonFlagMarkersReady не реагирует на уменьшение входного objects (только на увеличение или selected).
- План исправления:
  - Убедиться, что nonFlagObjectsForMap корректно [] при <6.
  - Принудительно очищать nonFlagData когда nonFlagObjectsForMap пуст.
  - Или добавить фильтр по зуму прямо в местах рендера non-flag маркеров (visibleNonFlags, GroupCircle и т.д.), чтобы даже если данные в nonFlagData остались, они не рендерились при низком зуме.
  - Лучше: сбрасывать nonFlagData.groupedObjects в [] когда currentZoom <6 или когда входной список пуст.
  - Также проверить action-radius nonFlagObjects.
- Обновление контекста перед чтением/правкой кода.
- При currentZoom < 5: non-flag маркеры полностью скрыты на карте (даже если выбраны).
- При currentZoom >= 5: все non-flag маркеры отображаются (в соответствии с предыдущими правилами для non-flags).
- Это дополняет предыдущую логику:
  - Для flag-маркеров: градуированная фильтрация по order ( <=2 при <=5, <=7 при <=7 ).
  - Для non-flag: нет отображения до 5, с 5+ — все.
- Реализация:
  - Добавлен `useMemo` `nonFlagObjectsForMap` после flagObjectsForMap:
    ```js
    const nonFlagObjectsForMap = useMemo(() => {
      if (currentZoom < 5) return [];
      return objects;  // все non-flag с 5+
    }, [objects, currentZoom]);
    ```
  - NonFlagMarkerInitializer теперь получает `objects={nonFlagObjectsForMap}`
  - GroupCircleDisplay (через nonFlagData) и action-radius (nonFlagObjects из nonFlagData) автоматически следуют за этим.
- Обновление контекста перед правкой кода.

**Исправление бага (не исчезали при зуме вниз):**
- Добавлен useEffect сразу после nonFlagObjectsForMap:
  ```js
  useEffect(() => {
    if (currentZoom < 6) {
      setNonFlagData({ iconsById: {}, groupedObjects: [] });
    }
  }, [currentZoom]);
  ```
  Это принудительно очищает nonFlagData при зуме <6, независимо от того, эмитит ли инициализатор clear.
- В основном рендере visibleNonFlags (nonFlagData.groupedObjects IIFE) добавлен guard:
  ```js
  if (currentZoom < 6) return null;
  ```
  (перед фильтром visibleNonFlags).
- Это гарантирует, что при уменьшении зума ниже 6 non-flag маркеры (включая групповые иконки) исчезают, даже если nonFlagData временно содержит stale данные из предыдущего зума.
- nonFlagObjectsForMap остаётся с условием <6 → [].
- Контекст обновлён. Изменения только внутри MapComponent.jsx.
