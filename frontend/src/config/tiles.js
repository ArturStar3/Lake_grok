// Конфигурация источника тайлов (TileServer GL)
// Меняйте только здесь!

import unifiedMapping from './unifiedLayerMapping.json';

// Базовый URL TileServer GL.
// По умолчанию — локальный dev-сервер: http://localhost:8080
// Можно переопределить через переменную окружения VITE_TILESERVER_URL
export const TILESERVER_BASE_URL =
  import.meta.env.VITE_TILESERVER_URL || 'http://localhost:8080';

// Векторный режим (единый стиль + клиентский рендер). VITE_MAP_VECTOR=false — откат на PNG.
export const USE_VECTOR_MAP = import.meta.env.VITE_MAP_VECTOR !== 'false';

// Единый стиль InfoLake (база + все оверлеи)
export const UNIFIED_STYLE = 'infolake-unified';
export const UNIFIED_STYLE_URL = `${TILESERVER_BASE_URL}/styles/${UNIFIED_STYLE}/style.json`;

// Legacy PNG (откат / отладка)
export const BORDERS_LABELS_STYLE = 'borders-labels';
export const TILE_RASTER_URL = `${TILESERVER_BASE_URL}/styles/${BORDERS_LABELS_STYLE}/{z}/{x}/{y}.png`;
export const BASIC_STYLE = 'basic';
export const TILE_RASTER_BASIC_URL = `${TILESERVER_BASE_URL}/styles/${BASIC_STYLE}/{z}/{x}/{y}.png`;

export const TILESERVER_TILEJSON = `${TILESERVER_BASE_URL}/data/openmaptiles.json`;
export const TILESERVER_STYLE_JSON = `${TILESERVER_BASE_URL}/styles/${BORDERS_LABELS_STYLE}/style.json`;

export const overlayTileUrl = (style) =>
  `${TILESERVER_BASE_URL}/styles/${style}/{z}/{x}/{y}.png`;

const { layerMapping } = unifiedMapping;

// Переключаемые слои-оверлеи (векторный режим: visibility в едином стиле).
export const MAP_OVERLAY_LAYERS = [
  {
    id: 'water',
    label: 'Водоёмы и реки',
    group: 'Гидрография',
    style: 'overlay-water',
    defaultOn: false,
    minZoom: 0,
    zIndex: 200,
    maplibreLayerIds: layerMapping.water || [],
  },
  {
    id: 'hydroLabels',
    label: 'Подписи гидрографии',
    group: 'Гидрография',
    style: 'overlay-hydro-labels',
    defaultOn: false,
    minZoom: 3,
    zIndex: 250,
    maplibreLayerIds: layerMapping.hydroLabels || [],
  },
  {
    id: 'railways',
    label: 'Железные дороги',
    group: 'Транспорт',
    style: 'overlay-railways',
    defaultOn: true,
    minZoom: 5,
    zIndex: 210,
    maplibreLayerIds: layerMapping.railways || [],
  },
  {
    id: 'ferry',
    label: 'Паромы и морские линии',
    group: 'Транспорт',
    style: 'overlay-ferry',
    defaultOn: false,
    minZoom: 8,
    zIndex: 220,
    maplibreLayerIds: layerMapping.ferry || [],
  },
  {
    id: 'roadLabels',
    label: 'Названия дорог и улиц',
    group: 'Транспорт',
    style: 'overlay-road-labels',
    defaultOn: false,
    minZoom: 11,
    zIndex: 260,
    maplibreLayerIds: layerMapping.roadLabels || [],
  },
  {
    id: 'aeroway',
    label: 'Аэродромы и ВПП',
    group: 'Аэродромы',
    style: 'overlay-aeroway',
    defaultOn: false,
    minZoom: 10,
    zIndex: 230,
    maplibreLayerIds: layerMapping.aeroway || [],
  },
  {
    id: 'mountainPeaks',
    label: 'Вершины и рельеф',
    group: 'Рельеф',
    style: 'overlay-mountain-peaks',
    defaultOn: false,
    minZoom: 10,
    zIndex: 280,
    maplibreLayerIds: layerMapping.mountainPeaks || [],
  },
  {
    id: 'districts',
    label: 'Районы, кварталы, острова',
    group: 'Подписи',
    style: 'overlay-districts',
    defaultOn: false,
    minZoom: 9,
    zIndex: 270,
    maplibreLayerIds: layerMapping.districts || [],
  },
  {
    id: 'houseNumbers',
    label: 'Номера домов',
    group: 'Подписи',
    style: 'overlay-house-numbers',
    defaultOn: false,
    minZoom: 17,
    zIndex: 290,
    maplibreLayerIds: layerMapping.houseNumbers || [],
  },
  {
    id: 'poiInfrastructure',
    label: 'Соц. инфраструктура (школы, больницы, полиция)',
    group: 'Точки интереса',
    style: 'overlay-poi-infrastructure',
    defaultOn: false,
    minZoom: 12,
    zIndex: 300,
    maplibreLayerIds: layerMapping.poiInfrastructure || [],
  },
  {
    id: 'poiTransport',
    label: 'Транспортные объекты (вокзалы, АЗС, порты)',
    group: 'Точки интереса',
    style: 'overlay-poi-transport',
    defaultOn: false,
    minZoom: 12,
    zIndex: 310,
    maplibreLayerIds: layerMapping.poiTransport || [],
  },
  {
    id: 'poiServices',
    label: 'Магазины, кафе, туризм',
    group: 'Точки интереса',
    style: 'overlay-poi-services',
    defaultOn: false,
    minZoom: 13,
    zIndex: 320,
    maplibreLayerIds: layerMapping.poiServices || [],
  },
];
