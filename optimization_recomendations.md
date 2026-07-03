# Рекомендации по оптимизации InfoLake

Дата последнего обновления: 22.06.2026  
Стек: Django REST · React/Vite/Leaflet · TileServer GL · Docker Compose

---

## Краткое резюме

Проект — оффлайн-картографическое приложение для объектов разведки. Основные риски: неограниченные API-ответы, тяжёлая клиентская карта (~2400 строк в `MapComponent`), повторная загрузка справочников в каждом модальном окне.

**Уже реализовано в коде** (см. раздел «Выполненные изменения»).  
**Остаётся в плане** — пагинация, кэш на backend, рефакторинг карты, индексы БД.

---

## Архитектура

```
Браузер (Formular.jsx)
    ├── GET /api/v1/targets/           → карта + таблица
    ├── GET /api/v1/targets/parent-options/  → выбор родителя (лёгкий)
    ├── GET /api/v1/events/            → события (только вкладка «События»)
    ├── GET /api/v1/countries/         → справочник (кэш 5 мин на frontend)
    └── TileServer :8080               → растровые тайлы
```

PostgreSQL на хосте (`DB_HOST: host.docker.internal`).

---

## Backend — проблемы и статус

### Критичные

| Проблема | Статус | Рекомендация |
|----------|--------|--------------|
| N+1 на `GET /targets/` | ✅ Исправлено | `prefetch_related` actions + type__countries |
| Нет пагинации | ⚠️ Открыто | `REST_FRAMEWORK` + лёгкий serializer для карты |
| `TargetViewSet.update` без транзакций | ✅ Исправлено | `transaction.atomic` + `bulk_create` |
| `FormularBulkUpdateView` N запросов | ✅ Исправлено | `in_bulk` + `bulk_create`/`bulk_update` |
| Полный `/targets/` для parent picker | ✅ Исправлено | `GET /targets/parent-options/` |

### Средние

| Проблема | Статус | Рекомендация |
|----------|--------|--------------|
| Attachments без фильтра отдают всё | ✅ Исправлено | `list` без `country`/`target` → пустой queryset |
| Невалидные `countries`/`event_types` в events | ✅ Исправлено | `qs.none()` вместо полного списка |
| Нет кэширования справочников | ⚠️ Открыто | ETag / Redis |
| `Country.iso_code` без unique/index | ⚠️ Открыто | Миграция + unique |
| `Formular` без unique (target, section) | ⚠️ Открыто | `UniqueConstraint` |
| `AllowAny` на всех write API | ⚠️ Открыто | Auth перед production |
| `DEBUG=True`, media только в DEBUG | ⚠️ Открыто | nginx для `/media/` в prod |

### Настройки

- ✅ `CONN_MAX_AGE: 60` для PostgreSQL — переиспользование соединений из Docker.

---

## Frontend — проблемы и статус

### Критичные (стабильность отображения)

| Проблема | Статус |
|----------|--------|
| Remount маркеров при фильтрации | ✅ `objectsDataKey` от `objectsAll` |
| Remount при смене только title | ✅ title убран из ключа |
| SVG «загружен» до fetch | ✅ Исправлено в MapUtils / NonFlagMarkerUtils |
| Hover карта ↔ таблица | ✅ `onMarkerHover` подключён |
| Контекстное меню перекрывающихся зон | ✅ Controlled popup, без child Popup |
| Гонки `fetchEvents` | ✅ debounce + AbortController |
| События грузятся на вкладке «Объекты» | ✅ fetch только при `activeTab === "events"` |

### Производительность API

| Проблема | Статус |
|----------|--------|
| Справочники в каждом модальном окне | ✅ `useReferenceData.js` (кэш 5 мин) |
| EditTargetModal 7+ запросов | ✅ Кэш справочников + parent-options |
| AddTargetModal дублирует справочники | ✅ `useTargetFormData` + `parentOptions` |
| Mount Formular без abort | ✅ AbortController на начальной загрузке |

### Открытые задачи

| Проблема | Файл | Рекомендация |
|----------|------|--------------|
| `MapComponent` монолит ~2400 строк | MapComponent.jsx | Вынести зоны, sidebar, handlers |
| Зоны действия — inline IIFE каждый render | MapComponent.jsx ~1920 | `useMemo` для `currentVisibleZones` |
| `FormularModal` — 3 запроса | FormularModal.jsx | Объединить API или передать title |
| `AddEventModal` дублирует countries | AddEventModal.jsx | props из Formular |
| `CountryModal` — GET всех стран | CountryModal.jsx | lookup по iso или из кэша |
| Batch «выбрать все» в таблице | ObjectsTable.jsx | один `setSelectedObj` |
| Дублирование measure state fullscreen | MapComponent.jsx | lift state в Formular |
| `clusterKey` + полный `svgCache` | MapUtils.jsx | зависимость от `pathsKey` |

---

## TileServer / Docker

| Проблема | Статус | Рекомендация |
|----------|--------|--------------|
| Много PNG-стилей перегружают TileServer | ✅ Исправлено | единый векторный стиль `infolake-unified` + MapLibre на клиенте |
| Нет healthcheck | ✅ Исправлено | `healthcheck` в docker-compose |
| Нет лимита памяти tileserver | ✅ Исправлено | `mem_limit: 4g`, `cpus: 2` |
| Нет fallback UI | ✅ Исправлено | баннер ошибки векторной карты; `VITE_MAP_VECTOR=false` для PNG |
| `CHOKIDAR_USEPOLLING` в dev | ⚠️ Открыто | не использовать в production-сборке |

---

## Выполненные изменения (хронология)

### Backend
- `api/views.py`: prefetch targets; `parent-options`; atomic update + bulk actions; bulk formular; attachment guards; event filter safety
- `api/serializers.py`: `TargetParentPickerSerializer`; bulk create actions
- `infolake/settings.py`: `CONN_MAX_AGE`

### Frontend
- `hooks/useReferenceData.js` — модульный кэш справочников + batch SVG
- `hooks/useTargetFormData.js` — кэш, abort, parent-options
- `Formular.jsx` — abort mount, lazy events, `selectedSet`, parentOptions в модалки
- `EditTargetModal.jsx` — кэш справочников, stale guard, parent-options
- `MapComponent.jsx` — objectsDataKey, зоны, hover, TileLayer order, GroupCircle zoom/pan
- `MapUtils.jsx` / `NonFlagMarkerUtils.jsx` — SVG paths, shared canvas, clear markers

---

## Приоритетный план (оставшееся)

1. **Высокий:** пагинация событий; лёгкий `TargetMapSerializer` (без полного nested graph на list).
2. **Высокий:** HTTP-кэш / Redis для countries, markers, types.
3. **Средний:** `useMemo` для зон действия; вынести nested handlers из MapComponent.
4. **Средний:** DB constraints + индексы (`iso_code`, `Event.title` trigram).
5. **Низкий:** healthcheck tileserver; nginx static prod frontend.

---

## Метрики «до / после»

| Метрика | До | После |
|---------|-----|-------|
| SQL на 1000 targets | ~4000 | ~10–15 |
| Запросов при открытии EditTargetModal | 7+ полных | 3–4 (+ кэш справочников) |
| Справочники при 2-м модальном окне | 4 GET | 0 (кэш 5 мин) |
| События на вкладке «Объекты» | каждый mount | не грузятся |
| Remount маркеров при фильтре | да | нет |
| Parent picker payload | полный TargetSerializer × N | id/title/label |

---

## Чеклист проверки

1. `docker compose up -d --no-build`
2. Загрузка карты с 500+ объектов — без зависания >5 с
3. Фильтр страны — маркеры не мигают
4. Вкладка «События» — запросы только после переключения
5. Дважды открыть AddTargetModal — второй раз без задержки справочников
6. EditTargetModal — быстрое переключение targetId не показывает чужие данные
7. Перекрывающиеся зоны — контекстное меню + popup после выбора
8. `PUT /targets/{id}/` — actions сохраняются атомарно
