// Конфигурация источника тайлов (TileServer GL)
// Меняйте только здесь!

// Базовый URL TileServer GL.
// По умолчанию — локальный dev-сервер: http://localhost:8080
// Можно переопределить через переменную окружения VITE_TILESERVER_URL
export const TILESERVER_BASE_URL =
  import.meta.env.VITE_TILESERVER_URL || 'http://localhost:8080';

// Основной стиль с границами и подписями (рекомендуется)
export const BORDERS_LABELS_STYLE = 'borders-labels';

// Растровые тайлы в стиле borders-labels (подходит для Leaflet TileLayer)
export const TILE_RASTER_URL = `${TILESERVER_BASE_URL}/styles/${BORDERS_LABELS_STYLE}/{z}/{x}/{y}.png`;

// Альтернативный упрощённый стиль (при необходимости)
export const BASIC_STYLE = 'basic';
export const TILE_RASTER_BASIC_URL = `${TILESERVER_BASE_URL}/styles/${BASIC_STYLE}/{z}/{x}/{y}.png`;

// Полезные ссылки (для отладки / будущего перехода на векторные тайлы)
export const TILESERVER_TILEJSON = `${TILESERVER_BASE_URL}/data/openmaptiles.json`;
export const TILESERVER_STYLE_JSON = `${TILESERVER_BASE_URL}/styles/${BORDERS_LABELS_STYLE}/style.json`;

// Строит URL-шаблон растровых тайлов для произвольного стиля TileServer.
export const overlayTileUrl = (style) =>
  `${TILESERVER_BASE_URL}/styles/${style}/{z}/{x}/{y}.png`;

// Переключаемые слои-оверлеи поверх базовой карты.
// Каждый слой — отдельный прозрачный стиль в TileServer (см. tileserver/styles/overlay-*.json).
// zIndex держим ниже слоёв стран (300), зон действия (400) и маркеров (600).
export const MAP_OVERLAY_LAYERS = [
  {
    id: 'water',
    label: 'Водоёмы и реки',
    group: 'Гидрография',
    style: 'overlay-water',
    defaultOn: false,
    zIndex: 200,
  },
  {
    id: 'hydroLabels',
    label: 'Подписи гидрографии',
    group: 'Гидрография',
    style: 'overlay-hydro-labels',
    defaultOn: false,
    zIndex: 250,
  },
  {
    id: 'railways',
    label: 'Железные дороги',
    group: 'Транспорт',
    style: 'overlay-railways',
    defaultOn: true,
    zIndex: 210,
  },
  {
    id: 'ferry',
    label: 'Паромы и морские линии',
    group: 'Транспорт',
    style: 'overlay-ferry',
    defaultOn: false,
    zIndex: 220,
  },
  {
    id: 'roadLabels',
    label: 'Названия дорог и улиц',
    group: 'Транспорт',
    style: 'overlay-road-labels',
    defaultOn: false,
    zIndex: 260,
  },
  {
    id: 'aeroway',
    label: 'Аэродромы и ВПП',
    group: 'Аэродромы',
    style: 'overlay-aeroway',
    defaultOn: false,
    zIndex: 230,
  },
  {
    id: 'mountainPeaks',
    label: 'Вершины и рельеф',
    group: 'Рельеф',
    style: 'overlay-mountain-peaks',
    defaultOn: false,
    zIndex: 280,
  },
  {
    id: 'districts',
    label: 'Районы, кварталы, острова',
    group: 'Подписи',
    style: 'overlay-districts',
    defaultOn: false,
    zIndex: 270,
  },
  {
    id: 'houseNumbers',
    label: 'Номера домов',
    group: 'Подписи',
    style: 'overlay-house-numbers',
    defaultOn: false,
    zIndex: 290,
  },
  {
    id: 'poiInfrastructure',
    label: 'Соц. инфраструктура (школы, больницы, полиция)',
    group: 'Точки интереса',
    style: 'overlay-poi-infrastructure',
    defaultOn: false,
    zIndex: 300,
  },
  {
    id: 'poiTransport',
    label: 'Транспортные объекты (вокзалы, АЗС, порты)',
    group: 'Точки интереса',
    style: 'overlay-poi-transport',
    defaultOn: false,
    zIndex: 310,
  },
  {
    id: 'poiServices',
    label: 'Магазины, кафе, туризм',
    group: 'Точки интереса',
    style: 'overlay-poi-services',
    defaultOn: false,
    zIndex: 320,
  },
];
