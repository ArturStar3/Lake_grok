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
