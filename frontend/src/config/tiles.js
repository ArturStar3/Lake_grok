// Конфигурация источника тайлов (TileServer GL)
// Меняйте только здесь!

import unifiedMapping from './unifiedLayerMapping.json';

/** Абсолютный базовый URL TileServer (MapLibre требует абсолютные URL). */
export function getTileserverBaseUrl() {
  const fromEnv = import.meta.env.VITE_TILESERVER_URL;
  const raw = (fromEnv !== undefined && fromEnv !== '' ? fromEnv : '/tiles').replace(/\/$/, '');

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  return `http://localhost${raw.startsWith('/') ? raw : `/${raw}`}`;
}

/** Префикс пути для Leaflet TileLayer (same-origin relative). */
export function getTilesPathPrefix() {
  const fromEnv = import.meta.env.VITE_TILESERVER_URL;
  if (fromEnv && (fromEnv.startsWith('http://') || fromEnv.startsWith('https://'))) {
    return fromEnv.replace(/\/$/, '');
  }
  const path = (fromEnv !== undefined && fromEnv !== '' ? fromEnv : '/tiles').replace(/\/$/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

/** Origin приложения (без /tiles). */
function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  try {
    return new URL(getTileserverBaseUrl()).origin;
  } catch {
    return 'http://localhost:8080';
  }
}

/** new URL() кодирует {z}/{fontstack}/{range} → %7B…%7D; MapLibre требует сырые токены. */
function preserveMaplibreTokens(path) {
  return path.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
}

/** Нормализует URL тайлов на текущий origin (localhost vs LAN IP, порт nginx). */
export function normalizeTileserverUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const origin = getAppOrigin();
  const prefix = getTilesPathPrefix();
  const base = getTileserverBaseUrl();

  let pathname = url;
  let search = '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      pathname = preserveMaplibreTokens(parsed.pathname);
      search = preserveMaplibreTokens(parsed.search);
    } catch {
      return url;
    }
  } else {
    const queryIndex = url.indexOf('?');
    const pathPart = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
    search = queryIndex >= 0 ? url.slice(queryIndex) : '';
    pathname = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;

    // Сырой шаблон глифов из style.json без префикса fonts/
    if (pathname === '/{fontstack}/{range}.pbf' || pathname.endsWith('/{fontstack}/{range}.pbf')) {
      if (!pathname.includes('/fonts/')) {
        pathname = `/fonts/{fontstack}/{range}.pbf`;
      }
    }
  }

  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
    return `${origin}${pathname}${search}`;
  }

  return `${base}${pathname}${search}`;
}

export function createMaplibreTransformRequest() {
  return (url, resourceType) => ({
    url: normalizeTileserverUrl(url),
    ...(resourceType === 'Tile' ? { credentials: 'same-origin' } : {}),
  });
}

export async function fetchUnifiedMapStyle() {
  const styleUrl = `${getTileserverBaseUrl()}/styles/${UNIFIED_STYLE}/style.json`;
  const res = await fetch(styleUrl);
  if (!res.ok) {
    throw new Error(`style.json HTTP ${res.status} (${styleUrl})`);
  }

  const style = await res.json();

  if (style.sprite) style.sprite = normalizeTileserverUrl(style.sprite);
  if (style.glyphs) style.glyphs = normalizeTileserverUrl(style.glyphs);

  if (style.sources) {
    Object.values(style.sources).forEach((source) => {
      if (source.url) source.url = normalizeTileserverUrl(source.url);
      if (source.tiles) source.tiles = source.tiles.map(normalizeTileserverUrl);
    });
  }

  return style;
}

// Базовый URL TileServer GL (абсолютный, вычисляется при импорте в браузере).
export const TILESERVER_BASE_URL = getTileserverBaseUrl();

// Векторный режим (единый стиль + клиентский рендер). VITE_MAP_VECTOR=false — откат на PNG.
export const USE_VECTOR_MAP = import.meta.env.VITE_MAP_VECTOR !== 'false';

// Единый стиль InfoLake (база + все оверлеи)
export const UNIFIED_STYLE = 'infolake-unified';
export const UNIFIED_STYLE_URL = `${TILESERVER_BASE_URL}/styles/${UNIFIED_STYLE}/style.json`;

// Legacy PNG (откат / отладка)
export const BORDERS_LABELS_STYLE = 'borders-labels';
export const TILE_RASTER_URL = `${getTilesPathPrefix()}/styles/${BORDERS_LABELS_STYLE}/{z}/{x}/{y}.png`;
export const BASIC_STYLE = 'basic';
export const TILE_RASTER_BASIC_URL = `${getTilesPathPrefix()}/styles/${BASIC_STYLE}/{z}/{x}/{y}.png`;

export const TILESERVER_TILEJSON = `${getTileserverBaseUrl()}/data/openmaptiles.json`;
export const TILESERVER_STYLE_JSON = `${getTileserverBaseUrl()}/styles/${BORDERS_LABELS_STYLE}/style.json`;

export const overlayTileUrl = (style) =>
  `${getTilesPathPrefix()}/styles/${style}/{z}/{x}/{y}.png`;

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
    id: 'roads',
    label: 'Дороги и автомагистрали',
    group: 'Транспорт',
    style: 'overlay-roads',
    defaultOn: true,
    minZoom: 0,
    zIndex: 205,
    maplibreLayerIds: layerMapping.roads || [],
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
    id: 'countryBordersBold',
    label: 'Границы государств (акцент)',
    group: 'Границы',
    style: 'overlay-admin-boundary',
    defaultOn: false,
    minZoom: 1,
    zIndex: 195,
    maplibreLayerIds: layerMapping.countryBordersBold || [],
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
