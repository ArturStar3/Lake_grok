import { usesDashCrossMarkers } from './actionZoneGeometry';

export { usesDashCrossMarkers };

/** Подписи типов линии зоны действия (синхронно с backend ActionLineTypes). */
export const LINE_TYPE_LABELS = {
  solid: 'Сплошная линия',
  dashed: 'Пунктирная линия',
  dash_dot: 'Тире точка',
  dash_x: 'Тире крест',
};

const DEFAULT_ZONE_COLOR = '#3388ff';
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

/** Толщина обводки окружности/полигона зоны действия (Leaflet weight). */
export const ZONE_STROKE_WEIGHT = 1.5;
export const ZONE_STROKE_HOVER_WEIGHT = 2.5;
export const ZONE_CROSS_STROKE_WEIGHT = 2;
export const ZONE_CENTER_HIGHLIGHT_WEIGHT = 1.5;
export const ZONE_CENTER_HIGHLIGHT_HOVER_WEIGHT = 2.5;

export function getZoneStrokeStyle(color, lineType) {
  return {
    color,
    weight: ZONE_STROKE_WEIGHT,
    hoverWeight: ZONE_STROKE_HOVER_WEIGHT,
    opacity: 0.65,
    hoverOpacity: 0.95,
    dashArray: getZoneDashArray(lineType),
    fillColor: color,
    fillOpacity: 0.09,
  };
}

export function getZonePolygonStrokeStyle(color, lineType) {
  return {
    ...getZoneStrokeStyle(color, lineType),
    opacity: 0.75,
    fillOpacity: 0.12,
  };
}

/** Нормализация цвета зоны для input[type=color] и API. */
export function normalizeHexColor(value, fallback = DEFAULT_ZONE_COLOR) {
  if (typeof value === 'string' && HEX_COLOR_RE.test(value)) return value;
  return fallback;
}

/**
 * Leaflet dashArray по типу линии ActionType.line_type.
 * @param {string} lineType
 * @returns {string|undefined}
 */
export function getZoneDashArray(lineType) {
  switch (lineType) {
    case 'dashed':
      return '10, 8';
    case 'dash_dot':
      return '10, 5, 2, 5';
    case 'dash_x':
      return '16, 14';
    case 'solid':
    default:
      return undefined;
  }
}

/** Цвет зоны из вложенного action_type. */
export function getActionTypeColor(actionType, fallback = DEFAULT_ZONE_COLOR) {
  return actionType?.color || fallback;
}

/** Тип линии из вложенного action_type. */
export function getActionTypeLineType(actionType) {
  return actionType?.line_type || 'solid';
}

/** Стили для CSS-превью в легенде (класс --dash_x задаёт крест в CSS). */
export function getLegendSampleStyle(color, lineType) {
  const base = {
    '--sample-color': color,
    borderColor: color,
    backgroundColor: `${color}1f`,
  };
  switch (lineType) {
    case 'dashed':
      return { ...base, borderStyle: 'dashed' };
    case 'dash_dot':
      return { ...base, borderStyle: 'dotted' };
    case 'dash_x':
      return { ...base, borderStyle: 'dashed' };
    case 'solid':
    default:
      return { ...base, borderStyle: 'solid' };
  }
}
