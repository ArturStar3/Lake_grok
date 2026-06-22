# UI Design Plan — InfoLake × Figma GIS System

**Источник макета:** [Ui4Free.com GIS System (Community)](https://www.figma.com/design/Yza6E2Y6gwOz54LOyNO0jY/Ui4Free.com-GIS-System--Community-?node-id=0-1)  
**Главный экран (node `2:100`):** 1920×1080, map-first layout  
**Дата:** 22.06.2026

---

## 1. Анализ макета Figma

### Композиция (отличие от текущего InfoLake)

| Figma GIS System | Текущий InfoLake |
|------------------|------------------|
| Карта на весь экран | Grid 2/3 данные + 1/3 карта |
| Плавающие панели (glass cards) | Жёсткие белые блоки с radius 30px |
| Левая вертикальная навигация (pill) | Вкладки внутри левой колонки |
| Правая аналитическая панель 460px | `Features` под картой |
| Popup на карте при выборе региона | `CountryModal` отдельно |
| Верхняя панель иконок-инструментов | Кнопка «Инструменты» в заголовке |

**Целевая композиция InfoLake:** сохранить map-first из Figma, перенести таблицы/фильтры в правую плавающую панель, инструменты — в верхний toolbar.

### Дизайн-токены (из `get_design_context`, node `2:100`)

| Токен | Значение | Применение |
|-------|----------|------------|
| `primary` | `#0052B4` | логотип, заголовки, акцент |
| `text-muted` | `#646464` | подписи («system», метаданные) |
| `gradient-sidebar` | `#56BAE1` → `#629DF3` | левая навигация |
| `glass-bg` | `rgba(255,255,255,0.7)` + `backdrop-blur(5px)` | карточки, toolbar |
| `panel-bg` | `#FFFFFF` | правая панель, popup |
| `shadow-soft` | `0 0 30px rgba(0,0,0,0.1)` | плавающие элементы |
| `shadow-panel` | `0 0 15px rgba(0,0,0,0.2)` | sidebar pill |
| `radius-pill` | `50px` / `60px` | logo, nav, bottom bar |
| `radius-card` | `12–16px` | popup, chart cards |
| `font-brand` | Poppins Bold 30px | «Gis» в логотипе |
| `font-ui` | Poppins 14px | UI текст |

**Оффлайн-шрифт:** скачать Poppins (400/500/600/700) в `public/fonts/` — **не** Google Fonts CDN.

### Экраны в файле Figma

| Node | Имя | Содержание |
|------|-----|------------|
| `2:100` | 13 | Основной: карта + popup + analytics |
| `2:677` | 14 | Вариант layout |
| `2:330` | 15 | Вариант с другим состоянием панели |
| `2:485` | 16 | Доп. состояние |

---

## 2. Маппинг Figma → InfoLake

| Компонент Figma | Назначение в InfoLake |
|-----------------|----------------------|
| **Frame 25** Logo pill | `TopBar` — лого InfoLake / «ОР» |
| **Frame 27** Top icon toolbar | Map tools: слои, поиск, измерение, зоны, fullscreen |
| **Frame 19** Left nav pill | Модули: Объекты, События, Страны, Формуляр, Настройки |
| **map** full viewport | `MapComponent` + Leaflet offline tiles |
| **Frame 32** Country popup | Карточка объекта/страны на карте (статистика, actions) |
| **Group 15** Right panel | `DataPanel`: таблица объектов/событий + фильтры |
| **Charts** (3 блока) | Фаза 2: аналитика; Фаза 1: `ActionZoneFilters` / intersections |
| **Frame 16** Bottom nav | Footer: статус API, координаты, версия |
| **Tooltip** (sidebar) | Подсказки к иконкам навигации |

---

## 3. Список UI-компонентов

### Foundation (`src/components/ui/`)
- `Button` — primary / ghost / icon (круг 57×57 как в макете)
- `Card` — glass / solid
- `Badge`, `Chip`
- `Icon` — локальный SVG sprite
- `Typography`, `Label`
- `Tooltip`

### Layout (`src/components/layout/`)
- `GisShell` — fullscreen map + overlay slots
- `TopBar` — logo + `MapToolbar`
- `SideNav` — вертикальный pill (Frame 19)
- `DataPanel` — правая панель 460px, collapsible
- `BottomBar` — нижняя pill-навигация
- `GlassPanel` — обёртка с blur

### Map (`src/components/map/`)
- `MapCanvas` — Leaflet wrapper
- `MapPopupCard` — popup на карте (как Việt Nam card)
- `MapToolbar` — верхние иконки
- `MapLegend`, `MapScaleBar` (стилизовать под макет)
- `ZoneContextMenu` — уже есть, стилизовать

### Data (`src/components/data/`)
- `DataTable` — ObjectsTable / EventsTable
- `FilterBar` — FilterPanel + EventsFilterPanel
- `Tabs` — Объекты / События
- `EmptyState`, `LoadingState`, `ErrorState`

### Forms & Overlays
- `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`
- `FormField`, `Input`, `Select`, `SearchSelect`
- `Drawer` — для fullscreen sidebar

### Domain (features/)
- `features/objects/` — таблица, фильтры, модалки
- `features/events/`
- `features/formular/`
- `features/countries/`
- `features/action-zones/`

---

## 4. Структура каталогов

```
frontend/
├── public/
│   ├── fonts/poppins/          # woff2 — оффлайн
│   └── icons/gis/              # SVG из Figma (download_assets → локально)
├── src/
│   ├── styles/
│   │   ├── index.css           # @tailwind
│   │   ├── tokens.css          # CSS variables из Figma
│   │   └── leaflet-gis.css
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/             # GisShell, SideNav, DataPanel…
│   │   └── map/
│   ├── features/               # бизнес-модули
│   ├── hooks/
│   ├── api/
│   └── types/
├── tailwind.config.ts
├── tsconfig.json
└── package.json                # + tailwindcss, postcss, typescript
```

---

## 5. Оффлайн-замены

| В макете Figma | Локальная реализация |
|----------------|---------------------|
| Poppins (облако) | `public/fonts/poppins/*.woff2` |
| Figma asset URLs | `download_assets` → `public/icons/gis/` |
| Карта-растр в макете | TileServer GL `localhost:8080` (уже есть) |
| Charts | `recharts` через npm (сборка в bundle) |
| Иконки toolbar/sidebar | SVG sprite + экспорт из Figma |

---

## 6. План реализации

### Фаза 1 — Foundation (3–4 дня)
- [ ] Tailwind + TypeScript в Vite
- [ ] Токены из Figma → `tokens.css` + `tailwind.config.ts`
- [ ] Локальный Poppins
- [ ] `GisShell`, `GlassPanel`, `Button`, `Icon`, `SideNav`, `TopBar`
- [ ] Экспорт иконок из Figma в `public/icons/gis/`

### Фаза 2 — Map shell (3–4 дня)
- [ ] Перестроить `App` → map-first layout
- [ ] `MapCanvas` + стили Leaflet под GIS-шаблон
- [ ] `MapToolbar`, `MapPopupCard`
- [ ] Миграция `MapComponent` overlays без поломки логики

### Фаза 3 — Data panel (4–5 дней)
- [ ] `DataPanel` 460px справа (как Group 15)
- [ ] `DataTable` + миграция ObjectsTable / EventsTable
- [ ] `FilterBar`, вкладки Объекты/События
- [ ] Loading/error states

### Фаза 4 — Modals & forms (4–5 дней)
- [ ] Единый `Modal` в стиле glass
- [ ] AddTarget, EditTarget, Country, Event modals
- [ ] Сохранение API-контрактов

### Фаза 5 — Polish & offline QA (2 дня)
- [ ] Удаление legacy CSS
- [ ] Проверка без сети (Docker `--no-build`)
- [ ] Адаптив ≥1280px

**Оценка:** ~3 недели поэтапно, функционал не останавливается.

---

## 7. Wireframe (целевой InfoLake)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Gis Logo pill]  [○ ○ ○ ○ ○ ○]  map tools          [DataPanel ×]│
│                                                                  │
│ ┌──┐                                                             │
│ │█│  ┌─────────────────────────────────────┐  ┌──────────────┐ │
│ │█│  │                                     │  │ NATIONWIDE   │ │
│ │█│  │         LEAFLET MAP                 │  │ (Объекты)    │ │
│ │█│  │    ┌──────────────┐                 │  │ Filters      │ │
│ │█│  │    │ Popup card   │                 │  │ Table        │ │
│ │█│  │    └──────────────┘                 │  │ ...          │ │
│ └──┘  └─────────────────────────────────────┘  └──────────────┘ │
│                                                                  │
│              [ About | Data | Guide ]  coords | scale            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Следующий шаг

После подтверждения начинаем **Фазу 1**:
1. Установка Tailwind + TS
2. Токены и шрифты
3. `GisShell` + `SideNav` + `TopBar` (без ломки текущего Formular — параллельный route `/new` или feature flag)

**Подтвердите:** начинать Фазу 1 сейчас? (да/нет, приоритет: map shell или data panel первым)
