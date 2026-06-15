# project_context.md

**Проект:** infolake / lake_grok  
**Тип:** Веб-приложение электронной разведывательной сводки (карта + формуляры объектов + события).  
**Стек:** Django 6.0 + DRF + PostgreSQL (backend) | Vite + React 18 + Leaflet + axios (frontend)  
**Текущая ветка:** develop_tailserver (TileServer GL интеграция)  
**Дата анализа:** 2026  
**Дата последнего обновления контекста:** 2026-06-11 (Docker backend/frontend, TileServer во фронте, seed_test_targets, .gitignore xlsx, fix non-flag icon height)

---

## Инструкция для агентов (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ)

**Правило работы с этим файлом (высший приоритет):**

- **Теперь используй ТОЛЬКО `project_context.md`** для всей дальнейшей работы по проекту.
- Если информации недостаточно — **сначала обнови этот файл** (добавь недостающие разделы, детали, связи, эндпоинты, модели, бизнес-логику и т.д.), **а не читай весь проект** заново.
- Запрещено использовать инструменты для чтения/поиска исходного кода (list_dir, read_file, grep и т.п. по файлам проекта), пока не будет обновлён данный контекст.
- После обновления контекста продолжай работу исключительно на его основе.

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

### 3.2 Проблемы отображения сгруппированных non-flag маркеров (на момент 2026) + Целевые требования

**Зафиксированные замечания:**
- При наведении на маркер группировки появляются индивидуальные маркеры объектов группы по окружности.
- Эти маркеры слишком далеко разнесены от маркера группировки.
- Создаётся впечатление, что маркер группировки **не является центром** окружности, по которой располагаются сгруппированные объекты.
- Позиционирование групповой иконки и позиционирование элементов круга при hover рассинхронизированы.

**Требования к исправлению (обязательны к реализации):**

1. **Иконка группировки должна располагаться на позиции первого объекта из данной группы.**
   - `mainObj = cluster[0]` (или первый после сортировки) определяет координаты (lat/lng), на которых будет стоять групповая иконка.
   - Все объекты группы логически привязаны к этой позиции.

2. **При наведении указателя мыши на маркер группировки маркеры сгруппированных объектов должны отобразиться вокруг маркера группировки, и центром данной окружности должен быть маркер группировки.**
   - Круг (или размещение индивидуальных иконок) должен быть строго центрирован на экранных координатах групповой иконки.
   - Радиус должен быть таким, чтобы маркеры группы визуально были "вокруг" групповой иконки, а не далеко от неё (текущее значение radius=80 в `getGroupCirclePositions` даёт слишком большой разброс).
   - Позиционирование элементов круга должно учитывать реальное положение групповой иконки на экране (Leaflet layer point или DOM-позиция).

3. **Функционал взаимодействия с маркерами должен сохраниться.**
   - При отображении маркеров группы в круге должны работать все обычные события: hover, click (выбор/деселект), всплывающие подсказки, обновление selected/hovered состояний в Formular.
   - Скрытые объекты (`isHidden`) при необходимости должны участвовать во взаимодействии (или их иконки в круге должны эмулировать поведение обычных маркеров).
   - После ухода мыши с круга/групповой иконки состояние должно корректно возвращаться (обычные non-flag маркеры или группировка).

4. **Проанализировать возможность оптимизации функционала по работе non-flag маркеров.**
   - Текущая реализация имеет значительное дублирование (отдельный компонент NonFlagLabelGeneration почти зеркалит LabelGeneration для флагов).
   - Много тяжёлых пересчётов иконок (L.DivIcon создаются заново при каждом изменении clusterKey).
   - Загрузка SVG + обогащение происходит часто.
   - Ключи мемоизации сложные и могут вызывать лишние ре-рендеры.
   - Кластеризация и генерация иконок для non-flag происходят отдельно от основного потока карты.

**Целевое поведение после правок:**
- Групповая иконка всегда стоит точно на координатах первого объекта кластера.
- При hover на групповой иконке — вокруг неё (с центром в точке групповой иконки) появляются уменьшенные/обычные иконки всех членов группы по компактной окружности.
- Клик по элементам в круге работает как по обычным маркерам (выбор объекта).
- При снятии hover — круг исчезает, остаётся только групповая иконка.
- Производительность non-flag маркеров улучшена (меньше пересозданий, меньше дублирования кода, разумное кэширование).

### 3.3 Обновлённый алгоритм группировки и отображения non-flag маркеров (соответствует требованиям 1-3)

Целевой алгоритм (заменяет/дополняет предыдущее описание в 3.1):

1. **Фильтрация и группировка по стране** — без изменений (только выбранные non-flag, группировка по `country.title`).

2. **Географическая кластеризация** — используется общая `createClusters` (порог ~37.8 px). 
   - В кластере первый объект (`cluster[0]`) после прохода `createClusters` считается **опорным** (его lat/lng будет позицией групповой иконки).

3. **Решение о группировке (требование 1)**:
   - Если все объекты кластера выбраны:
     - Создаём групповую запись с `isGroupIcon: true`, `groupObjects: cluster`, `groupId`.
     - **Важно**: `lat`/`lng` групповой иконки = `lat`/`lng` первого объекта (`cluster[0]`). Никаких смещений.
     - Остальные объекты помечаются `isHidden: true` + хранят `groupObjects` и `groupId`.
   - Если выбраны не все — показываем все объекты индивидуально (как раньше).

4. **Позиционирование иконок на карте**:
   - Групповая иконка (`isGroupIcon`) рендерится Leaflet'ом на координатах первого объекта группы (стандартный механизм `L.DivIcon` + координаты объекта).
   - Обычные non-flag иконки — на своих координатах.
   - Скрытые объекты (`isHidden`) **не рендерятся** как отдельные маркеры на карте.

5. **Отображение круга при hover (требование 2 — критично)**:
   - При наведении на групповую иконку (или на область группы) в MapComponent (или в специальном оверлее) вызывается логика отображения членов группы.
   - Для позиционирования используется **экранная позиция** групповой иконки как центр (получается через `map.latLngToLayerPoint({lat: groupLat, lng: groupLng})` или через DOM-rect иконки).
   - `getGroupCirclePositions` должна принимать центр и радиус в пикселях. Рекомендуемый компактный радиус: 28–45 px (в зависимости от размера иконок), вместо жёсткого 80.
   - Каждый член группы получает относительные `offsetX` / `offsetY` относительно центра групповой иконки.
   - Индивидуальные иконки (или временные маркеры) рендерятся в этих позициях **поверх карты** (position: absolute относительно контейнера карты или через Leaflet overlayPane с правильным transform).
   - Центр окружности = точная позиция групповой иконки.

6. **Взаимодействие (требование 3)**:
   - Иконки в круге должны иметь те же data-атрибуты (`data-id`), классы и обработчики, что и обычные non-flag маркеры.
   - События (onClick, onMouseEnter и т.д.) пробрасываются в общий обработчик выбора/ховера объектов (как в Formular.jsx).
   - При клике по иконке в круге — объект выбирается/снимается выбор, состояние `selectedIds` обновляется, что может привести к распаду группы (если выбор стал неполным).
   - Hover на отдельный маркер в круге должен подсвечивать соответствующий объект в таблице и на карте.
   - При уходе мыши с групповой иконки + круга круг должен скрываться (с debounce или через onMouseLeave на контейнер).

7. **Управление состоянием hover-группы**:
   - Рекомендуется хранить `hoveredGroupId` (или `activeGroupId`) в состоянии Formular или в MapComponent.
   - Когда `hoveredGroupId` совпадает с `groupId` — рендерить круг с `groupObjects` вокруг позиции этой группы.
   - При потере ховера — очищать.

**Изменения, которые потребуются в коде:**
- `processNonFlagClustering`: убедиться, что групповой объект получает точные координаты `cluster[0]`, и все `groupObjects` хранят исходные данные.
- `getGroupCirclePositions`: сделать более гибкой — принимать центр (в пикселях) и меньший радиус по умолчанию. Возможно, переименовать/добавить `getGroupCircleOffsets(centerPixel, groupObjects, radius)`.
- `NonFlagMarkerUtils.jsx`: возможно, упростить генерацию иконок для скрытых объектов (они нужны только для круга).
- **Главное место правок**: компонент, отвечающий за рендер карты и hover-оверлей (скорее всего `MapComponent.jsx` или его дочерние компоненты). Там должна быть логика:
  - Отслеживание mouseover/mouseleave на групповых иконках (через event delegation или ref).
  - Вычисление экранной позиции групповой иконки.
  - Рендер временных иконок членов группы в абсолютных позициях относительно карты с центром в этой точке.
- Сохранение всех существующих обработчиков выбора, ховера и таблиц.

### 3.4 Анализ возможностей оптимизации функционала non-flag маркеров

Текущие проблемы производительности и поддерживаемости (по состоянию на момент актуализации):

**Выявленные недостатки:**
- **Дублирование кода**: `NonFlagLabelGeneration` и `LabelGeneration` (для флагов) очень похожи (загрузка SVG, кэши, useEffect по pathsKey/clusterKey, генерация L.DivIcon, обогащение). Почти зеркальный код.
- **Частое пересоздание иконок**: `iconsById` useMemo зависит от `groupedObjects` + `svgCache`. Каждый зум/изменение выбора → полная пересборка всех DivIcon.
- **Сложные ключи мемоизации**: `clusterKey` включает zoom + map size + ids. Легко приводит к лишним эффектам.
- **Загрузка SVG на каждый релевантный change**: Даже если пути не менялись, есть overhead. Нет глобального кэша SVG на уровне приложения.
- **Отдельный проход кластеризации + отдельный компонент**: non-flag обрабатываются в параллельном потоке к флагам. Два компонента монтируются в MapComponent.
- **Генерация иконок для скрытых объектов**: в коде есть три отдельных блока forEach для создания иконок (обычные, groupIcon, скрытые + главные для круга). Дублирование HTML-генерации.
- **Нет разделения ответственности**: кластеризация, загрузка ресурсов, генерация иконок, hover-логика — всё смешано.
- **Рендер круга**: если сейчас реализован через постоянные маркеры или тяжёлые пересчёты позиций — это дополнительная нагрузка.
- **useMapEvents** в обоих компонентах — может вызывать лишние подписки.

**Возможные оптимизации (приоритизировать при исправлении):**

**Высокий приоритет (рекомендуется реализовать вместе с исправлением hover):**
- Выделить общий хук или утилиту `useMarkerIconGeneration` (или `useSvgIconCache`) для загрузки/кэширования SVG и создания DivIcon. Использовать и для флагов, и для non-flag.
- Сделать `getGroupCirclePositions` / новую функцию чистой утилитой, работающей только с пикселями и возвращающей оффсеты.
- Уменьшить радиус по умолчанию до 32-40px и сделать его параметром.
- Добавить `hoveredGroupId` состояние на уровне Formular (централизованно) и передавать вниз. Избегать локального состояния в NonFlag-компоненте для hover.
- Кэшировать готовые иконки не только по id, а по "render key" (тип + размер + цвет + groupSize). Использовать Map или WeakMap.
- Для круга при hover использовать **лёгкий overlay** (один div-контейнер с position absolute поверх Leaflet, в котором позиционируются маленькие иконки с transform). Это дешевле, чем создавать новые L.Marker/L.DivIcon каждый hover.
- Избегать пересчёта кластеризации non-flag при каждом зуме, если геометрия не поменялась (можно кэшировать clusters по зуму только когда меняются selected).

**Средний приоритет:**
- Объединить или сильно упростить NonFlagLabelGeneration и основной LabelGeneration (или вынести общую логику в отдельный модуль).
- Использовать `React.memo` на компонентах генерации иконок.
- Глобальный SVG cache на уровне App (не пересоздавать Map в каждом компоненте).
- При генерации иконок для круга использовать уменьшенную версию (меньший scale или упрощённый SVG).
- Ленивая загрузка SVG только для видимых non-flag (сейчас грузятся все пути из selected non-flag).

**Низкий приоритет / на будущее:**
- Перейти на canvas/WebGL слой для большого количества non-flag (если объектов станет >500-1000).
- Использовать библиотеку для виртуализации маркеров (react-leaflet-cluster уже используется для флагов).
- Вынести hover-круг в отдельный выделенный компонент `GroupHoverCircle.jsx` с чётким API.

**Рекомендация по подходу к рефакторингу:**
1. Сначала исправить позиционирование и центрирование круга (требования 1-3) минимальными правками.
2. Зафиксировать поведение в обновлённом разделе контекста.
3. Затем провести оптимизации (выделение общих утилит, улучшение hover-рендера), обновляя контекст.
4. После правок обязательно протестировать:
   - Группа из 2, 3, 5, 8 объектов.
   - Разные зумы.
   - Выбор/отмена выбора через круг.
   - Пересечение с action-radius, измерениями и другими инструментами.
   - Корректное снятие hover.

При внесении изменений — обновлять этот файл (особенно 3.2–3.4) актуальными деталями реализации.

### 3.5 Новый баг-репорт (после предыдущих правок) + требование по отладке

**Симптомы (со слов пользователя):**
- Иконка группировки отображается корректно.
- При наведении на маркер группировки объекты группы "раскрываются" (появляются индивидуальные маркеры по окружности).
- Эти маркеры располагаются **гораздо выше** маркера группировки.
- Создаётся впечатление, что к позиции применён **вертикальный офсет по высоте** (offset по Y, как у флагов).
- Смещение разное для разных групп.
- Для non-flag маркеров **вертикального смещения (offsetY / translateY) быть не должно** вообще (в отличие от флагов, где используется calculateClusterOffsets + applyClusterOffsets + --marker-offset-y).

**Гипотезы для проверки:**
- В non-flag пути (NonFlagMarkerUtils + GroupCircleDisplay) где-то просачивается offsetY или transform: translateY из флаговой логики.
- При вычислении центра для круга в GroupCircleDisplay используется lat/lng, но визуальный центр иконки группы (из-за iconAnchor, размера 35px, или внутреннего содержимого SVG) не совпадает с геометрическим.
- При создании временных маркеров круга (`<Marker position={[computedLat, computedLng]}>`) их иконки (взятые из iconsById или fallback) имеют разную высоту/anchor, из-за чего вся "розетка" выглядит сдвинутой вверх.
- В процессе фильтрации/подготовки `groupedObjects` или в `visibleNonFlags` в MapComponent на объекты non-flag случайно попадают поля `offsetY`, `isInCluster`, `_computedIconHeight` из флаговой ветки.
- CSS-классы `.non-flag-marker` / `.group-marker` / `.non-flag-div-icon` имеют неявные стили с вертикальным сдвигом.
- В GroupCircleDisplay при конвертации layerPoint → latLng накопленная ошибка или неправильный выбор точки отсчёта даёт систематический сдвиг вверх (разный в зависимости от маркеров в группе).

**Результаты инспекции кода + анализ предоставленных JSON-логов (из debug output):**

Из логов (zoom=5, группа из 2 объектов):
- Групповая иконка: backend + rendered lat/lng = 36.505954, 84.13007 ; layer y = 714
- Члены круга (после расчёта): их anchor layer y тоже = 714 (отличие только по x на ~±32px, как и circleX).
- В `fullObject` членов круга сохранены `originalLat/originalLng` группы + `circleX/circleY`.
- `offsetY` полностью отсутствует в non-flag объектах (как и ожидалось).
- Однако визуально пользователь видит групповую иконку **значительно ниже** раскрытых маркеров.

**Выявленный дефект:**
1. **Hover scale на группе (главная причина "офсета высоты")**: `.group-marker:hover { transform: scale(1.15) }` применялось при показе круга (на hover). Масштабирование внутреннего div внутри Leaflet icon контейнера смещало визуальный центр красной иконки группы относительно её `iconAnchor`. Поскольку круг рассчитывается по lat/lng (якорю) *до* или во время hover, группа "уезжала" вниз относительно позиций круга. Разные группы/зумы усиливали эффект.
2. **Разный физический размер иконок**: Группа всегда 35×35 (фиксировано). Члены круга используют полные иконки из `iconsById` (в данном случае 50×50 по _computedIconHeight + aspect). Даже при одинаковом layer anchor y визуальные "тела" иконок располагаются по-разному относительно центра (SVG контент + размер контейнера).
3. **Отсутствие компенсации в расчёте круга**: `getGroupCirclePositions` + layerPoint + y=0 давал геометрически правильные якоря, но не учитывал разницу в "посадке" иконок (группа vs non-flag). При 2 объектах (горизонтальная линия) это особенно заметно как "выше/ниже".
4. Нет `offsetY` в non-flag пути — подтверждено логами. Проблема чисто визуальная (якоря vs rendered content + hover side-effect).

**Принятые исправления (включая анализ этого лога):**
- Убрали `transform: scale(1.15)` из `.group-marker:hover` в CSS.
- Добавили `circleVerticalBias = +8` в GroupCircleDisplay.
- **Критично для этого бага**: удалили `position: relative !important;` из правил `.leaflet-marker-icon.group-div-icon`, `.leaflet-marker-icon.circle-item-div-icon` (и закомментировали в non-flag для консистентности). 

  **Корневая причина большого сдвига вниз (36.5 → ~32°)**: 
  Эти правила force position:relative на сам элемент `.leaflet-marker-icon`, который Leaflet позиционирует через `position:absolute` + `top/left` или (чаще) `transform: translate3d(...)` внутри `.leaflet-marker-pane`. 
  Переопределение position ломало расчёт размещения иконки относительно её якоря. В результате весь графический контент (красная пилюля группы) отрисовывался со значительным смещением вниз по экрану, хотя данные Marker'а (`rendered.latLng`, layerPoint) оставались правильными. Именно поэтому при клике на визуальную группу лог показывал верные 36.505954, а на карте она "висела" на координатах, соответствующих гораздо более южному положению.

- Временный debug-логгер полностью удалён (по просьбе пользователя).
- Радиус круга увеличен до 40.
- Ранее: фиксация lat/lng группы на cluster[0], выбор isGroupIcon для центра круга, vertical bias +8, удаление position:relative на иконках, убирание scale на hover группы.

Теперь Leaflet полностью контролирует размещение иконок группы и круга по переданным lat/lng. Визуальное положение группы и раскрывающихся маркеров в круге должно быть корректным и центрированным.

Рекомендация на будущее: для круга генерировать маленькие унифицированные иконки (фиксированный ~26-30px) вместо полных 50px — это сильно улучшит визуальное центрирование независимо от оригинального размера/аспекта маркера.

---

### 3.6 Реализованные исправления (текущая сессия)

**Исправления по требованиям 1-3:**
- В `markerClusteringUtils.js` (`processNonFlagClustering`): при создании групповой записи и скрытых членов группы теперь явно фиксируются `lat`/`lng` от `cluster[0]` (первого объекта). Все объекты группы имеют идентичные координаты. Это гарантирует, что иконка группировки всегда стоит на позиции первого объекта группы.
- В `MapComponent.jsx` (`GroupCircleDisplay`):
  - Для вычисления центра окружности теперь приоритетно берётся запись с `isGroupIcon` (а не случайный член группы по `groupId`).
  - Радиус круга радикально уменьшен: базовый `32px` (в утилите `getGroupCirclePositions` дефолт тоже `32`, раньше было `80` + большая добавка).
  - Лёгкая корректировка радиуса под масштаб маркера (в пределах разумного).
  - Расчёт позиций переписан на использование общей утилиты `getGroupCirclePositions` (меньше дублирования).
  - Центр окружности = `lat/lng` групповой иконки → преобразование layerPoint даёт точное размещение "вокруг" маркера группировки.
- События на маркерах круга (mouseover, mouseout, click → `onMarkerHover` / `onMarkerClick` + закрытие круга) оставлены без изменений — взаимодействие полностью сохранено (требование 3). Клик по члену группы выбирает объект и обычно закрывает круг.

**Оптимизации (требование 4) — применённые:**
- `getGroupCirclePositions` теперь имеет осмысленный компактный дефолт и документацию.
- `GroupCircleDisplay` обёрнут в `React.memo` (избегает лишних ре-рендеров при прочих обновлениях карты).
- Положение расчёта круга теперь опирается на shared utility вместо полного дублирования полярной математики.
- Централизованная фиксация координат группы в утилите кластеризации (одно место правды).

**Что осталось для дальнейшей оптимизации (см. 3.4):**
- Дублирование генерации иконок в `NonFlagMarkerUtils.jsx` (три похожих блока).
- Общий хук для SVG + DivIcon между флагами и non-flag.
- Возможно, лёгкий pixel-overlay для hover-круга вместо создания временных `<Marker>` (дешевле при очень больших группах).
- Дальнейшее улучшение ключей и мемоизации в NonFlagLabelGeneration.

После этих правок обновлён разделы 3.2–3.5 контекста. Рекомендуется протестировать визуально на реальных данных (разные размеры групп non-flag маркеров, разные зумы).
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
