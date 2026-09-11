import { ZONE_LEAF_MANUAL } from './inundationZone';
import { normalizeScanner, scannerDurationMs } from './demoScanner';

export const DEMO_STEP_MIN_DURATION_MS = 500;
export const DEMO_STEP_MAX_DURATION_MS = 600_000;
export const DEMO_DEFAULT_STEP_DURATION_MS = 6000;
export const DEMO_NETWORK_DURATION_MS = 20_000;

export const DEMO_TOOL = {
  CAMERA: 'camera',
  OBJECTS: 'objects',
  EVENTS: 'events',
  ZONES: 'zones',
  INUNDATION: 'inundation',
  SITUATIONS: 'situations',
  LAYERS: 'layers',
  FORMULAR: 'formular',
  COUNTRY: 'country',
  TEXT: 'text',
  MOSAIC: 'mosaic',
};

export const DEMO_EFFECT = {
  NONE: 'none',
  FADE_IN: 'fade_in',
  REVEAL_FROM_CENTER: 'reveal_from_center',
  BLINK: 'blink',
  FLICKER: 'flicker',
  GLOW: 'glow',
  COLOR_SHIFT: 'color_shift',
  SWAY: 'sway',
  STATE_CYCLE: 'state_cycle',
  STATE_OVERLAY: 'state_overlay',
  DIRECTIONAL_WIPE: 'directional_wipe',
};

export const DEMO_CAMERA_MODE = {
  NONE: 'none',
  FLY_TO: 'fly_to',
  FIT_SELECTION: 'fit_selection',
};

export const DEMO_START_MODE = {
  ON_CLICK: 'on_click',
  AFTER_PREVIOUS: 'after_previous',
  WITH_PREVIOUS: 'with_previous',
};

/** Порядок соответствует порядку вкладок карты. */
export const DEMO_TOOLS = [
  { id: DEMO_TOOL.CAMERA, label: 'Камера', icon: '🎥' },
  { id: DEMO_TOOL.OBJECTS, label: 'Объекты', icon: '📍' },
  { id: DEMO_TOOL.EVENTS, label: 'События', icon: '⚡' },
  { id: DEMO_TOOL.ZONES, label: 'Зоны действия', icon: '◎' },
  { id: DEMO_TOOL.INUNDATION, label: 'Зоны затопления', icon: '🌊' },
  { id: DEMO_TOOL.SITUATIONS, label: 'Оперативная обстановка', icon: '🗺' },
  { id: DEMO_TOOL.LAYERS, label: 'Слои карты', icon: '▤' },
  { id: DEMO_TOOL.FORMULAR, label: 'Формуляр объекта', icon: '📄' },
  { id: DEMO_TOOL.COUNTRY, label: 'Справка по стране', icon: '🏳' },
  { id: DEMO_TOOL.TEXT, label: 'Текст на карте', icon: 'T' },
];

export const DEMO_STAGE_TOOLS = DEMO_TOOLS;

export const DEMO_START_MODES = [
  { id: DEMO_START_MODE.AFTER_PREVIOUS, label: 'После предыдущего' },
  { id: DEMO_START_MODE.WITH_PREVIOUS, label: 'Вместе с предыдущим' },
  { id: DEMO_START_MODE.ON_CLICK, label: 'Новый такт' },
];

export const DEMO_EFFECTS = [
  { id: DEMO_EFFECT.NONE, label: 'Без анимации' },
  { id: DEMO_EFFECT.FADE_IN, label: 'Проявление' },
  { id: DEMO_EFFECT.REVEAL_FROM_CENTER, label: 'Раскрытие от центра' },
  { id: DEMO_EFFECT.BLINK, label: 'Мигание' },
  { id: DEMO_EFFECT.FLICKER, label: 'Мерцание' },
  { id: DEMO_EFFECT.GLOW, label: 'Свечение' },
  { id: DEMO_EFFECT.COLOR_SHIFT, label: 'Переливание цвета' },
  { id: DEMO_EFFECT.SWAY, label: 'Колыхание' },
  { id: DEMO_EFFECT.STATE_CYCLE, label: 'Смена состояний (цикл)' },
  { id: DEMO_EFFECT.STATE_OVERLAY, label: 'Наложение состояний (накопительно)' },
  { id: DEMO_EFFECT.DIRECTIONAL_WIPE, label: 'Направленное появление' },
];

export const DEMO_DIRECTIONS = [
  { id: 'left', label: 'Слева' },
  { id: 'right', label: 'Справа' },
  { id: 'top', label: 'Сверху' },
  { id: 'bottom', label: 'Снизу' },
];

export const DEMO_EASINGS = [
  { id: 'linear', label: 'Линейно' },
  { id: 'ease_out', label: 'С замедлением' },
  { id: 'ease_in_out', label: 'Плавно с двух сторон' },
];

export const DEMO_CAMERA_MODES = [
  { id: DEMO_CAMERA_MODE.NONE, label: 'Не двигать камеру' },
  { id: DEMO_CAMERA_MODE.FLY_TO, label: 'Перелёт в точку' },
  { id: DEMO_CAMERA_MODE.FIT_SELECTION, label: 'Вписать выбранное' },
];

/* --- Инструмент «Текст на карте» --- */

export const DEMO_TEXT_ANCHOR = {
  GEO: 'geo',
  SCREEN: 'screen',
};

export const DEMO_TEXT_ANCHORS = [
  { id: DEMO_TEXT_ANCHOR.SCREEN, label: 'К экрану (не двигается с картой)' },
  { id: DEMO_TEXT_ANCHOR.GEO, label: 'К координатам (двигается с картой)' },
];

/** Отступ якоря от края вьюпорта, чтобы блок не обрезался. */
export const DEMO_TEXT_ALIGN_INSET = 0.08;

export const DEMO_TEXT_ALIGN_PRESETS = {
  horizontal: [
    { id: 'left', label: 'Слева', x: DEMO_TEXT_ALIGN_INSET },
    { id: 'center', label: 'По центру', x: 0.5 },
    { id: 'right', label: 'Справа', x: 1 - DEMO_TEXT_ALIGN_INSET },
  ],
  vertical: [
    { id: 'top', label: 'Сверху', y: DEMO_TEXT_ALIGN_INSET },
    { id: 'middle', label: 'По центру', y: 0.5 },
    { id: 'bottom', label: 'Снизу', y: 1 - DEMO_TEXT_ALIGN_INSET },
  ],
};

/**
 * Ставит якорь текста в долю вьюпорта. Незаданная ось сохраняется.
 * Для привязки к координатам та же точка экрана переводится в lat/lng через карту.
 */
export function alignDemoText(text, axis, map) {
  const current = text && typeof text === 'object' ? text : {};
  const size = map?.getSize?.();
  let vx = current.screen?.x ?? 0.5;
  let vy = current.screen?.y ?? 0.15;

  if (
    current.anchor === DEMO_TEXT_ANCHOR.GEO
    && map?.latLngToContainerPoint
    && current.lat != null
    && current.lng != null
  ) {
    const point = map.latLngToContainerPoint([current.lat, current.lng]);
    if (size?.x) vx = point.x / size.x;
    if (size?.y) vy = point.y / size.y;
  }

  if (axis?.x != null) vx = axis.x;
  if (axis?.y != null) vy = axis.y;

  if (current.anchor === DEMO_TEXT_ANCHOR.GEO) {
    if (!map?.containerPointToLatLng || !size) return current;
    const latlng = map.containerPointToLatLng([vx * size.x, vy * size.y]);
    return { ...current, lat: latlng.lat, lng: latlng.lng };
  }

  return {
    ...current,
    screen: {
      ...(current.screen || {}),
      x: vx,
      y: vy,
    },
  };
}

export const DEMO_TEXT_ENTER_EFFECTS = [
  { id: 'none', label: 'Без анимации' },
  { id: 'fade', label: 'Проявление' },
  { id: 'slide', label: 'Выезд' },
  { id: 'zoom', label: 'Увеличение' },
  { id: 'blur', label: 'Из размытия' },
  { id: 'typewriter', label: 'Печатная машинка' },
];

export const DEMO_TEXT_EXIT_EFFECTS = [
  { id: 'none', label: 'Без анимации' },
  { id: 'fade', label: 'Растворение' },
  { id: 'slide', label: 'Уезд' },
  { id: 'zoom', label: 'Уменьшение' },
  { id: 'blur', label: 'В размытие' },
];

/**
 * Оффлайн-развёртывание: в сборку входит только Roboto, остальные семейства
 * берутся из шрифтов операционной системы.
 */
export const DEMO_TEXT_FONTS = [
  { id: 'Roboto', label: 'Roboto (встроенный)' },
  { id: 'Arial', label: 'Arial' },
  { id: 'Tahoma', label: 'Tahoma' },
  { id: 'Verdana', label: 'Verdana' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Times New Roman', label: 'Times New Roman' },
  { id: 'Courier New', label: 'Courier New' },
  { id: 'sans-serif', label: 'Системный без засечек' },
  { id: 'serif', label: 'Системный с засечками' },
  { id: 'monospace', label: 'Системный моноширинный' },
];

export const DEMO_TEXT_WEIGHTS = [
  { id: 300, label: 'Светлый' },
  { id: 400, label: 'Обычный' },
  { id: 500, label: 'Средний' },
  { id: 600, label: 'Полужирный' },
  { id: 700, label: 'Жирный' },
  { id: 800, label: 'Очень жирный' },
  { id: 900, label: 'Чёрный' },
];

export const DEMO_TEXT_ALIGNS = [
  { id: 'left', label: 'По левому краю' },
  { id: 'center', label: 'По центру' },
  { id: 'right', label: 'По правому краю' },
];

export const DEMO_TEXT_MAX_LENGTH = 4000;

/* --- Мультиэкран --- */

export const DEMO_MOSAIC_LAYOUT = {
  ROW2: '1x2',
  ROW3: '1x3',
  COL2: '2x1',
  ONE_PLUS_TWO: '1+2',
  GRID2: '2x2',
  GRID23: '2x3',
  TWO_PLUS_THREE: '2+3',
};

export const DEMO_MOSAIC_LAYOUTS = [
  { id: DEMO_MOSAIC_LAYOUT.ROW2, label: 'Два экрана рядом', slots: ['a', 'b'] },
  { id: DEMO_MOSAIC_LAYOUT.ROW3, label: 'Сетка 1×3', slots: ['a', 'b', 'c'] },
  { id: DEMO_MOSAIC_LAYOUT.COL2, label: 'Два экрана сверху и снизу', slots: ['a', 'b'] },
  { id: DEMO_MOSAIC_LAYOUT.ONE_PLUS_TWO, label: 'Один крупный + два', slots: ['a', 'b', 'c'] },
  { id: DEMO_MOSAIC_LAYOUT.GRID2, label: 'Сетка 2×2', slots: ['a', 'b', 'c', 'd'] },
  { id: DEMO_MOSAIC_LAYOUT.GRID23, label: 'Сетка 2×3', slots: ['a', 'b', 'c', 'd', 'e', 'f'] },
  { id: DEMO_MOSAIC_LAYOUT.TWO_PLUS_THREE, label: 'Два сверху, три снизу', slots: ['a', 'b', 'c', 'd', 'e'] },
];

export const DEMO_MOSAIC_SLOT_LABELS = {
  a: 'Экран A',
  b: 'Экран B',
  c: 'Экран C',
  d: 'Экран D',
  e: 'Экран E',
  f: 'Экран F',
};

export const DEMO_MOSAIC_REVEAL = {
  ALL: 'all',
  STAGGER: 'stagger',
};

/** Анимация разворота/свёртки слота в полноэкран. */
export const DEMO_MOSAIC_EXPAND_ANIMATION = {
  STRETCH: 'stretch',
  CENTER_THEN_STRETCH: 'center_then_stretch',
  COVER: 'cover',
};

export const DEMO_MOSAIC_EXPAND_ANIMATIONS = [
  { id: DEMO_MOSAIC_EXPAND_ANIMATION.COVER, label: 'Наезд поверх соседних экранов' },
  { id: DEMO_MOSAIC_EXPAND_ANIMATION.STRETCH, label: 'Сразу на весь экран' },
  {
    id: DEMO_MOSAIC_EXPAND_ANIMATION.CENTER_THEN_STRETCH,
    label: 'В центр, затем на весь экран',
  },
];

/** CSS timing-function для id из DEMO_EASINGS. */
export const DEMO_EASING_CSS = {
  linear: 'linear',
  ease_out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  ease_in_out: 'ease-in-out',
};

export const DEMO_MOSAIC_ACTION = {
  SHOW_GRID: 'show_grid',
  EXPAND: 'expand',
  COLLAPSE: 'collapse',
  SHOW_SLOT: 'show_slot',
  FOCUS_SLOT: 'focus_slot',
  EXIT: 'exit',
};

export const DEMO_MOSAIC_ACTIONS = [
  { id: DEMO_MOSAIC_ACTION.SHOW_GRID, label: 'Показать сетку' },
  { id: DEMO_MOSAIC_ACTION.SHOW_SLOT, label: 'Показать экран' },
  { id: DEMO_MOSAIC_ACTION.FOCUS_SLOT, label: 'Развернуть экран' },
  { id: DEMO_MOSAIC_ACTION.EXPAND, label: 'Развернуть экран' },
  { id: DEMO_MOSAIC_ACTION.COLLAPSE, label: 'Свернуть в сетку' },
  { id: DEMO_MOSAIC_ACTION.EXIT, label: 'Выйти из мультиэкрана' },
];

export const DEMO_SEQUENCE_MOSAIC_ACTIONS = [
  { id: DEMO_MOSAIC_ACTION.SHOW_GRID, label: 'Сетка' },
  { id: DEMO_MOSAIC_ACTION.EXPAND, label: 'Развернуть экран' },
  { id: DEMO_MOSAIC_ACTION.COLLAPSE, label: 'Свернуть в сетку' },
];

const SEQUENCE_MOSAIC_ACTION_IDS = DEMO_SEQUENCE_MOSAIC_ACTIONS.map((item) => item.id);
const MOSAIC_SLOT_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

export const DEMO_SEQUENCE_TYPE = {
  STAGE: 'stage',
  MOSAIC: 'mosaic',
  TABLEAU: 'tableau',
};

export const DEMO_SEQUENCE_TYPES = [
  { id: DEMO_SEQUENCE_TYPE.STAGE, label: 'Этап', icon: '▶' },
  { id: DEMO_SEQUENCE_TYPE.MOSAIC, label: 'Мультиэкран', icon: '▦' },
  { id: DEMO_SEQUENCE_TYPE.TABLEAU, label: 'Художественный', icon: '◇' },
];

export const DEMO_DEFAULT_TABLEAU_TILT = {
  perspective: 1200,
  rotate_x: 58,
  rotate_z: -8,
  scale: 0.92,
  offset_y: 0,
};

export const DEMO_DEFAULT_TABLEAU_CAPTION = {
  content: '',
  x: 50,
  y: 6,
  font_family: 'Roboto',
  font_size: 17,
  font_weight: 700,
  color: '#f8fafc',
  background: 'rgba(15, 23, 42, 0.55)',
  border: {
    color: 'rgba(255, 255, 255, 0.28)',
    width: 1,
  },
};

export const DEMO_DEFAULT_TABLEAU_BORDER_RADIUS = 14;
export const DEMO_DEFAULT_TABLEAU_TILT_MS = 700;
export const DEMO_DEFAULT_TABLEAU_UNTILT_MS = 700;

export const DEMO_DEFAULT_TABLEAU_BLOCK_FILL = {
  color: 'rgba(15,23,42,0.55)',
  opacity: 1,
};

export const DEMO_DEFAULT_TABLEAU_BLOCK_BORDER = {
  color: 'rgba(255,255,255,0.28)',
  width: 1,
  opacity: 1,
};

export const DEMO_TABLEAU_ARROW_LINES = ['solid', 'dashed', 'dotted'];
export const DEMO_TABLEAU_ARROW_HEADS = ['end', 'none', 'both'];
export const DEMO_TABLEAU_EDGES = ['top', 'right', 'bottom', 'left'];

/** Рамка карты при показе (centered 88%×78%). */
export const DEMO_TABLEAU_MAP_FRAME = {
  left: 6,
  top: 11,
  width: 88,
  height: 78,
};

export const DEMO_DEFAULT_TABLEAU_ARROW = {
  line: 'dashed',
  width: 1.5,
  color: 'rgba(248,250,252,0.88)',
  head: 'end',
  block_edge: 'bottom',
};

export const DEMO_TABLEAU_CELL_ROLES = ['card', 'bridge'];
export const DEMO_TABLEAU_CELL_ALIGNS = ['start', 'center', 'end'];

export const DEMO_DEFAULT_TABLEAU_OVERLAY = {
  cols: 5,
  rows: 2,
  x: 4,
  y: 2,
  width: 92,
  height: 36,
  column_gap: 1.2,
  row_gap: 1.2,
  row_heights: [1, 1],
  cells: [
    { id: 'cell-0-0', row: 0, col: 0, col_span: 1, role: 'card', block_id: null, content_width: 100, content_height: 100, align_x: 'center', align_y: 'center', offset_top: 0 },
    { id: 'cell-0-1', row: 0, col: 1, col_span: 1, role: 'card', block_id: null, content_width: 100, content_height: 100, align_x: 'center', align_y: 'center', offset_top: 0 },
    { id: 'cell-0-2', row: 0, col: 2, col_span: 1, role: 'card', block_id: null, content_width: 100, content_height: 100, align_x: 'center', align_y: 'center', offset_top: 0 },
    { id: 'cell-0-3', row: 0, col: 3, col_span: 1, role: 'card', block_id: null, content_width: 100, content_height: 100, align_x: 'center', align_y: 'center', offset_top: 0 },
    { id: 'cell-0-4', row: 0, col: 4, col_span: 1, role: 'card', block_id: null, content_width: 100, content_height: 100, align_x: 'center', align_y: 'center', offset_top: 0 },
    { id: 'cell-1-1', row: 1, col: 1, col_span: 3, role: 'bridge', block_id: null, content_width: 100, content_height: 100, align_x: 'center', align_y: 'center', offset_top: 0 },
  ],
  map_arrow: {
    inset: 14,
    line: 'dashed',
    width: 1.5,
    color: 'rgba(248,250,252,0.88)',
    head: 'end',
  },
};

export const DEMO_DEFAULT_TABLEAU_MAP_REVEAL = {
  lifetime_ms: 3500,
  spawn_gap_min_ms: 0,
  spawn_gap_max_ms: 1000,
};

export const DEMO_DEFAULT_TABLEAU_CAMERA = {
  mode: DEMO_CAMERA_MODE.FLY_TO,
  lat: null,
  lng: null,
  zoom: 8,
  duration_ms: 1500,
  ease_linearity: 0.3,
  padding: 72,
};

export const DEMO_TABLEAU_VARIANT = {
  TABLET: 'tablet',
  GALLERY: 'gallery',
  SCANNER: 'scanner',
  NETWORK: 'network',
};

export const DEMO_TABLEAU_VARIANTS = [
  { id: DEMO_TABLEAU_VARIANT.TABLET, label: 'Планшетный режим' },
  { id: DEMO_TABLEAU_VARIANT.GALLERY, label: 'Галерея на карте' },
  { id: DEMO_TABLEAU_VARIANT.SCANNER, label: 'Сканирование документов' },
  { id: DEMO_TABLEAU_VARIANT.NETWORK, label: 'Обмен информацией' },
];

export const DEMO_TABLEAU_GALLERY_ENTER = {
  CENTER_ZOOM: 'center_zoom',
  FADE_SCALE: 'fade_scale',
  SLIDE_UP: 'slide_up',
  SLIDE_LEFT: 'slide_left',
  SLIDE_RIGHT: 'slide_right',
  BLUR_IN: 'blur_in',
  FROM_OBJECT: 'from_object',
};

export const DEMO_TABLEAU_GALLERY_EXIT = {
  FADE: 'fade',
  FADE_SCALE: 'fade_scale',
  SLIDE_OUT: 'slide_out',
};

export const DEMO_TABLEAU_GALLERY_SETTLE = {
  ROW: 'row',
  ROW_FIT: 'row_fit',
  OVERLAP: 'overlap',
  FREE: 'free',
};

export const DEMO_TABLEAU_GALLERY_ENTER_EFFECTS = [
  { id: DEMO_TABLEAU_GALLERY_ENTER.CENTER_ZOOM, label: 'Проявление с увеличением' },
  { id: DEMO_TABLEAU_GALLERY_ENTER.FADE_SCALE, label: 'Проявление с масштабом' },
  { id: DEMO_TABLEAU_GALLERY_ENTER.SLIDE_UP, label: 'Снизу вверх' },
  { id: DEMO_TABLEAU_GALLERY_ENTER.SLIDE_LEFT, label: 'Слева' },
  { id: DEMO_TABLEAU_GALLERY_ENTER.SLIDE_RIGHT, label: 'Справа' },
  { id: DEMO_TABLEAU_GALLERY_ENTER.BLUR_IN, label: 'Проявление с размытием' },
  { id: DEMO_TABLEAU_GALLERY_ENTER.FROM_OBJECT, label: 'Из объекта' },
];

export const DEMO_TABLEAU_GALLERY_EXIT_EFFECTS = [
  { id: DEMO_TABLEAU_GALLERY_EXIT.FADE, label: 'Затухание' },
  { id: DEMO_TABLEAU_GALLERY_EXIT.FADE_SCALE, label: 'Затухание с масштабом' },
  { id: DEMO_TABLEAU_GALLERY_EXIT.SLIDE_OUT, label: 'Уход в сторону' },
];

export const DEMO_TABLEAU_GALLERY_SETTLES = [
  { id: DEMO_TABLEAU_GALLERY_SETTLE.ROW, label: 'Рядом без изменения размера' },
  { id: DEMO_TABLEAU_GALLERY_SETTLE.ROW_FIT, label: 'Рядом с подгонкой размера' },
  { id: DEMO_TABLEAU_GALLERY_SETTLE.OVERLAP, label: 'Наплыв друг на друга' },
  { id: DEMO_TABLEAU_GALLERY_SETTLE.FREE, label: 'Свободное расположение' },
];

export const DEMO_TABLEAU_GALLERY_MAX_IMAGES = 6;

export const DEMO_DEFAULT_TABLEAU_GALLERY = {
  show_map: true,
  stagger_ms: 160,
  enter_ms: 600,
  hold_ms: 800,
  exit_ms: 420,
  enter_effect: DEMO_TABLEAU_GALLERY_ENTER.CENTER_ZOOM,
  exit_effect: DEMO_TABLEAU_GALLERY_EXIT.FADE_SCALE,
  settle: DEMO_TABLEAU_GALLERY_SETTLE.FREE,
  settle_ms: 520,
  band: { x: 6, y: 8, width: 88, height: 42 },
  gap_pct: 1.2,
  overlap_offset_pct: 4,
  overlap_rotate_deg: 3,
  images: [],
};

export const DEMO_DEFAULT_TABLEAU_NETWORK = {
  logos: [{ src: '', title: '' }, { src: '', title: '' }, { src: '', title: '' }],
};

export const DEMO_MOSAIC_CONTENT = {
  IMAGE: 'image',
  STAGE: 'stage',
  VIDEO: 'video',
};

export const DEMO_MOSAIC_CONTENTS = [
  { id: DEMO_MOSAIC_CONTENT.IMAGE, label: 'Статическая фотография' },
  { id: DEMO_MOSAIC_CONTENT.STAGE, label: 'Живая мини-карта' },
  { id: DEMO_MOSAIC_CONTENT.VIDEO, label: 'Видеофайл' },
];

export const DEMO_PROGRAM_TRANSITION = {
  NONE: 'none',
  FADE: 'fade',
  BLACKOUT: 'blackout',
  STAGGER: 'stagger',
};

export const DEMO_PROGRAM_ENTER_EFFECTS = [
  { id: DEMO_PROGRAM_TRANSITION.NONE, label: 'Без анимации' },
  { id: DEMO_PROGRAM_TRANSITION.FADE, label: 'Проявление' },
  { id: DEMO_PROGRAM_TRANSITION.BLACKOUT, label: 'Через затемнение' },
  { id: DEMO_PROGRAM_TRANSITION.STAGGER, label: 'Постепенно (мультиэкран)' },
];

export const DEMO_PROGRAM_EXIT_EFFECTS = [
  { id: DEMO_PROGRAM_TRANSITION.NONE, label: 'Без анимации' },
  { id: DEMO_PROGRAM_TRANSITION.FADE, label: 'Растворение' },
  { id: DEMO_PROGRAM_TRANSITION.BLACKOUT, label: 'В затемнение' },
];

export function getMosaicLayoutDef(layoutId) {
  return DEMO_MOSAIC_LAYOUTS.find((item) => item.id === layoutId)
    || DEMO_MOSAIC_LAYOUTS.find((item) => item.id === DEMO_MOSAIC_LAYOUT.GRID2)
    || DEMO_MOSAIC_LAYOUTS[0];
}

export function getMosaicActionLabel(action) {
  return DEMO_SEQUENCE_MOSAIC_ACTIONS.find((item) => item.id === action)?.label
    || DEMO_MOSAIC_ACTIONS.find((item) => item.id === action)?.label
    || action
    || '';
}

export function normalizeSequenceMosaicAction(raw) {
  const aliases = {
    [DEMO_MOSAIC_ACTION.FOCUS_SLOT]: DEMO_MOSAIC_ACTION.EXPAND,
    [DEMO_MOSAIC_ACTION.SHOW_SLOT]: DEMO_MOSAIC_ACTION.EXPAND,
    [DEMO_MOSAIC_ACTION.EXIT]: DEMO_MOSAIC_ACTION.COLLAPSE,
  };
  const value = aliases[raw] || raw;
  return pickChoice(value, SEQUENCE_MOSAIC_ACTION_IDS, DEMO_MOSAIC_ACTION.SHOW_GRID);
}

export function normalizeMosaicSlotId(raw) {
  const id = String(raw || '').trim().toLowerCase();
  return MOSAIC_SLOT_IDS.includes(id) ? id : null;
}

export function normalizeExpandableSlots(raw, slotIds) {
  const allowed = Array.isArray(slotIds) ? slotIds : [];
  if (raw == null) return [...allowed];
  if (!Array.isArray(raw)) return [...allowed];
  const picked = new Set(
    raw.map((item) => String(item || '').trim().toLowerCase()).filter((id) => allowed.includes(id)),
  );
  return allowed.filter((id) => picked.has(id));
}

export function makeLocalPresetId() {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Какие эффекты имеют смысл для каждого инструмента. */
const EFFECTS_BY_TOOL = {
  [DEMO_TOOL.CAMERA]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.OBJECTS]: [
    DEMO_EFFECT.NONE,
    DEMO_EFFECT.FADE_IN,
    DEMO_EFFECT.BLINK,
    DEMO_EFFECT.FLICKER,
    DEMO_EFFECT.GLOW,
    DEMO_EFFECT.COLOR_SHIFT,
    DEMO_EFFECT.SWAY,
  ],
  [DEMO_TOOL.EVENTS]: [DEMO_EFFECT.NONE, DEMO_EFFECT.FADE_IN, DEMO_EFFECT.BLINK],
  [DEMO_TOOL.ZONES]: [DEMO_EFFECT.NONE, DEMO_EFFECT.FADE_IN, DEMO_EFFECT.REVEAL_FROM_CENTER],
  [DEMO_TOOL.INUNDATION]: [
    DEMO_EFFECT.NONE,
    DEMO_EFFECT.FADE_IN,
    DEMO_EFFECT.REVEAL_FROM_CENTER,
    DEMO_EFFECT.DIRECTIONAL_WIPE,
  ],
  [DEMO_TOOL.SITUATIONS]: [
    DEMO_EFFECT.NONE,
    DEMO_EFFECT.FADE_IN,
    DEMO_EFFECT.STATE_CYCLE,
    DEMO_EFFECT.STATE_OVERLAY,
  ],
  [DEMO_TOOL.LAYERS]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.FORMULAR]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.COUNTRY]: [DEMO_EFFECT.NONE],
  // У текста собственные эффекты входа/выхода внутри блока `text`.
  [DEMO_TOOL.TEXT]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.MOSAIC]: [DEMO_EFFECT.NONE],
};

const DEFAULT_EFFECT_BY_TOOL = {
  [DEMO_TOOL.EVENTS]: DEMO_EFFECT.BLINK,
  [DEMO_TOOL.ZONES]: DEMO_EFFECT.REVEAL_FROM_CENTER,
  [DEMO_TOOL.INUNDATION]: DEMO_EFFECT.DIRECTIONAL_WIPE,
  [DEMO_TOOL.SITUATIONS]: DEMO_EFFECT.STATE_CYCLE,
};

export function getEffectsForTool(tool) {
  const allowed = EFFECTS_BY_TOOL[tool] || [DEMO_EFFECT.NONE];
  return DEMO_EFFECTS.filter((effect) => allowed.includes(effect.id));
}

export function getToolLabel(tool) {
  return DEMO_TOOLS.find((item) => item.id === tool)?.label || tool;
}

export function getToolIcon(tool) {
  return DEMO_TOOLS.find((item) => item.id === tool)?.icon || '•';
}

export function getEffectLabel(effect) {
  return DEMO_EFFECTS.find((item) => item.id === effect)?.label || effect;
}

export function isContinuousByDefault(effect) {
  return (
    effect === DEMO_EFFECT.BLINK
    || effect === DEMO_EFFECT.FLICKER
    || effect === DEMO_EFFECT.GLOW
    || effect === DEMO_EFFECT.COLOR_SHIFT
    || effect === DEMO_EFFECT.SWAY
    || effect === DEMO_EFFECT.STATE_CYCLE
  );
}

function clampInt(value, low, high, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.max(low, Math.min(high, number)));
}

function clampFloat(value, low, high, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(low, Math.min(high, number));
}

function pickChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export const DEMO_CUE_MIN = 1;
export const DEMO_CUE_MAX = 99;

/** Номер позиции докладчика: 1–99 или null, если не задан. */
export function normalizeCue(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < DEMO_CUE_MIN || rounded > DEMO_CUE_MAX) return null;
  return rounded;
}

function toBool(value, fallback) {
  if (value === true || value === false) return value;
  if (value == null) return fallback;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

export function createDefaultScenarioMosaic(overrides = {}) {
  return normalizeScenarioMosaic({
    presets: [],
    active_preset_id: null,
    ...overrides,
  });
}

export function createDefaultMosaicScreen(slotId, overrides = {}) {
  return normalizeMosaicScreen({
    id: slotId,
    label: DEMO_MOSAIC_SLOT_LABELS[slotId] || `Экран ${String(slotId).toUpperCase()}`,
    loop: false,
    stage_id: null,
    expand_stage_id: null,
    content_type: DEMO_MOSAIC_CONTENT.STAGE,
    video_url: null,
    video_media_id: null,
    ...overrides,
  }, slotId);
}

export function createDefaultMosaicPreset(overrides = {}) {
  return normalizeMosaicPreset({
    id: makeLocalPresetId(),
    title: 'Мультиэкран',
    layout: DEMO_MOSAIC_LAYOUT.GRID2,
    transition_ms: 700,
    expand_animation: DEMO_MOSAIC_EXPAND_ANIMATION.STRETCH,
    expand_ms: 700,
    collapse_ms: 700,
    expand_easing: 'ease_out',
    collapse_easing: 'ease_out',
    reveal: DEMO_MOSAIC_REVEAL.ALL,
    stagger_ms: 400,
    ...overrides,
  });
}

export function createDefaultScenarioTableau(overrides = {}) {
  return normalizeScenarioTableau({
    presets: [],
    active_preset_id: null,
    blocks: [],
    ...overrides,
  });
}

function makeLocalTableauId(prefix, index = 0) {
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 10)}`;
}

function optionalTableauId(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();
  return value ? value.slice(0, 80) : null;
}

export function normalizeTableauTilt(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    perspective: clampInt(
      data.perspective,
      400,
      4000,
      DEMO_DEFAULT_TABLEAU_TILT.perspective,
    ),
    rotate_x: clampFloat(
      data.rotate_x,
      0,
      80,
      DEMO_DEFAULT_TABLEAU_TILT.rotate_x,
    ),
    rotate_z: clampFloat(
      data.rotate_z,
      -45,
      45,
      DEMO_DEFAULT_TABLEAU_TILT.rotate_z,
    ),
    scale: clampFloat(
      data.scale,
      0.4,
      1.2,
      DEMO_DEFAULT_TABLEAU_TILT.scale,
    ),
    offset_y: clampFloat(
      data.offset_y,
      -30,
      30,
      DEMO_DEFAULT_TABLEAU_TILT.offset_y,
    ),
  };
}

export function normalizeTableauCaption(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const content = typeof data.content === 'string' ? data.content.trim().slice(0, 500) : '';
  const borderRaw = data.border && typeof data.border === 'object' ? data.border : {};
  const weightIds = DEMO_TEXT_WEIGHTS.map((item) => item.id);
  const fontIds = DEMO_TEXT_FONTS.map((item) => item.id);
  return {
    content,
    x: clampFloat(data.x, 0, 100, DEMO_DEFAULT_TABLEAU_CAPTION.x),
    y: clampFloat(data.y, 0, 100, DEMO_DEFAULT_TABLEAU_CAPTION.y),
    font_family: pickChoice(
      data.font_family,
      fontIds,
      DEMO_DEFAULT_TABLEAU_CAPTION.font_family,
    ),
    font_size: clampFloat(
      data.font_size,
      10,
      96,
      DEMO_DEFAULT_TABLEAU_CAPTION.font_size,
    ),
    font_weight: pickChoice(
      Number(data.font_weight),
      weightIds,
      DEMO_DEFAULT_TABLEAU_CAPTION.font_weight,
    ),
    color: pickColor(data.color, DEMO_DEFAULT_TABLEAU_CAPTION.color),
    background: pickColor(data.background, DEMO_DEFAULT_TABLEAU_CAPTION.background),
    border: {
      color: pickColor(borderRaw.color, DEMO_DEFAULT_TABLEAU_CAPTION.border.color),
      width: clampFloat(
        borderRaw.width,
        0,
        12,
        DEMO_DEFAULT_TABLEAU_CAPTION.border.width,
      ),
    },
  };
}

function normalizeTableauFill(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    color: pickColor(data.color, DEMO_DEFAULT_TABLEAU_BLOCK_FILL.color),
    opacity: clampFloat(
      data.opacity,
      0,
      1,
      DEMO_DEFAULT_TABLEAU_BLOCK_FILL.opacity,
    ),
  };
}

function normalizeTableauBorder(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    color: pickColor(data.color, DEMO_DEFAULT_TABLEAU_BLOCK_BORDER.color),
    width: clampFloat(
      data.width,
      0,
      12,
      DEMO_DEFAULT_TABLEAU_BLOCK_BORDER.width,
    ),
    opacity: clampFloat(
      data.opacity,
      0,
      1,
      DEMO_DEFAULT_TABLEAU_BLOCK_BORDER.opacity,
    ),
  };
}

export function normalizeTableauElement(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const elType = pickChoice(data.type, ['text', 'image'], 'text');
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('el', index);
  const base = {
    id,
    type: elType,
    x: clampFloat(data.x, 0, 100, 8),
    y: clampFloat(data.y, 0, 100, 8 + index * 12),
    w: clampFloat(data.w, 4, 100, 84),
    h: clampFloat(data.h, 4, 100, 20),
  };
  if (elType === 'image') {
    const src = typeof data.src === 'string' ? data.src.trim().slice(0, 500) : '';
    return {
      ...base,
      src,
      rotation: clampFloat(data.rotation, -180, 180, 0),
    };
  }
  const content = typeof data.content === 'string' ? data.content.slice(0, 2000) : '';
  return {
    ...base,
    content,
    style: normalizeTextStyle(data.style),
  };
}

export function normalizeTableauBlock(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('block', index);
  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim().slice(0, 200)
    : `Блок ${index + 1}`;
  const elements = [];
  const seen = new Set();
  (Array.isArray(data.elements) ? data.elements : []).slice(0, 40).forEach((item, elIndex) => {
    const element = normalizeTableauElement(item, elIndex);
    if (seen.has(element.id)) {
      element.id = makeLocalTableauId('el', elIndex);
    }
    seen.add(element.id);
    elements.push(element);
  });
  return {
    id,
    title,
    width: clampFloat(data.width, 8, 80, 22),
    height: clampFloat(data.height, 8, 70, 28),
    border_radius_px: clampInt(data.border_radius_px, 0, 48, 12),
    fill: normalizeTableauFill(data.fill),
    border: normalizeTableauBorder(data.border),
    elements,
  };
}

export function normalizeTableauPlacement(raw, index = 0, allowedBlockIds = null) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('place', index);
  let blockId = optionalTableauId(data.block_id);
  if (allowedBlockIds != null && blockId && !allowedBlockIds.has(blockId)) {
    blockId = null;
  }
  let width = null;
  if (data.width != null && data.width !== '') {
    width = clampFloat(data.width, 8, 80, 22);
  }
  let height = null;
  if (data.height != null && data.height !== '') {
    height = clampFloat(data.height, 8, 70, 28);
  }
  return {
    id,
    block_id: blockId,
    x: clampFloat(data.x, 0, 100, 20 + index * 12),
    y: clampFloat(data.y, 0, 100, 12 + (index % 3) * 14),
    width,
    height,
  };
}

export function normalizeTableauMapAnchor(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('anchor', index);
  return {
    id,
    edge: pickChoice(data.edge, DEMO_TABLEAU_EDGES, 'bottom'),
    t: clampFloat(data.t, 0, 1, 0.5),
  };
}

export function normalizeTableauArrow(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('arrow', index);
  return {
    id,
    placement_id: optionalTableauId(data.placement_id),
    block_edge: pickChoice(
      data.block_edge,
      DEMO_TABLEAU_EDGES,
      DEMO_DEFAULT_TABLEAU_ARROW.block_edge,
    ),
    map_anchor_id: optionalTableauId(data.map_anchor_id),
    line: pickChoice(data.line, DEMO_TABLEAU_ARROW_LINES, DEMO_DEFAULT_TABLEAU_ARROW.line),
    width: clampFloat(
      data.width,
      0.5,
      8,
      DEMO_DEFAULT_TABLEAU_ARROW.width,
    ),
    color: pickColor(data.color, DEMO_DEFAULT_TABLEAU_ARROW.color),
    head: pickChoice(data.head, DEMO_TABLEAU_ARROW_HEADS, DEMO_DEFAULT_TABLEAU_ARROW.head),
  };
}

export function normalizeTableauOverlayCell(raw, index = 0, cols = 5, rows = 2, allowedBlockIds = null) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('cell', index);
  const colMax = Math.max(1, cols) - 1;
  const rowMax = Math.max(1, rows) - 1;
  const col = clampInt(data.col, 0, colMax, Math.min(index, colMax));
  const row = clampInt(data.row, 0, rowMax, 0);
  const maxSpan = Math.max(1, cols - col);
  const colSpan = clampInt(data.col_span, 1, maxSpan, 1);
  let blockId = optionalTableauId(data.block_id);
  if (allowedBlockIds != null && blockId && !allowedBlockIds.has(blockId)) {
    blockId = null;
  }
  return {
    id,
    row,
    col,
    col_span: colSpan,
    role: pickChoice(data.role, DEMO_TABLEAU_CELL_ROLES, 'card'),
    block_id: blockId,
    content_width: clampFloat(data.content_width, 20, 100, 100),
    content_height: clampFloat(data.content_height, 20, 100, 100),
    align_x: pickChoice(data.align_x, DEMO_TABLEAU_CELL_ALIGNS, 'center'),
    align_y: pickChoice(data.align_y, DEMO_TABLEAU_CELL_ALIGNS, 'center'),
    offset_top: clampFloat(data.offset_top, 0, 40, 0),
  };
}

export function normalizeTableauOverlayMapArrow(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const defaults = DEMO_DEFAULT_TABLEAU_OVERLAY.map_arrow;
  return {
    inset: clampFloat(data.inset, 0, 40, defaults.inset),
    line: pickChoice(data.line, DEMO_TABLEAU_ARROW_LINES, defaults.line),
    width: clampFloat(data.width, 0.5, 8, defaults.width),
    color: pickColor(data.color, defaults.color),
    head: pickChoice(data.head, DEMO_TABLEAU_ARROW_HEADS, defaults.head),
  };
}

/** Нормализовать веса высот рядов до длины rows. */
export function normalizeTableauRowHeights(raw, rows) {
  const count = Math.max(1, rows);
  const list = Array.isArray(raw) ? raw : [];
  const heights = [];
  for (let i = 0; i < count; i += 1) {
    heights.push(clampFloat(list[i], 0.2, 10, 1));
  }
  return heights;
}

/** Собрать overlay из старых placements (один ряд, без моста). */
export function migratePlacementsToOverlay(placements, allowedBlockIds = null) {
  const list = Array.isArray(placements) ? placements.filter(Boolean) : [];
  if (!list.length) {
    return normalizeTableauOverlay(DEMO_DEFAULT_TABLEAU_OVERLAY, allowedBlockIds);
  }
  const cols = clampInt(list.length, 1, 8, Math.min(list.length, 8));
  const cells = list.slice(0, cols).map((placement, index) => (
    normalizeTableauOverlayCell({
      id: placement.id ? `cell-from-${placement.id}` : undefined,
      row: 0,
      col: index,
      col_span: 1,
      role: 'card',
      block_id: placement.block_id,
    }, index, cols, 1, allowedBlockIds)
  ));
  return normalizeTableauOverlay({
    cols,
    rows: 1,
    x: 4,
    y: 4,
    width: 92,
    height: 28,
    column_gap: 1.2,
    row_gap: 1.2,
    row_heights: [1],
    cells,
    map_arrow: { ...DEMO_DEFAULT_TABLEAU_OVERLAY.map_arrow },
  }, allowedBlockIds);
}

export function normalizeTableauOverlay(raw, allowedBlockIds = null) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const cols = clampInt(data.cols, 1, 8, DEMO_DEFAULT_TABLEAU_OVERLAY.cols);
  const rows = clampInt(data.rows, 1, 4, DEMO_DEFAULT_TABLEAU_OVERLAY.rows);
  const legacyGap = data.gap != null
    ? clampFloat(data.gap, 0, 40, DEMO_DEFAULT_TABLEAU_OVERLAY.column_gap)
    : DEMO_DEFAULT_TABLEAU_OVERLAY.column_gap;
  const columnGap = clampFloat(
    data.column_gap != null ? data.column_gap : legacyGap,
    0, 40, DEMO_DEFAULT_TABLEAU_OVERLAY.column_gap,
  );
  const rowGap = clampFloat(
    data.row_gap != null ? data.row_gap : legacyGap,
    0, 40, DEMO_DEFAULT_TABLEAU_OVERLAY.row_gap,
  );
  const cellsRaw = Array.isArray(data.cells) ? data.cells : [];
  const cells = [];
  const seen = new Set();
  let bridgeCount = 0;
  cellsRaw.slice(0, cols * rows + 8).forEach((item, index) => {
    const cell = normalizeTableauOverlayCell(item, index, cols, rows, allowedBlockIds);
    if (cell.col + cell.col_span > cols) {
      cell.col_span = Math.max(1, cols - cell.col);
    }
    if (cell.role === 'bridge') {
      if (bridgeCount >= 1) cell.role = 'card';
      else bridgeCount += 1;
    }
    if (seen.has(cell.id)) {
      cell.id = makeLocalTableauId('cell', index);
    }
    seen.add(cell.id);
    cells.push(cell);
  });
  return {
    cols,
    rows,
    x: clampFloat(data.x, 0, 100, DEMO_DEFAULT_TABLEAU_OVERLAY.x),
    y: clampFloat(data.y, 0, 90, DEMO_DEFAULT_TABLEAU_OVERLAY.y),
    width: clampFloat(data.width, 10, 100, DEMO_DEFAULT_TABLEAU_OVERLAY.width),
    height: clampFloat(data.height, 8, 95, DEMO_DEFAULT_TABLEAU_OVERLAY.height),
    column_gap: columnGap,
    row_gap: rowGap,
    row_heights: normalizeTableauRowHeights(data.row_heights, rows),
    cells,
    map_arrow: normalizeTableauOverlayMapArrow(data.map_arrow),
  };
}

function alignOffset(align, freeSpace) {
  if (align === 'start') return 0;
  if (align === 'end') return freeSpace;
  return freeSpace / 2;
}

/** offset_top моста (0 если моста нет). */
export function getBridgeOffsetTop(overlay) {
  const bridge = (overlay?.cells || []).find((c) => c?.role === 'bridge');
  if (!bridge) return 0;
  return clampFloat(bridge.offset_top, 0, 40, 0);
}

/**
 * Метрики рядов сетки: базовые доли от overlay.height + extra на ряд моста.
 */
export function resolveOverlayRowMetrics(overlay) {
  const cols = Math.max(1, overlay?.cols || 1);
  const rows = Math.max(1, overlay?.rows || 1);
  const oy = Number(overlay?.y) || 0;
  const ow = Number(overlay?.width) || 100;
  let oh = Number(overlay?.height) || 30;
  let columnGap = Math.max(0, Number(
    overlay?.column_gap != null ? overlay.column_gap : overlay?.gap,
  ) || 0);
  let rowGap = Math.max(0, Number(
    overlay?.row_gap != null ? overlay.row_gap : overlay?.gap,
  ) || 0);
  const heights = normalizeTableauRowHeights(overlay?.row_heights, rows);
  const bridge = (overlay?.cells || []).find((c) => c?.role === 'bridge');
  const bridgeRow = bridge ? clampInt(bridge.row, 0, rows - 1, 0) : -1;
  let extra = bridge ? clampFloat(bridge.offset_top, 0, 40, 0) : 0;
  const maxExtra = Math.max(0, 100 - oy - oh);
  if (extra > maxExtra) extra = maxExtra;

  const colGaps = Math.max(0, cols - 1);
  const rowGaps = Math.max(0, rows - 1);
  if (colGaps > 0 && columnGap * colGaps >= ow) {
    columnGap = (ow * 0.85) / colGaps;
  }
  if (rowGaps > 0 && rowGap * rowGaps >= oh) {
    rowGap = (oh * 0.85) / rowGaps;
  }

  const usableH = oh - rowGap * rowGaps;
  const weightSum = heights.reduce((sum, h) => sum + h, 0) || rows;
  const rowHeights = heights.map((h) => (usableH * h) / weightSum);
  if (bridgeRow >= 0 && extra > 0) {
    rowHeights[bridgeRow] += extra;
  }
  const totalHeight = oh + extra;
  return {
    cols,
    rows,
    columnGap,
    rowGap,
    rowHeights,
    bridgeRow,
    extra,
    baseHeight: oh,
    totalHeight,
    oy,
    ow,
  };
}

/**
 * Прямоугольник ячейки в % экрана (корень tableau).
 * Учитывает column_gap / row_gap, row_heights и offset_top моста.
 * @param {object} [metrics] — результат resolveOverlayRowMetrics (чтобы не считать повторно).
 */
export function cellRect(overlay, cell, metrics = null) {
  const m = metrics || resolveOverlayRowMetrics(overlay);
  const ox = Number(overlay?.x) || 0;
  const col = clampInt(cell?.col, 0, m.cols - 1, 0);
  const row = clampInt(cell?.row, 0, m.rows - 1, 0);
  const span = clampInt(cell?.col_span, 1, m.cols - col, 1);

  const cellW = (m.ow - m.columnGap * Math.max(0, m.cols - 1)) / m.cols;
  const left = ox + col * (cellW + m.columnGap);
  let top = m.oy;
  for (let i = 0; i < row; i += 1) {
    top += m.rowHeights[i] + m.rowGap;
  }
  const height = m.rowHeights[row];
  const width = cellW * span + m.columnGap * Math.max(0, span - 1);
  return {
    left,
    top,
    width,
    height,
    cx: left + width / 2,
    cy: top + height / 2,
    bottom: top + height,
    right: left + width,
  };
}

/**
 * Прямоугольник видимого блока внутри ячейки (content_width/height + align).
 * У моста сверху резервируется offset_top.
 * @param {object} [metrics] — результат resolveOverlayRowMetrics (чтобы не считать повторно).
 */
export function cellContentRect(overlay, cell, metrics = null) {
  const m = metrics || resolveOverlayRowMetrics(overlay);
  const rect = cellRect(overlay, cell, m);
  const isBridge = cell?.role === 'bridge';
  const extra = isBridge ? m.extra : 0;
  const offsetTop = extra;
  const innerTop = rect.top + Math.min(offsetTop, Math.max(0, rect.height - 0.5));
  const innerHeight = Math.max(0.5, rect.bottom - innerTop);
  const cw = clampFloat(cell?.content_width, 20, 100, 100) / 100;
  const ch = clampFloat(cell?.content_height, 20, 100, 100) / 100;
  const width = rect.width * cw;
  const height = innerHeight * ch;
  const alignX = pickChoice(cell?.align_x, DEMO_TABLEAU_CELL_ALIGNS, 'center');
  const alignY = pickChoice(cell?.align_y, DEMO_TABLEAU_CELL_ALIGNS, 'center');
  const left = rect.left + alignOffset(alignX, rect.width - width);
  const top = innerTop + alignOffset(alignY, innerHeight - height);
  return {
    left,
    top,
    width,
    height,
    cx: left + width / 2,
    cy: top + height / 2,
    bottom: top + height,
    right: left + width,
  };
}

/** CSS-стиль абсолютной CSS-grid рамки overlay. */
export function overlayGridStyle(overlay) {
  if (!overlay) return undefined;
  const metrics = resolveOverlayRowMetrics(overlay);
  const frameW = Math.max(0.01, metrics.ow);
  const frameH = Math.max(0.01, metrics.totalHeight);
  // column_gap/row_gap — % рамки overlay; CSS gap — % самой сетки
  return {
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    height: `${metrics.totalHeight}%`,
    columnGap: `${(metrics.columnGap / frameW) * 100}%`,
    rowGap: `${(metrics.rowGap / frameH) * 100}%`,
    gridTemplateColumns: `repeat(${metrics.cols}, 1fr)`,
    gridTemplateRows: metrics.rowHeights.map((h) => `${Math.max(h, 0.01)}fr`).join(' '),
  };
}

/** Доля offset_top от высоты ячейки моста (для CSS-спейсера). */
export function bridgeSpacerPercent(overlay, cell) {
  if (!cell || cell.role !== 'bridge') return 0;
  const offsetTop = clampFloat(cell.offset_top, 0, 40, 0);
  if (offsetTop <= 0) return 0;
  const metrics = resolveOverlayRowMetrics(overlay);
  const rect = cellRect(overlay, cell, metrics);
  if (!rect.height) return 0;
  return Math.min(95, (offsetTop / rect.height) * 100);
}

/** CSS justify/align для содержимого ячейки. */
export function cellAlignStyle(cell) {
  const map = { start: 'flex-start', center: 'center', end: 'flex-end' };
  const alignX = pickChoice(cell?.align_x, DEMO_TABLEAU_CELL_ALIGNS, 'center');
  const alignY = pickChoice(cell?.align_y, DEMO_TABLEAU_CELL_ALIGNS, 'center');
  return {
    justifyContent: map[alignX] || 'center',
    alignItems: map[alignY] || 'center',
  };
}

function polylineVertical(x, y1, y2) {
  return [{ x, y: y1 }, { x, y: y2 }];
}

/** L: низ карточки → вниз до cy моста → в боковую грань моста. */
function polylineLDownThenSide(fromX, fromY, bridgeRect) {
  const sideX = fromX < bridgeRect.left
    ? bridgeRect.left
    : fromX > bridgeRect.right
      ? bridgeRect.right
      : bridgeRect.cx;
  if (Math.abs(fromX - sideX) < 0.15) {
    return polylineVertical(fromX, fromY, bridgeRect.top);
  }
  let cornerY = bridgeRect.cy;
  if (cornerY <= fromY) {
    cornerY = bridgeRect.top;
  }
  if (cornerY <= fromY) {
    cornerY = fromY + 0.5;
  }
  return [
    { x: fromX, y: fromY },
    { x: fromX, y: cornerY },
    { x: sideX, y: cornerY },
  ];
}

/**
 * Ортогональные стрелки overlay: карточки → мост, мост → карта.
 * @returns {{ id, points: {x,y}[], line, width, color, head, kind }[]}
 */
export function buildTableauOverlayArrows(overlay, mapFrame = DEMO_TABLEAU_MAP_FRAME) {
  if (!overlay?.cells?.length) return [];
  const style = overlay.map_arrow || DEMO_DEFAULT_TABLEAU_OVERLAY.map_arrow;
  const metrics = resolveOverlayRowMetrics(overlay);
  const bridge = overlay.cells.find((c) => c.role === 'bridge');
  const cards = overlay.cells.filter((c) => c.role === 'card' && c.block_id);
  const result = [];

  if (bridge) {
    const bridgeRect = cellContentRect(overlay, bridge, metrics);
    cards.forEach((card) => {
      const rect = cellContentRect(overlay, card, metrics);
      const fromX = rect.cx;
      const fromY = rect.bottom;
      let points;
      if (fromX >= bridgeRect.left && fromX <= bridgeRect.right) {
        points = polylineVertical(fromX, fromY, bridgeRect.top);
      } else {
        points = polylineLDownThenSide(fromX, fromY, bridgeRect);
      }
      result.push({
        id: `arrow-card-${card.id}`,
        kind: 'card',
        points,
        line: style.line,
        width: style.width,
        color: style.color,
        head: style.head,
      });
    });

    const inset = clampFloat(style.inset, 0, 40, 14);
    const mapTop = Number(mapFrame?.top) || DEMO_TABLEAU_MAP_FRAME.top;
    const mapHeight = Number(mapFrame?.height) || DEMO_TABLEAU_MAP_FRAME.height;
    const tipY = mapTop + (mapHeight * inset) / 100 + metrics.extra;
    result.push({
      id: 'arrow-bridge-map',
      kind: 'bridge',
      points: polylineVertical(bridgeRect.cx, bridgeRect.bottom, tipY),
      line: style.line,
      width: style.width,
      color: style.color,
      head: style.head,
    });
  }

  return result;
}

/** Середина ребра placement (x/y — центр блока). */
export function placementEdgePoint(placement, edge, size = null) {
  if (!placement) return { x: 50, y: 50 };
  const w = size?.width ?? placement.width ?? 22;
  const h = size?.height ?? placement.height ?? 28;
  const x = Number(placement.x) || 0;
  const y = Number(placement.y) || 0;
  switch (edge) {
    case 'top':
      return { x, y: y - h / 2 };
    case 'bottom':
      return { x, y: y + h / 2 };
    case 'left':
      return { x: x - w / 2, y };
    case 'right':
      return { x: x + w / 2, y };
    default:
      return { x, y: y + h / 2 };
  }
}

/** Точка map_anchor на рамке карты в % сцены. */
export function mapAnchorPoint(anchor, frame = DEMO_TABLEAU_MAP_FRAME) {
  const t = clampFloat(anchor?.t, 0, 1, 0.5);
  const left = frame.left;
  const top = frame.top;
  const width = frame.width;
  const height = frame.height;
  switch (anchor?.edge) {
    case 'top':
      return { x: left + t * width, y: top };
    case 'bottom':
      return { x: left + t * width, y: top + height };
    case 'left':
      return { x: left, y: top + t * height };
    case 'right':
      return { x: left + width, y: top + t * height };
    default:
      return { x: left + t * width, y: top + height };
  }
}

/**
 * Ближайшая точка на периметре рамки карты.
 * @returns {{ edge: string, t: number, x: number, y: number }}
 */
export function snapPointToMapFrame(px, py, frame = DEMO_TABLEAU_MAP_FRAME) {
  const left = frame.left;
  const top = frame.top;
  const width = Math.max(frame.width, 0.001);
  const height = Math.max(frame.height, 0.001);
  const right = left + width;
  const bottom = top + height;
  const cx = clampFloat(px, left, right, left);
  const cy = clampFloat(py, top, bottom, top);
  const candidates = [
    {
      edge: 'top',
      x: cx,
      y: top,
      t: (cx - left) / width,
      dist: Math.abs(py - top) + (px < left || px > right ? Math.min(Math.abs(px - left), Math.abs(px - right)) : 0),
    },
    {
      edge: 'bottom',
      x: cx,
      y: bottom,
      t: (cx - left) / width,
      dist: Math.abs(py - bottom) + (px < left || px > right ? Math.min(Math.abs(px - left), Math.abs(px - right)) : 0),
    },
    {
      edge: 'left',
      x: left,
      y: cy,
      t: (cy - top) / height,
      dist: Math.abs(px - left) + (py < top || py > bottom ? Math.min(Math.abs(py - top), Math.abs(py - bottom)) : 0),
    },
    {
      edge: 'right',
      x: right,
      y: cy,
      t: (cy - top) / height,
      dist: Math.abs(px - right) + (py < top || py > bottom ? Math.min(Math.abs(py - top), Math.abs(py - bottom)) : 0),
    },
  ];
  let best = candidates[0];
  candidates.forEach((item) => {
    if (item.dist < best.dist) best = item;
  });
  return {
    edge: best.edge,
    t: clampFloat(best.t, 0, 1, 0.5),
    x: best.x,
    y: best.y,
  };
}

function lerpPoint(a, b, t) {
  const u = clampFloat(t, 0, 1, 0.5);
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
  };
}

/** Центр элемента в % относительно root (после CSS transform). */
export function percentFromElement(el, root) {
  if (!el || !root) return null;
  const er = el.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  if (!rr.width || !rr.height) return null;
  return {
    x: ((er.left + er.width / 2) - rr.left) / rr.width * 100,
    y: ((er.top + er.height / 2) - rr.top) / rr.height * 100,
  };
}

/**
 * Углы карты в % родителя из DOM-маркеров { tl, tr, br, bl }.
 * @returns {{ tl, tr, br, bl } | null}
 */
export function readMapCornersFromElements(cornerEls, root) {
  if (!cornerEls || !root) return null;
  const tl = percentFromElement(cornerEls.tl, root);
  const tr = percentFromElement(cornerEls.tr, root);
  const br = percentFromElement(cornerEls.br, root);
  const bl = percentFromElement(cornerEls.bl, root);
  if (!tl || !tr || !br || !bl) return null;
  return { tl, tr, br, bl };
}

/** Точка map_anchor на видимых (возможно 3D) рёбрах карты. */
export function mapAnchorPointFromCorners(anchor, corners) {
  if (!corners?.tl || !corners?.tr || !corners?.br || !corners?.bl) {
    return mapAnchorPoint(anchor);
  }
  const t = clampFloat(anchor?.t, 0, 1, 0.5);
  switch (anchor?.edge) {
    case 'top':
      return lerpPoint(corners.tl, corners.tr, t);
    case 'right':
      return lerpPoint(corners.tr, corners.br, t);
    case 'bottom':
      return lerpPoint(corners.bl, corners.br, t);
    case 'left':
      return lerpPoint(corners.tl, corners.bl, t);
    default:
      return lerpPoint(corners.bl, corners.br, t);
  }
}

/**
 * Ближайшая точка на периметре видимого планшета (по измеренным углам).
 * @returns {{ edge: string, t: number, x: number, y: number } | null}
 */
export function snapPointToMapCorners(px, py, corners) {
  if (!corners?.tl || !corners?.tr || !corners?.br || !corners?.bl) {
    return snapPointToMapFrame(px, py);
  }
  const edges = [
    { edge: 'top', a: corners.tl, b: corners.tr },
    { edge: 'right', a: corners.tr, b: corners.br },
    { edge: 'bottom', a: corners.bl, b: corners.br },
    { edge: 'left', a: corners.tl, b: corners.bl },
  ];
  let best = null;
  edges.forEach(({ edge, a, b }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = clampFloat(t, 0, 1, 0.5);
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const dist = Math.hypot(px - x, py - y);
    if (!best || dist < best.dist) {
      best = { edge, t, x, y, dist };
    }
  });
  return {
    edge: best.edge,
    t: best.t,
    x: best.x,
    y: best.y,
  };
}

export function resolveTableauArrowEndpoints(
  placement,
  blockEdge,
  anchor,
  frameOrCorners = DEMO_TABLEAU_MAP_FRAME,
  size = null,
) {
  const from = placementEdgePoint(placement, blockEdge, size);
  const looksLikeCorners = frameOrCorners
    && frameOrCorners.tl
    && frameOrCorners.tr
    && frameOrCorners.br
    && frameOrCorners.bl;
  const to = looksLikeCorners
    ? mapAnchorPointFromCorners(anchor, frameOrCorners)
    : mapAnchorPoint(anchor, frameOrCorners);
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
}

/** Legacy cards[] → block + placement (title + items as text). */
function legacyCardToBlockAndPlacement(card, index) {
  const data = card && typeof card === 'object' ? card : {};
  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim()
    : `Блок ${index + 1}`;
  const items = Array.isArray(data.items) ? data.items : [];
  const lines = [title, ...items.map((item) => `• ${item}`)];
  const content = lines.join('\n');
  const cardKey = data.id != null && String(data.id).trim()
    ? String(data.id).trim()
    : String(index);
  const blockId = `legacy-block-${cardKey}`.slice(0, 80);
  const block = normalizeTableauBlock({
    id: blockId,
    title,
    width: 22,
    height: 28,
    border_radius_px: 12,
    elements: [{
      type: 'text',
      id: `legacy-text-${index}`,
      content,
      x: 8,
      y: 8,
      w: 84,
      h: 84,
      style: {
        font_size: 14,
        font_weight: 600,
        text_align: 'left',
        color: '#f8fafc',
      },
    }],
  }, index);
  const placement = normalizeTableauPlacement({
    id: `legacy-place-${cardKey}`.slice(0, 80),
    block_id: blockId,
    x: data.x ?? 20,
    y: data.y ?? 12,
    width: 22,
    height: 28,
  }, index, new Set([blockId]));
  return { block, placement };
}

export function normalizeTableauGalleryBand(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const def = DEMO_DEFAULT_TABLEAU_GALLERY.band;
  return {
    x: clampFloat(data.x, 0, 92, def.x),
    y: clampFloat(data.y, 0, 90, def.y),
    width: clampFloat(data.width, 12, 100, def.width),
    height: clampFloat(data.height, 10, 90, def.height),
  };
}

export function normalizeTableauGalleryImage(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalTableauId('gimg', index);
  const src = typeof data.src === 'string' ? data.src.trim().slice(0, 2000) : '';
  const title = typeof data.title === 'string' ? data.title.trim().slice(0, 120) : '';
  const restRaw = data.rest && typeof data.rest === 'object' ? data.rest : {};
  return {
    id,
    src,
    title,
    target_id: optionalTableauId(data.target_id),
    rest: {
      x: clampFloat(restRaw.x, 0, 100, 10 + (index % 3) * 24),
      y: clampFloat(restRaw.y, 0, 100, 10 + Math.floor(index / 3) * 28),
      w: clampFloat(restRaw.w, 4, 100, 22),
      h: clampFloat(restRaw.h, 4, 100, 28),
    },
  };
}

export function normalizeTableauGallery(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const images = [];
  const seen = new Set();
  (Array.isArray(data.images) ? data.images : []).slice(0, DEMO_TABLEAU_GALLERY_MAX_IMAGES)
    .forEach((item, index) => {
      const image = normalizeTableauGalleryImage(item, index);
      if (!image.src) return;
      if (seen.has(image.id)) {
        image.id = makeLocalTableauId('gimg', index);
      }
      seen.add(image.id);
      images.push(image);
    });
  return {
    show_map: data.show_map === undefined ? true : Boolean(data.show_map),
    stagger_ms: clampInt(data.stagger_ms, 0, 8000, DEMO_DEFAULT_TABLEAU_GALLERY.stagger_ms),
    enter_ms: clampInt(data.enter_ms, 120, 2000, DEMO_DEFAULT_TABLEAU_GALLERY.enter_ms),
    hold_ms: clampInt(data.hold_ms, 0, 8000, DEMO_DEFAULT_TABLEAU_GALLERY.hold_ms),
    exit_ms: clampInt(data.exit_ms, 80, 2000, DEMO_DEFAULT_TABLEAU_GALLERY.exit_ms),
    enter_effect: pickChoice(
      data.enter_effect,
      Object.values(DEMO_TABLEAU_GALLERY_ENTER),
      DEMO_DEFAULT_TABLEAU_GALLERY.enter_effect,
    ),
    exit_effect: pickChoice(
      data.exit_effect,
      Object.values(DEMO_TABLEAU_GALLERY_EXIT),
      DEMO_DEFAULT_TABLEAU_GALLERY.exit_effect,
    ),
    settle: pickChoice(
      data.settle,
      Object.values(DEMO_TABLEAU_GALLERY_SETTLE),
      DEMO_DEFAULT_TABLEAU_GALLERY.settle,
    ),
    settle_ms: clampInt(data.settle_ms, 0, 3000, DEMO_DEFAULT_TABLEAU_GALLERY.settle_ms),
    band: normalizeTableauGalleryBand(data.band),
    gap_pct: clampFloat(data.gap_pct, 0, 8, DEMO_DEFAULT_TABLEAU_GALLERY.gap_pct),
    overlap_offset_pct: clampFloat(
      data.overlap_offset_pct,
      0.5,
      16,
      DEMO_DEFAULT_TABLEAU_GALLERY.overlap_offset_pct,
    ),
    overlap_rotate_deg: clampFloat(
      data.overlap_rotate_deg,
      0,
      12,
      DEMO_DEFAULT_TABLEAU_GALLERY.overlap_rotate_deg,
    ),
    images,
  };
}

export function normalizeTableauNetwork(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const rawLogos = Array.isArray(data.logos) ? data.logos : [];
  return {
    logos: Array.from({ length: 3 }, (_, index) => {
      const logo = rawLogos[index] && typeof rawLogos[index] === 'object' ? rawLogos[index] : {};
      return {
        src: typeof logo.src === 'string' ? logo.src.trim().slice(0, 2000) : '',
        title: typeof logo.title === 'string' ? logo.title.trim().slice(0, 120) : '',
      };
    }),
  };
}

export function isTableauGalleryPreset(preset) {
  return preset?.variant === DEMO_TABLEAU_VARIANT.GALLERY;
}

export function galleryImageTargetIds(gallery) {
  const ids = [];
  const seen = new Set();
  (gallery?.images || []).forEach((image) => {
    const id = image?.target_id != null ? String(image.target_id).trim() : '';
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

export function tableauGalleryDurationMs(gallery) {
  const images = gallery?.images || [];
  if (!images.length) return DEMO_DEFAULT_STEP_DURATION_MS;
  const stagger = gallery.stagger_ms ?? DEMO_DEFAULT_TABLEAU_GALLERY.stagger_ms;
  const enter = gallery.enter_ms ?? DEMO_DEFAULT_TABLEAU_GALLERY.enter_ms;
  const hold = gallery.hold_ms ?? DEMO_DEFAULT_TABLEAU_GALLERY.hold_ms;
  const settle = gallery.settle_ms ?? DEMO_DEFAULT_TABLEAU_GALLERY.settle_ms;
  return Math.max(
    DEMO_DEFAULT_STEP_DURATION_MS,
    (images.length - 1) * stagger + enter + hold + settle,
  );
}

export function mosaicScreenHasVideo(screen) {
  return screen?.content_type === DEMO_MOSAIC_CONTENT.VIDEO && Boolean(screen.video_url);
}

export function mosaicScreenGridStageId(screen) {
  if (screen?.content_type === DEMO_MOSAIC_CONTENT.IMAGE) return null;
  if (screen?.stage_id == null || screen.stage_id === '') return null;
  return String(screen.stage_id);
}

export function mosaicScreenExpandStageId(screen) {
  if (screen?.content_type === DEMO_MOSAIC_CONTENT.IMAGE) return null;
  if (screen?.expand_stage_id != null && String(screen.expand_stage_id).trim()) {
    return String(screen.expand_stage_id).trim();
  }
  return mosaicScreenGridStageId(screen);
}

export function mosaicScreenStageIds(screen) {
  const ids = [];
  const seen = new Set();
  [mosaicScreenGridStageId(screen), mosaicScreenExpandStageId(screen)].forEach((id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

export function normalizeTableauPreset(raw, allowedBlockIds = null) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const id = data.id != null && String(data.id).trim()
    ? String(data.id).trim().slice(0, 80)
    : makeLocalPresetId();
  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim().slice(0, 120)
    : 'Художественный';
  const stageId = optionalTableauId(data.stage_id);

  let placementsRaw = Array.isArray(data.placements) ? [...data.placements] : [];
  let arrowsRaw = Array.isArray(data.arrows) ? [...data.arrows] : [];
  let anchorsRaw = Array.isArray(data.map_anchors) ? [...data.map_anchors] : [];
  const legacyCards = Array.isArray(data.cards) ? data.cards : [];

  const migratedBlocks = [];
  if (!placementsRaw.length && legacyCards.length) {
    legacyCards.slice(0, 24).forEach((card, index) => {
      if (!card || typeof card !== 'object') return;
      const { block, placement } = legacyCardToBlockAndPlacement(card, index);
      migratedBlocks.push(block);
      placementsRaw.push(placement);
      const anchorId = `legacy-anchor-${index}`;
      anchorsRaw.push({
        id: anchorId,
        edge: 'bottom',
        t: clampFloat(0.35 + (index % 4) * 0.12, 0, 1, 0.5),
      });
      arrowsRaw.push({
        id: `legacy-arrow-${index}`,
        placement_id: placement.id,
        block_edge: 'bottom',
        map_anchor_id: anchorId,
        line: 'dashed',
        width: 1.5,
        color: 'rgba(248,250,252,0.88)',
        head: 'end',
      });
    });
  }

  const blockIds = new Set(allowedBlockIds || []);
  migratedBlocks.forEach((block) => blockIds.add(block.id));
  const blockIdFilter = blockIds.size ? blockIds : null;

  const placements = [];
  const seenP = new Set();
  placementsRaw.slice(0, 24).forEach((item, index) => {
    const placement = normalizeTableauPlacement(item, index, blockIdFilter);
    if (seenP.has(placement.id)) {
      placement.id = makeLocalTableauId('place', index);
    }
    seenP.add(placement.id);
    placements.push(placement);
  });
  const placementIds = new Set(placements.map((item) => item.id));

  const mapAnchors = [];
  const seenAnchors = new Set();
  anchorsRaw.slice(0, 48).forEach((item, index) => {
    const anchor = normalizeTableauMapAnchor(item, index);
    if (seenAnchors.has(anchor.id)) {
      anchor.id = makeLocalTableauId('anchor', index);
    }
    seenAnchors.add(anchor.id);
    mapAnchors.push(anchor);
  });
  const anchorIds = new Set(mapAnchors.map((item) => item.id));

  const arrows = [];
  const seenA = new Set();
  arrowsRaw.slice(0, 40).forEach((item, index) => {
    const arrow = normalizeTableauArrow(item, index);
    if (!arrow.placement_id || !placementIds.has(arrow.placement_id)) return;
    if (!arrow.map_anchor_id || !anchorIds.has(arrow.map_anchor_id)) return;
    if (seenA.has(arrow.id)) {
      arrow.id = makeLocalTableauId('arrow', index);
    }
    seenA.add(arrow.id);
    arrows.push(arrow);
  });

  return {
    id,
    title,
    cue: normalizeCue(data.cue),
    stage_id: stageId,
    variant: pickChoice(
      data.variant,
      Object.values(DEMO_TABLEAU_VARIANT),
      DEMO_TABLEAU_VARIANT.TABLET,
    ),
    gallery: normalizeTableauGallery(data.gallery),
    network: normalizeTableauNetwork(data.network),
    scanner: normalizeScanner(data.scanner),
    tilt: normalizeTableauTilt(data.tilt),
    border_radius_px: clampInt(
      data.border_radius_px,
      0,
      48,
      DEMO_DEFAULT_TABLEAU_BORDER_RADIUS,
    ),
    tilt_ms: clampInt(data.tilt_ms, 200, 5000, DEMO_DEFAULT_TABLEAU_TILT_MS),
    untilt_ms: clampInt(data.untilt_ms, 200, 5000, DEMO_DEFAULT_TABLEAU_UNTILT_MS),
    caption: normalizeTableauCaption(data.caption),
    card_stagger_ms: clampInt(data.card_stagger_ms, 0, 10_000, 350),
    arrow_draw_ms: clampInt(data.arrow_draw_ms, 100, 10_000, 900),
    camera: normalizeTableauCamera(data.camera),
    map_reveal: normalizeTableauMapReveal(data.map_reveal),
    overlay: data.overlay != null
      ? normalizeTableauOverlay(data.overlay, blockIdFilter)
      : migratePlacementsToOverlay(placements, blockIdFilter),
    placements,
    map_anchors: mapAnchors,
    arrows,
    _migrated_blocks: migratedBlocks,
  };
}

export function normalizeScenarioTableau(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const blocks = [];
  const seenBlocks = new Set();
  (Array.isArray(data.blocks) ? data.blocks : []).slice(0, 48).forEach((item, index) => {
    const block = normalizeTableauBlock(item, index);
    if (seenBlocks.has(block.id)) {
      block.id = makeLocalTableauId('block', index);
    }
    seenBlocks.add(block.id);
    blocks.push(block);
  });

  const seen = new Set();
  const presets = [];
  (Array.isArray(data.presets) ? data.presets : []).forEach((item) => {
    const preset = normalizeTableauPreset(item, seenBlocks);
    const migrated = preset._migrated_blocks || [];
    delete preset._migrated_blocks;
    migrated.forEach((block) => {
      if (!seenBlocks.has(block.id)) {
        seenBlocks.add(block.id);
        blocks.push(block);
      }
    });
    if (migrated.length) {
      preset.placements = (preset.placements || []).map((placement, index) => (
        normalizeTableauPlacement(placement, index, seenBlocks)
      ));
    }
    if (seen.has(preset.id)) {
      preset.id = makeLocalPresetId();
    }
    seen.add(preset.id);
    presets.push(preset);
  });

  let active = data.active_preset_id != null && String(data.active_preset_id).trim()
    ? String(data.active_preset_id).trim().slice(0, 80)
    : null;
  if (active && !seen.has(active)) {
    active = presets[0]?.id || null;
  } else if (!active && presets.length) {
    active = presets[0].id;
  }
  return { presets, active_preset_id: active, blocks };
}

export function createDefaultTableauPreset(overrides = {}) {
  const preset = normalizeTableauPreset({
    id: makeLocalPresetId(),
    title: 'Художественный',
    stage_id: null,
    variant: DEMO_TABLEAU_VARIANT.TABLET,
    gallery: { ...DEMO_DEFAULT_TABLEAU_GALLERY, images: [] },
    network: { ...DEMO_DEFAULT_TABLEAU_NETWORK, logos: DEMO_DEFAULT_TABLEAU_NETWORK.logos.map((logo) => ({ ...logo })) },
    tilt: { ...DEMO_DEFAULT_TABLEAU_TILT },
    border_radius_px: DEMO_DEFAULT_TABLEAU_BORDER_RADIUS,
    tilt_ms: DEMO_DEFAULT_TABLEAU_TILT_MS,
    untilt_ms: DEMO_DEFAULT_TABLEAU_UNTILT_MS,
    caption: { ...DEMO_DEFAULT_TABLEAU_CAPTION },
    card_stagger_ms: 350,
    arrow_draw_ms: 900,
    camera: { ...DEMO_DEFAULT_TABLEAU_CAMERA },
    map_reveal: { ...DEMO_DEFAULT_TABLEAU_MAP_REVEAL },
    overlay: { ...DEMO_DEFAULT_TABLEAU_OVERLAY, cells: DEMO_DEFAULT_TABLEAU_OVERLAY.cells.map((c) => ({ ...c })) },
    placements: [],
    map_anchors: [],
    arrows: [],
    ...overrides,
  });
  delete preset._migrated_blocks;
  return preset;
}

export function createDefaultTableauBlock(overrides = {}) {
  return normalizeTableauBlock({
    title: 'Блок',
    width: 22,
    height: 28,
    border_radius_px: 12,
    fill: { ...DEMO_DEFAULT_TABLEAU_BLOCK_FILL },
    border: { ...DEMO_DEFAULT_TABLEAU_BLOCK_BORDER },
    elements: [],
    ...overrides,
  });
}

export function createDefaultTableauPlacement(overrides = {}) {
  return normalizeTableauPlacement({
    block_id: null,
    x: 20,
    y: 14,
    width: null,
    height: null,
    ...overrides,
  });
}

export function createDefaultTableauArrow(overrides = {}) {
  return normalizeTableauArrow({
    placement_id: null,
    block_edge: DEMO_DEFAULT_TABLEAU_ARROW.block_edge,
    map_anchor_id: null,
    line: DEMO_DEFAULT_TABLEAU_ARROW.line,
    width: DEMO_DEFAULT_TABLEAU_ARROW.width,
    color: DEMO_DEFAULT_TABLEAU_ARROW.color,
    head: DEMO_DEFAULT_TABLEAU_ARROW.head,
    ...overrides,
  });
}

export function createDefaultTableauMapAnchor(overrides = {}) {
  return normalizeTableauMapAnchor({
    edge: 'bottom',
    t: 0.5,
    ...overrides,
  });
}

export function createDefaultTableauTextElement(overrides = {}) {
  return normalizeTableauElement({
    type: 'text',
    content: '',
    x: 8,
    y: 8,
    w: 84,
    h: 20,
    ...overrides,
  });
}

export function createDefaultTableauImageElement(overrides = {}) {
  return normalizeTableauElement({
    type: 'image',
    src: '',
    x: 8,
    y: 8,
    w: 84,
    h: 40,
    ...overrides,
  });
}

export function findTableauPreset(tableau, presetId) {
  if (presetId == null) return null;
  const key = String(presetId);
  return (tableau?.presets || []).find((preset) => String(preset.id) === key) || null;
}

export function findTableauBlock(blocks, id) {
  if (id == null) return null;
  const key = String(id);
  const list = Array.isArray(blocks) ? blocks : (blocks?.blocks || []);
  return list.find((block) => String(block.id) === key) || null;
}

/**
 * Длительность/плавность/тип анимации слота для expand или collapse.
 * Поля блока программы (item) переопределяют пресет; пустые значения → пресет.
 */
export function resolveMosaicSlotTransition(preset, item, action) {
  const transitionFallback = clampInt(preset?.transition_ms, 200, 5000, 700);
  const presetAnim = pickChoice(
    preset?.expand_animation,
    Object.values(DEMO_MOSAIC_EXPAND_ANIMATION),
    DEMO_MOSAIC_EXPAND_ANIMATION.STRETCH,
  );
  const isCollapse = action === DEMO_MOSAIC_ACTION.COLLAPSE;
  const overrideAnim = item?.expand_animation != null && String(item.expand_animation).trim()
    ? pickChoice(
      item.expand_animation,
      Object.values(DEMO_MOSAIC_EXPAND_ANIMATION),
      null,
    )
    : null;
  const animation = overrideAnim || presetAnim;

  const overrideMsRaw = isCollapse ? item?.collapse_ms : item?.expand_ms;
  const hasOverrideMs = overrideMsRaw != null && Number(overrideMsRaw) > 0;
  const presetMs = isCollapse
    ? clampInt(preset?.collapse_ms, 200, 5000, transitionFallback)
    : clampInt(preset?.expand_ms, 200, 5000, transitionFallback);
  const durationMs = hasOverrideMs
    ? clampInt(overrideMsRaw, 200, 5000, presetMs)
    : presetMs;

  const easingIds = DEMO_EASINGS.map((entry) => entry.id);
  const overrideEasingRaw = isCollapse ? item?.collapse_easing : item?.expand_easing;
  const hasOverrideEasing = overrideEasingRaw != null && String(overrideEasingRaw).trim();
  const presetEasing = isCollapse
    ? pickChoice(preset?.collapse_easing, easingIds, 'ease_out')
    : pickChoice(preset?.expand_easing, easingIds, 'ease_out');
  const easing = hasOverrideEasing
    ? pickChoice(overrideEasingRaw, easingIds, presetEasing)
    : presetEasing;

  return {
    animation,
    durationMs,
    easing,
    cssEasing: DEMO_EASING_CSS[easing] || DEMO_EASING_CSS.ease_out,
  };
}

export function normalizeMosaicScreen(raw, slotId, defaultLabel = '') {
  const data = raw && typeof raw === 'object' ? raw : {};
  const selectionRaw = data.selection && typeof data.selection === 'object' ? data.selection : {};
  let label = typeof data.label === 'string' ? data.label.slice(0, 120) : '';
  if (!label) label = defaultLabel || DEMO_MOSAIC_SLOT_LABELS[slotId] || `Экран ${String(slotId).toUpperCase()}`;
  const stageId = data.stage_id != null && String(data.stage_id).trim()
    ? String(data.stage_id).trim().slice(0, 80)
    : null;
  let expandStageId = data.expand_stage_id != null && String(data.expand_stage_id).trim()
    ? String(data.expand_stage_id).trim().slice(0, 80)
    : null;
  if (expandStageId && stageId && expandStageId === stageId) expandStageId = null;
  return {
    id: slotId,
    label,
    cue: normalizeCue(data.cue),
    loop: Boolean(data.loop),
    stage_id: stageId,
    expand_stage_id: expandStageId,
    content_type: pickChoice(
      data.content_type,
      Object.values(DEMO_MOSAIC_CONTENT),
      DEMO_MOSAIC_CONTENT.STAGE,
    ),
    video_url: typeof data.video_url === 'string' && data.video_url.trim()
      ? data.video_url.trim().slice(0, 2000)
      : null,
    video_media_id: optionalTableauId(data.video_media_id),
    image_url: typeof data.image_url === 'string' && data.image_url.trim()
      ? data.image_url.trim().slice(0, 2000) : null,
    image_fit: pickChoice(data.image_fit, ['contain', 'cover'], 'contain'),
    camera: normalizeCamera(data.camera),
    selection: {
      target_ids: toIdList(selectionRaw.target_ids),
      event_ids: toIdList(selectionRaw.event_ids),
      situation_ids: toIdList(selectionRaw.situation_ids),
      zone_leaves: toZoneLeaves(selectionRaw.zone_leaves),
      overlay_layer_ids: toIdList(selectionRaw.overlay_layer_ids),
      country_isos: toIsoList(selectionRaw.country_isos),
      card_ids: toIdList(selectionRaw.card_ids),
    },
    text: normalizeText(data.text),
  };
}

export function normalizeMosaicPreset(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const layout = pickChoice(
    data.layout,
    DEMO_MOSAIC_LAYOUTS.map((item) => item.id),
    DEMO_MOSAIC_LAYOUT.GRID2,
  );
  const slotIds = getMosaicLayoutDef(layout).slots;
  const incoming = Array.isArray(data.screens) ? data.screens : [];
  const byId = {};
  incoming.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || '').trim().toLowerCase();
    if (slotIds.includes(id)) byId[id] = item;
  });
  if (!Object.keys(byId).length && Array.isArray(data.slots)) {
    data.slots.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id || '').trim().toLowerCase();
      if (slotIds.includes(id)) byId[id] = { id, label: item.label || '' };
    });
  }
  const id = typeof data.id === 'string' && data.id.trim()
    ? data.id.trim().slice(0, 80)
    : makeLocalPresetId();
  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.trim().slice(0, 120)
    : 'Мультиэкран';
  const transitionMs = clampInt(data.transition_ms, 200, 5000, 700);
  const easingIds = DEMO_EASINGS.map((item) => item.id);
  return {
    id,
    title,
    layout,
    transition_ms: transitionMs,
    expand_animation: pickChoice(
      data.expand_animation,
      Object.values(DEMO_MOSAIC_EXPAND_ANIMATION),
      DEMO_MOSAIC_EXPAND_ANIMATION.STRETCH,
    ),
    expand_ms: clampInt(data.expand_ms, 200, 5000, transitionMs),
    collapse_ms: clampInt(data.collapse_ms, 200, 5000, transitionMs),
    expand_easing: pickChoice(data.expand_easing, easingIds, 'ease_out'),
    collapse_easing: pickChoice(data.collapse_easing, easingIds, 'ease_out'),
    reveal: pickChoice(data.reveal, Object.values(DEMO_MOSAIC_REVEAL), DEMO_MOSAIC_REVEAL.ALL),
    stagger_ms: clampInt(data.stagger_ms, 0, 10_000, 400),
    expandable_slots: normalizeExpandableSlots(data.expandable_slots, slotIds),
    screens: slotIds.map((slotId) => normalizeMosaicScreen(
      byId[slotId],
      slotId,
      DEMO_MOSAIC_SLOT_LABELS[slotId],
    )),
  };
}

export function normalizeScenarioMosaic(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  if (Array.isArray(data.presets) || Object.prototype.hasOwnProperty.call(data, 'active_preset_id')) {
    const seen = new Set();
    const presets = (data.presets || []).map((item) => {
      const preset = normalizeMosaicPreset(item);
      if (seen.has(preset.id)) preset.id = makeLocalPresetId();
      seen.add(preset.id);
      return preset;
    });
    let active = data.active_preset_id ? String(data.active_preset_id).trim().slice(0, 80) : null;
    if (active && !seen.has(active)) active = presets[0]?.id || null;
    else if (!active && presets.length) active = presets[0].id;
    return { presets, active_preset_id: active };
  }

  if (data.layout || data.slots || data.enabled != null) {
    const legacy = normalizeMosaicPreset({
      id: 'legacy-default',
      title: 'Мультиэкран',
      layout: data.layout || DEMO_MOSAIC_LAYOUT.GRID2,
      transition_ms: data.transition_ms,
      reveal: DEMO_MOSAIC_REVEAL.ALL,
      slots: data.slots || [],
    });
    const keep = Boolean(data.enabled || data.slots?.length);
    return {
      presets: keep ? [legacy] : [],
      active_preset_id: data.enabled ? legacy.id : (keep ? legacy.id : null),
    };
  }

  return { presets: [], active_preset_id: null };
}

export function normalizeStepMosaic() {
  return { slot: null, loop: false, label: '' };
}

export function findMosaicPreset(mosaic, presetId) {
  const library = normalizeScenarioMosaic(mosaic);
  if (!library.presets.length) return null;
  return library.presets.find((item) => item.id === presetId)
    || library.presets.find((item) => item.id === library.active_preset_id)
    || library.presets[0]
    || null;
}

function toIdList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  raw.forEach((item) => {
    if (item == null) return;
    const key = String(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(key);
  });
  return result;
}

function toIsoList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  raw.forEach((item) => {
    if (item == null) return;
    const key = String(item).trim().toUpperCase();
    if (!key || key.length > 3 || seen.has(key)) return;
    seen.add(key);
    result.push(key);
  });
  return result;
}

function toZoneLeaves(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  raw.forEach((item) => {
    if (!item || item.country == null || item.action_type_id == null) return;
    const entry = {
      country: String(item.country),
      action_type_id: String(item.action_type_id),
      leaf: String(item.leaf || ZONE_LEAF_MANUAL),
    };
    const key = `${entry.country}\u0001${entry.action_type_id}\u0001${entry.leaf}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(entry);
  });
  return result;
}

export function normalizeCamera(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  return {
    mode: pickChoice(data.mode, Object.values(DEMO_CAMERA_MODE), DEMO_CAMERA_MODE.NONE),
    lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
    lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
    zoom: clampInt(data.zoom, 1, 20, 8),
    duration_ms: clampInt(data.duration_ms, 0, 60_000, 1500),
    ease_linearity: clampFloat(data.ease_linearity, 0.05, 1, 0.3),
    padding: clampInt(data.padding, 0, 400, 72),
  };
}

export function normalizeTableauMapReveal(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const minGap = clampInt(
    data.spawn_gap_min_ms,
    0,
    1000,
    DEMO_DEFAULT_TABLEAU_MAP_REVEAL.spawn_gap_min_ms,
  );
  const maxGap = clampInt(
    data.spawn_gap_max_ms,
    0,
    1000,
    DEMO_DEFAULT_TABLEAU_MAP_REVEAL.spawn_gap_max_ms,
  );
  return {
    lifetime_ms: clampInt(
      data.lifetime_ms,
      500,
      60_000,
      DEMO_DEFAULT_TABLEAU_MAP_REVEAL.lifetime_ms,
    ),
    spawn_gap_min_ms: Math.min(minGap, maxGap),
    spawn_gap_max_ms: Math.max(minGap, maxGap),
  };
}

/** Камера пресета: по умолчанию fly_to без координат. */
export function normalizeTableauCamera(raw) {
  const camera = normalizeCamera({
    ...DEMO_DEFAULT_TABLEAU_CAMERA,
    ...(raw && typeof raw === 'object' ? raw : {}),
    mode: DEMO_CAMERA_MODE.FLY_TO,
  });
  return { ...camera, mode: DEMO_CAMERA_MODE.FLY_TO };
}

export function normalizeSelection(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  let mosaicAction = null;
  if (data.mosaic_action != null && String(data.mosaic_action).trim()) {
    mosaicAction = pickChoice(
      String(data.mosaic_action).trim(),
      Object.values(DEMO_MOSAIC_ACTION),
      DEMO_MOSAIC_ACTION.SHOW_GRID,
    );
  }
  let presetId = data.preset_id != null ? String(data.preset_id).trim().slice(0, 80) : null;
  if (!presetId) presetId = null;
  let slot = null;
  if (data.slot != null && String(data.slot).trim()) {
    const candidate = String(data.slot).trim().toLowerCase();
    if (['a', 'b', 'c', 'd', 'e', 'f'].includes(candidate)) slot = candidate;
  }
  return {
    target_ids: toIdList(data.target_ids),
    event_ids: toIdList(data.event_ids),
    situation_ids: toIdList(data.situation_ids),
    zone_leaves: toZoneLeaves(data.zone_leaves),
    overlay_layer_ids: toIdList(data.overlay_layer_ids),
    country_isos: toIsoList(data.country_isos),
    card_ids: toIdList(data.card_ids),
    mosaic_action: mosaicAction,
    preset_id: presetId,
    slot,
  };
}

export function normalizeAnimation(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const cycle = data.state_cycle && typeof data.state_cycle === 'object' ? data.state_cycle : {};
  const effect = pickChoice(data.effect, Object.values(DEMO_EFFECT), DEMO_EFFECT.NONE);
  const continuousDefault = isContinuousByDefault(effect);
  return {
    effect,
    direction: pickChoice(data.direction, DEMO_DIRECTIONS.map((item) => item.id), 'left'),
    duration_ms: clampInt(data.duration_ms, 0, 60_000, 1200),
    delay_ms: clampInt(data.delay_ms, 0, 60_000, 0),
    easing: pickChoice(data.easing, DEMO_EASINGS.map((item) => item.id), 'ease_out'),
    repeat: clampInt(data.repeat, 0, 100, 0),
    continuous: Object.prototype.hasOwnProperty.call(data, 'continuous')
      ? toBool(data.continuous, continuousDefault)
      : continuousDefault,
    state_cycle: {
      per_state_ms: clampInt(cycle.per_state_ms, 200, 60_000, 1800),
      cross_fade_ms: clampInt(cycle.cross_fade_ms, 0, 20_000, 600),
      order: pickChoice(cycle.order, ['old_to_new', 'new_to_old'], 'old_to_new'),
    },
  };
}

/** Безопасные CSS-цвета: #hex, rgb/rgba/hsl/hsla, ключевое слово. */
const COLOR_RE = /^(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg]+\s*\)|[a-zA-Z]{3,20})$/;

function pickColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 32 || !COLOR_RE.test(cleaned)) return fallback;
  return cleaned;
}

export const DEMO_TEXT_STYLE_DEFAULTS = {
  font_family: 'Roboto',
  font_size: 32,
  font_weight: 700,
  italic: false,
  underline: false,
  line_height: 1.2,
  letter_spacing: 0,
  text_align: 'center',
  rotation: 0,
  opacity: 1,
  color: '#ffffff',
  gradient: { enabled: false, from: '#ffffff', to: '#4da3ff', angle: 90 },
  stroke: { enabled: false, color: '#0b1a2b', width: 2 },
  background: { enabled: false, color: '#0b1a2b', opacity: 0.6, radius: 8, padding: 12 },
  shadow: { enabled: false, color: 'rgba(0,0,0,0.55)', blur: 12, x: 0, y: 2 },
  scale_with_map: false,
};

export const DEMO_TEXT_ENTER_DEFAULTS = {
  effect: 'fade',
  direction: 'bottom',
  duration_ms: 600,
  delay_ms: 0,
  easing: 'ease_out',
};

export const DEMO_TEXT_EXIT_DEFAULTS = {
  effect: 'fade',
  direction: 'top',
  duration_ms: 400,
  delay_ms: 0,
  easing: 'ease_out',
};

function normalizeTextStyle(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const defaults = DEMO_TEXT_STYLE_DEFAULTS;
  const gradient = data.gradient && typeof data.gradient === 'object' ? data.gradient : {};
  const stroke = data.stroke && typeof data.stroke === 'object' ? data.stroke : {};
  const background = data.background && typeof data.background === 'object' ? data.background : {};
  const shadow = data.shadow && typeof data.shadow === 'object' ? data.shadow : {};

  const rawWeight = clampInt(data.font_weight, 100, 900, defaults.font_weight);
  const weight = DEMO_TEXT_WEIGHTS
    .map((item) => item.id)
    .reduce((best, item) => (Math.abs(item - rawWeight) < Math.abs(best - rawWeight) ? item : best));

  return {
    font_family: pickChoice(data.font_family, DEMO_TEXT_FONTS.map((item) => item.id), defaults.font_family),
    font_size: clampInt(data.font_size, 8, 200, defaults.font_size),
    font_weight: weight,
    italic: toBool(data.italic, defaults.italic),
    underline: toBool(data.underline, defaults.underline),
    line_height: clampFloat(data.line_height, 0.6, 4, defaults.line_height),
    letter_spacing: clampFloat(data.letter_spacing, -10, 40, defaults.letter_spacing),
    text_align: pickChoice(data.text_align, DEMO_TEXT_ALIGNS.map((item) => item.id), defaults.text_align),
    rotation: clampFloat(data.rotation, -180, 180, defaults.rotation),
    opacity: clampFloat(data.opacity, 0, 1, defaults.opacity),
    color: pickColor(data.color, defaults.color),
    gradient: {
      enabled: toBool(gradient.enabled, defaults.gradient.enabled),
      from: pickColor(gradient.from, defaults.gradient.from),
      to: pickColor(gradient.to, defaults.gradient.to),
      angle: clampInt(gradient.angle, 0, 360, defaults.gradient.angle),
    },
    stroke: {
      enabled: toBool(stroke.enabled, defaults.stroke.enabled),
      color: pickColor(stroke.color, defaults.stroke.color),
      width: clampFloat(stroke.width, 0, 20, defaults.stroke.width),
    },
    background: {
      enabled: toBool(background.enabled, defaults.background.enabled),
      color: pickColor(background.color, defaults.background.color),
      opacity: clampFloat(background.opacity, 0, 1, defaults.background.opacity),
      radius: clampInt(background.radius, 0, 80, defaults.background.radius),
      padding: clampInt(background.padding, 0, 120, defaults.background.padding),
    },
    shadow: {
      enabled: toBool(shadow.enabled, defaults.shadow.enabled),
      color: pickColor(shadow.color, defaults.shadow.color),
      blur: clampInt(shadow.blur, 0, 80, defaults.shadow.blur),
      x: clampInt(shadow.x, -40, 40, defaults.shadow.x),
      y: clampInt(shadow.y, -40, 40, defaults.shadow.y),
    },
    scale_with_map: toBool(data.scale_with_map, defaults.scale_with_map),
  };
}

function normalizeTextTransition(raw, defaults, effects) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    effect: pickChoice(data.effect, effects.map((item) => item.id), defaults.effect),
    direction: pickChoice(data.direction, DEMO_DIRECTIONS.map((item) => item.id), defaults.direction),
    duration_ms: clampInt(data.duration_ms, 0, 20_000, defaults.duration_ms),
    delay_ms: clampInt(data.delay_ms, 0, 20_000, defaults.delay_ms),
    easing: pickChoice(data.easing, DEMO_EASINGS.map((item) => item.id), defaults.easing),
  };
}

export function normalizeText(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const content = typeof data.content === 'string' ? data.content.slice(0, DEMO_TEXT_MAX_LENGTH) : '';

  let anchor = pickChoice(data.anchor, Object.values(DEMO_TEXT_ANCHOR), DEMO_TEXT_ANCHOR.SCREEN);
  const latRaw = Number(data.lat);
  const lngRaw = Number(data.lng);
  const lat = data.lat != null && Number.isFinite(latRaw) && Math.abs(latRaw) <= 90 ? latRaw : null;
  const lng = data.lng != null && Number.isFinite(lngRaw) && Math.abs(lngRaw) <= 180 ? lngRaw : null;
  if (anchor === DEMO_TEXT_ANCHOR.GEO && (lat == null || lng == null)) {
    anchor = DEMO_TEXT_ANCHOR.SCREEN;
  }

  const screen = data.screen && typeof data.screen === 'object' ? data.screen : {};
  const offset = data.offset && typeof data.offset === 'object' ? data.offset : {};
  const hasWidth = data.width != null && data.width !== '';

  return {
    content,
    anchor,
    lat,
    lng,
    screen: {
      x: clampFloat(screen.x, 0, 1, 0.5),
      y: clampFloat(screen.y, 0, 1, 0.15),
    },
    offset: {
      x: clampInt(offset.x, -2000, 2000, 0),
      y: clampInt(offset.y, -2000, 2000, 0),
    },
    width: hasWidth ? clampInt(data.width, 40, 2000, 400) : null,
    persist_until_click: Boolean(data.persist_until_click),
    style: normalizeTextStyle(data.style),
    enter: normalizeTextTransition(data.enter, DEMO_TEXT_ENTER_DEFAULTS, DEMO_TEXT_ENTER_EFFECTS),
    exit: normalizeTextTransition(data.exit, DEMO_TEXT_EXIT_DEFAULTS, DEMO_TEXT_EXIT_EFFECTS),
  };
}

let localStepSeq = 0;
let localStageSeq = 0;
let localSequenceSeq = 0;

/** Локальный ключ шага для React — идентификаторы с сервера появляются только после сохранения. */
export function makeLocalStepKey() {
  localStepSeq += 1;
  return `local-${Date.now()}-${localStepSeq}`;
}

export function makeLocalStageId() {
  localStageSeq += 1;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stage-${Date.now().toString(36)}-${localStageSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeLocalSequenceKey() {
  localSequenceSeq += 1;
  return `seq-${Date.now().toString(36)}-${localSequenceSeq}`;
}

export function normalizeStep(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const tool = pickChoice(data.tool, Object.values(DEMO_TOOL), DEMO_TOOL.CAMERA);
  const animation = normalizeAnimation(data.animation);
  const allowedEffects = EFFECTS_BY_TOOL[tool] || [DEMO_EFFECT.NONE];
  if (!allowedEffects.includes(animation.effect)) {
    animation.effect = DEMO_EFFECT.NONE;
  }
  return {
    key: data.key || (data.id ? String(data.id) : makeLocalStepKey()),
    id: data.id ?? null,
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : index,
    title: typeof data.title === 'string' ? data.title : '',
    tool,
    duration_ms: clampInt(
      data.duration_ms,
      DEMO_STEP_MIN_DURATION_MS,
      DEMO_STEP_MAX_DURATION_MS,
      DEMO_DEFAULT_STEP_DURATION_MS,
    ),
    start_mode: pickChoice(
      data.start_mode,
      Object.values(DEMO_START_MODE),
      DEMO_START_MODE.ON_CLICK,
    ),
    hold_previous: Boolean(data.hold_previous),
    wait_for_click: Boolean(data.wait_for_click),
    camera: normalizeCamera(data.camera),
    selection: (() => {
      const selection = normalizeSelection(data.selection);
      if (tool === DEMO_TOOL.SITUATIONS) {
        selection.situation_ids = selection.situation_ids.slice(0, 1);
      }
      return selection;
    })(),
    animation,
    text: normalizeText(data.text),
    mosaic: normalizeStepMosaic(),
  };
}

export function normalizeStage(raw, index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return {
    key: data.key || (data.id ? String(data.id) : makeLocalStageId()),
    id: data.id ?? null,
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : index,
    title: typeof data.title === 'string' ? data.title : '',
    cue: normalizeCue(data.cue),
    steps: steps
      .filter((step) => step?.tool !== DEMO_TOOL.MOSAIC)
      .map((step, stepIndex) => normalizeStep(step, stepIndex))
      .sort((a, b) => a.order - b.order)
      .map((step, stepIndex) => ({ ...step, order: stepIndex })),
  };
}

export function normalizeSequenceTransition(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    effect: pickChoice(
      data.effect,
      Object.values(DEMO_PROGRAM_TRANSITION),
      DEMO_PROGRAM_TRANSITION.NONE,
    ),
    duration_ms: clampInt(data.duration_ms, 0, 20_000, 400),
  };
}

export function normalizeSequenceItem(raw, _index = 0) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const type = pickChoice(data.type, Object.values(DEMO_SEQUENCE_TYPE), DEMO_SEQUENCE_TYPE.STAGE);
  const stageId = data.stage_id != null && String(data.stage_id).trim()
    ? String(data.stage_id).trim().slice(0, 80)
    : null;
  const presetId = data.preset_id != null && String(data.preset_id).trim()
    ? String(data.preset_id).trim().slice(0, 80)
    : null;
  const mosaicAction = type === DEMO_SEQUENCE_TYPE.MOSAIC
    ? normalizeSequenceMosaicAction(data.mosaic_action)
    : DEMO_MOSAIC_ACTION.SHOW_GRID;
  const slot = type === DEMO_SEQUENCE_TYPE.MOSAIC
    ? normalizeMosaicSlotId(data.slot)
    : null;
  const easingIds = DEMO_EASINGS.map((item) => item.id);
  const expandAnimOverride = type === DEMO_SEQUENCE_TYPE.MOSAIC
    && data.expand_animation != null
    && String(data.expand_animation).trim()
    ? pickChoice(
      data.expand_animation,
      Object.values(DEMO_MOSAIC_EXPAND_ANIMATION),
      null,
    )
    : null;
  const expandMsOverride = type === DEMO_SEQUENCE_TYPE.MOSAIC
    && data.expand_ms != null
    && Number(data.expand_ms) > 0
    ? clampInt(data.expand_ms, 200, 5000, null)
    : null;
  const collapseMsOverride = type === DEMO_SEQUENCE_TYPE.MOSAIC
    && data.collapse_ms != null
    && Number(data.collapse_ms) > 0
    ? clampInt(data.collapse_ms, 200, 5000, null)
    : null;
  const expandEasingOverride = type === DEMO_SEQUENCE_TYPE.MOSAIC
    && data.expand_easing != null
    && String(data.expand_easing).trim()
    ? pickChoice(data.expand_easing, easingIds, null)
    : null;
  const collapseEasingOverride = type === DEMO_SEQUENCE_TYPE.MOSAIC
    && data.collapse_easing != null
    && String(data.collapse_easing).trim()
    ? pickChoice(data.collapse_easing, easingIds, null)
    : null;
  return {
    key: data.key || makeLocalSequenceKey(),
    type,
    stage_id: type === DEMO_SEQUENCE_TYPE.STAGE ? stageId : null,
    preset_id: (type === DEMO_SEQUENCE_TYPE.MOSAIC || type === DEMO_SEQUENCE_TYPE.TABLEAU)
      ? presetId
      : null,
    mosaic_action: mosaicAction,
    slot: mosaicAction === DEMO_MOSAIC_ACTION.EXPAND ? slot : (mosaicAction === DEMO_MOSAIC_ACTION.COLLAPSE ? slot : null),
    duration_ms: clampInt(data.duration_ms, 0, DEMO_STEP_MAX_DURATION_MS, 0),
    wait_for_presenter: Boolean(data.wait_for_presenter),
    enter: normalizeSequenceTransition(data.enter),
    exit: normalizeSequenceTransition(data.exit),
    expand_animation: expandAnimOverride,
    expand_ms: expandMsOverride,
    collapse_ms: collapseMsOverride,
    expand_easing: expandEasingOverride,
    collapse_easing: collapseEasingOverride,
  };
}

export function normalizeSequence(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => normalizeSequenceItem(item, index));
}

function bindSequenceRefs(sequence, stages, mosaic, tableau) {
  const stageIds = new Set(stages.map((stage) => String(stage.id || stage.key)));
  const mosaicPresetIds = new Set((mosaic?.presets || []).map((preset) => String(preset.id)));
  const tableauPresetIds = new Set((tableau?.presets || []).map((preset) => String(preset.id)));
  return sequence.map((item) => {
    if (item.type === DEMO_SEQUENCE_TYPE.STAGE) {
      const id = item.stage_id && stageIds.has(String(item.stage_id)) ? item.stage_id : null;
      return { ...item, stage_id: id, preset_id: null };
    }
    if (item.type === DEMO_SEQUENCE_TYPE.TABLEAU) {
      const id = item.preset_id && tableauPresetIds.has(String(item.preset_id))
        ? item.preset_id
        : null;
      return { ...item, preset_id: id, stage_id: null };
    }
    const id = item.preset_id && mosaicPresetIds.has(String(item.preset_id))
      ? item.preset_id
      : null;
    return { ...item, preset_id: id, stage_id: null };
  });
}

export function findStage(stages, stageId) {
  if (stageId == null) return null;
  const key = String(stageId);
  return (stages || []).find((stage) => String(stage.id) === key || String(stage.key) === key) || null;
}

export function createDefaultStage(overrides = {}) {
  const id = overrides.id || makeLocalStageId();
  return normalizeStage({
    title: 'Этап 1',
    steps: [createDefaultStep(DEMO_TOOL.CAMERA)],
    ...overrides,
    id,
    key: overrides.key || id,
  });
}

export function createDefaultSequenceItem(overrides = {}) {
  return normalizeSequenceItem({
    type: DEMO_SEQUENCE_TYPE.STAGE,
    duration_ms: 0,
    wait_for_presenter: false,
    enter: { effect: DEMO_PROGRAM_TRANSITION.NONE, duration_ms: 400 },
    exit: { effect: DEMO_PROGRAM_TRANSITION.NONE, duration_ms: 400 },
    ...overrides,
  });
}

export function flattenStageSteps(stages = []) {
  return (stages || []).flatMap((stage) => stage.steps || []);
}

export function normalizeScenario(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  let stages;
  if (Array.isArray(data.stages) && data.stages.length) {
    stages = data.stages.map((stage, index) => normalizeStage(stage, index));
  } else {
    const flatSteps = (Array.isArray(data.steps) ? data.steps : [])
      .filter((step) => step?.tool !== DEMO_TOOL.MOSAIC);
    stages = flatSteps.length
      ? [normalizeStage({ title: 'Этап 1', steps: flatSteps }, 0)]
      : [];
  }
  stages = stages
    .sort((a, b) => a.order - b.order)
    .map((stage, index) => ({ ...stage, order: index }));

  const mosaic = normalizeScenarioMosaic(data.mosaic);
  const tableau = normalizeScenarioTableau(data.tableau);
  let sequence = normalizeSequence(data.sequence);
  if (!sequence.length && stages.length) {
    sequence = stages.map((stage) => createDefaultSequenceItem({
      type: DEMO_SEQUENCE_TYPE.STAGE,
      stage_id: stage.id || stage.key,
    }));
  }
  sequence = bindSequenceRefs(sequence, stages, mosaic, tableau);

  return {
    id: data.id ?? null,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    is_default: Boolean(data.is_default),
    loop: data.loop === undefined ? true : Boolean(data.loop),
    auto_advance: data.auto_advance === undefined ? true : Boolean(data.auto_advance),
    mosaic,
    tableau,
    sequence,
    default_step_duration_ms: clampInt(
      data.default_step_duration_ms,
      DEMO_STEP_MIN_DURATION_MS,
      DEMO_STEP_MAX_DURATION_MS,
      DEMO_DEFAULT_STEP_DURATION_MS,
    ),
    stages,
    steps: flattenStageSteps(stages),
  };
}

export function createDefaultStep(tool = DEMO_TOOL.CAMERA, overrides = {}) {
  const effect = DEFAULT_EFFECT_BY_TOOL[tool] || DEMO_EFFECT.NONE;
  const cameraMode = (() => {
    if (tool === DEMO_TOOL.CAMERA) return DEMO_CAMERA_MODE.FLY_TO;
    if (tool === DEMO_TOOL.TEXT) return DEMO_CAMERA_MODE.NONE;
    return DEMO_CAMERA_MODE.FIT_SELECTION;
  })();
  return normalizeStep({
    title: getToolLabel(tool),
    tool,
    duration_ms: DEMO_DEFAULT_STEP_DURATION_MS,
    start_mode: DEMO_START_MODE.AFTER_PREVIOUS,
    camera: { mode: cameraMode },
    selection: {},
    animation: { effect },
    ...overrides,
  });
}

export function createDefaultScenario(overrides = {}) {
  const stage = createDefaultStage({ title: 'Этап 1' });
  return normalizeScenario({
    title: 'Новый сценарий',
    description: '',
    is_default: false,
    loop: true,
    mosaic: createDefaultScenarioMosaic(),
    tableau: createDefaultScenarioTableau(),
    default_step_duration_ms: DEMO_DEFAULT_STEP_DURATION_MS,
    stages: [stage],
    sequence: [
      createDefaultSequenceItem({
        type: DEMO_SEQUENCE_TYPE.STAGE,
        stage_id: stage.id || stage.key,
      }),
    ],
    ...overrides,
  });
}

/** Убирает локальные поля перед отправкой на сервер. */
export function serializeScenario(scenario) {
  const normalized = normalizeScenario(scenario);
  return {
    title: normalized.title,
    description: normalized.description,
    is_default: normalized.is_default,
    loop: normalized.loop,
    auto_advance: normalized.auto_advance,
    mosaic: normalized.mosaic,
    tableau: normalized.tableau,
    sequence: normalized.sequence.map((item) => ({
      key: item.key,
      type: item.type,
      stage_id: item.stage_id,
      preset_id: item.preset_id,
      mosaic_action: item.mosaic_action,
      slot: item.slot,
      duration_ms: item.duration_ms,
      wait_for_presenter: item.wait_for_presenter,
      enter: item.enter,
      exit: item.exit,
      expand_animation: item.expand_animation,
      expand_ms: item.expand_ms,
      collapse_ms: item.collapse_ms,
      expand_easing: item.expand_easing,
      collapse_easing: item.collapse_easing,
    })),
    default_step_duration_ms: normalized.default_step_duration_ms,
    stages: normalized.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      cue: stage.cue,
      steps: stage.steps.map((step) => ({
        title: step.title,
        tool: step.tool,
        duration_ms: step.duration_ms,
        start_mode: step.start_mode,
        hold_previous: step.hold_previous,
        wait_for_click: step.wait_for_click,
        camera: step.camera,
        selection: step.selection,
        animation: step.animation,
        text: step.text,
        mosaic: step.mosaic,
      })),
    })),
  };
}

/**
 * Раскладывает шаги на этапы и такты.
 *
 * - `on_click` начинает новый **этап** — точку ручного переключения докладчиком;
 * - `after_previous` начинает новый **такт** внутри этапа: он стартует по таймеру,
 *   когда отыграет предыдущий такт;
 * - `with_previous` вливается в текущий такт, то есть идёт параллельно.
 *
 * Первый шаг сценария всегда открывает первый этап, каким бы ни был его режим.
 *
 * @returns {Array<{
 *   index: number, steps: Array, indices: number[], title: string,
 *   beats: Array<{ steps: Array, indices: number[], durationMs: number, startMs: number, endMs: number }>,
 *   durationMs: number, startMs: number, endMs: number
 * }>}
 */
export function buildScenarioStages(steps = []) {
  const stages = [];

  const openStage = () => {
    const stage = {
      index: stages.length,
      steps: [],
      indices: [],
      beats: [],
      durationMs: 0,
      startMs: 0,
      endMs: 0,
      title: '',
    };
    stages.push(stage);
    return stage;
  };

  const openBeat = (stage) => {
    const beat = { steps: [], indices: [], durationMs: 0, startMs: 0, endMs: 0 };
    stage.beats.push(beat);
    return beat;
  };

  steps.forEach((step, index) => {
    let stage = stages[stages.length - 1];
    let beat = stage?.beats[stage.beats.length - 1];

    if (!stage || step.start_mode === DEMO_START_MODE.ON_CLICK) {
      stage = openStage();
      beat = openBeat(stage);
    } else if (step.start_mode === DEMO_START_MODE.AFTER_PREVIOUS || !beat) {
      beat = openBeat(stage);
    }

    stage.steps.push(step);
    stage.indices.push(index);
    beat.steps.push(step);
    beat.indices.push(index);
    beat.durationMs = Math.max(beat.durationMs, step.duration_ms);
  });

  let cursor = 0;
  stages.forEach((stage) => {
    let inner = 0;
    stage.beats.forEach((beat) => {
      beat.startMs = inner;
      beat.endMs = inner + beat.durationMs;
      inner = beat.endMs;
    });
    stage.durationMs = inner;
    stage.startMs = cursor;
    stage.endMs = cursor + stage.durationMs;
    cursor = stage.endMs;
    stage.title = stage.steps.find((step) => step.title)?.title || '';
  });

  return stages;
}

/**
 * Такты внутри одного этапа-шаблона. `on_click` внутри этапа — это новый такт,
 * а не отдельный слайд программы.
 */
export function buildStageBeats(steps = []) {
  const rewritten = (steps || []).map((step, index) => (
    index > 0 && step.start_mode === DEMO_START_MODE.ON_CLICK
      ? { ...step, start_mode: DEMO_START_MODE.AFTER_PREVIOUS }
      : step
  ));
  const derived = buildScenarioStages(rewritten);
  if (derived.length <= 1) return derived[0] || {
    index: 0,
    steps: rewritten,
    indices: rewritten.map((_, index) => index),
    beats: [],
    durationMs: 0,
    startMs: 0,
    endMs: 0,
    title: '',
  };
  const beats = [];
  derived.forEach((stage) => {
    stage.beats.forEach((beat) => beats.push({ ...beat }));
  });
  let inner = 0;
  beats.forEach((beat) => {
    beat.startMs = inner;
    beat.endMs = inner + beat.durationMs;
    inner = beat.endMs;
  });
  return {
    index: 0,
    steps: rewritten,
    indices: rewritten.map((_, index) => index),
    beats,
    durationMs: inner,
    startMs: 0,
    endMs: inner,
    title: derived.find((stage) => stage.title)?.title || '',
  };
}

export function composeStateForStage(stage, beatIndex = Infinity) {
  const playback = buildStageBeats(stage?.steps || []);
  return composeStateAtStage([playback], 0, beatIndex);
}

/**
 * Подгоняет такты этапа под длительность блока: обрезка, удержание последнего
 * кадра или повтор, если слот с loop.
 */
export function fitStageBeatsToDuration(stageBeats, durationMs, { loop = false } = {}) {
  const source = (stageBeats || []).filter((beat) => (beat?.durationMs || 0) > 0);
  const target = Math.max(0, durationMs || 0);
  if (!source.length) {
    return [{ steps: [], indices: [], durationMs: target, startMs: 0, endMs: target }];
  }
  if (!target) {
    let cursor = 0;
    return source.map((beat) => {
      const startMs = cursor;
      cursor += beat.durationMs;
      return { ...beat, startMs, endMs: cursor };
    });
  }

  const result = [];
  const sourceTotal = source.reduce((sum, beat) => sum + beat.durationMs, 0);
  if (!loop && sourceTotal <= target) {
    let cursor = 0;
    source.forEach((beat) => {
      result.push({ ...beat, startMs: cursor, endMs: cursor + beat.durationMs, durationMs: beat.durationMs });
      cursor += beat.durationMs;
    });
    const remain = target - cursor;
    if (remain > 0 && result.length) {
      const last = result[result.length - 1];
      last.durationMs += remain;
      last.endMs = target;
    }
    return result;
  }

  let cursor = 0;
  let srcIndex = 0;
  while (cursor < target) {
    const beat = source[srcIndex % source.length];
    const take = Math.min(beat.durationMs, target - cursor);
    result.push({
      ...beat,
      durationMs: take,
      startMs: cursor,
      endMs: cursor + take,
    });
    cursor += take;
    srcIndex += 1;
    if (!loop && srcIndex >= source.length) break;
  }
  return result.length
    ? result
    : [{ steps: [], indices: [], durationMs: target, startMs: 0, endMs: target }];
}

export function mosaicDurationMs(preset, stages = []) {
  const fromStages = (preset?.screens || []).reduce((max, screen) => {
    const stage = findStage(stages, mosaicScreenGridStageId(screen));
    if (!stage) return max;
    const duration = buildStageBeats(stage.steps).durationMs;
    return Math.max(max, duration);
  }, 0);
  return fromStages || DEMO_DEFAULT_STEP_DURATION_MS;
}

export function sequenceItemDurationMs(item, stages = [], mosaic = null, tableau = null) {
  if (!item) return 0;
  if (item.duration_ms > 0) return item.duration_ms;
  if (item.type === DEMO_SEQUENCE_TYPE.MOSAIC) {
    const preset = findMosaicPreset(mosaic, item.preset_id);
    const action = normalizeSequenceMosaicAction(item.mosaic_action);
    if (action === DEMO_MOSAIC_ACTION.COLLAPSE) {
      return resolveMosaicSlotTransition(preset, item, action).durationMs;
    }
    if (action === DEMO_MOSAIC_ACTION.EXPAND) {
      const morphMs = resolveMosaicSlotTransition(preset, item, action).durationMs;
      const slot = item.slot || preset?.expandable_slots?.[0] || preset?.screens?.[0]?.id || null;
      const screen = (preset?.screens || []).find((entry) => entry.id === slot);
      const stage = findStage(stages, mosaicScreenExpandStageId(screen));
      const stageMs = buildStageBeats(stage?.steps || []).durationMs;
      return Math.max(morphMs, stageMs, DEMO_DEFAULT_STEP_DURATION_MS);
    }
    return mosaicDurationMs(preset, stages);
  }
  if (item.type === DEMO_SEQUENCE_TYPE.TABLEAU) {
    const preset = findTableauPreset(tableau, item.preset_id);
    const stage = findStage(stages, preset?.stage_id);
    const stageMs = buildStageBeats(stage?.steps || []).durationMs;
    if (isTableauGalleryPreset(preset)) {
      return Math.max(stageMs, tableauGalleryDurationMs(preset.gallery), DEMO_DEFAULT_STEP_DURATION_MS);
    }
    if (preset?.variant === DEMO_TABLEAU_VARIANT.SCANNER) {
      return Math.max(scannerDurationMs(preset.scanner), DEMO_DEFAULT_STEP_DURATION_MS);
    }
    if (preset?.variant === DEMO_TABLEAU_VARIANT.NETWORK) {
      return Math.max(DEMO_NETWORK_DURATION_MS, DEMO_DEFAULT_STEP_DURATION_MS);
    }
    const placements = preset?.placements || [];
    const stagger = preset?.card_stagger_ms || 0;
    const arrow = preset?.arrow_draw_ms || 900;
    const revealMs = placements.length
      ? (placements.length - 1) * stagger + arrow + 2000
      : DEMO_DEFAULT_STEP_DURATION_MS;
    return Math.max(stageMs, revealMs, DEMO_DEFAULT_STEP_DURATION_MS);
  }
  const stage = findStage(stages, item.stage_id);
  return buildStageBeats(stage?.steps || []).durationMs;
}

export function buildProgramPlayback(scenario) {
  const normalized = scenario?.stages ? scenario : normalizeScenario(scenario || {});
  const stages = normalized.stages || [];
  const mosaic = normalized.mosaic;
  const tableau = normalized.tableau;
  const items = [];
  let cursor = 0;
  let lastMosaicFocus = { presetId: null, slot: null, focusStage: null };
  (normalized.sequence || []).forEach((item, index) => {
    const durationMs = sequenceItemDurationMs(item, stages, mosaic, tableau);
    const enterMs = item.enter?.effect && item.enter.effect !== DEMO_PROGRAM_TRANSITION.NONE
      ? item.enter.duration_ms
      : 0;
    const exitMs = item.exit?.effect && item.exit.effect !== DEMO_PROGRAM_TRANSITION.NONE
      ? item.exit.duration_ms
      : 0;
    const startMs = cursor;
    const endMs = cursor + enterMs + durationMs + exitMs;
    cursor = endMs;
    if (item.type === DEMO_SEQUENCE_TYPE.MOSAIC) {
      const preset = findMosaicPreset(mosaic, item.preset_id);
      const mosaicAction = item.mosaic_action || DEMO_MOSAIC_ACTION.SHOW_GRID;
      let slot = item.slot
        || (mosaicAction === DEMO_MOSAIC_ACTION.EXPAND
          ? (preset?.expandable_slots?.[0] || preset?.screens?.[0]?.id || null)
          : null);
      if (mosaicAction === DEMO_MOSAIC_ACTION.COLLAPSE && !slot
        && lastMosaicFocus.presetId === preset?.id) {
        slot = lastMosaicFocus.slot;
      }
      const screen = (preset?.screens || []).find((entry) => entry.id === slot);
      let focusStage = findStage(stages, mosaicScreenExpandStageId(screen));
      if (!focusStage && mosaicAction === DEMO_MOSAIC_ACTION.COLLAPSE
        && lastMosaicFocus.presetId === preset?.id) {
        focusStage = lastMosaicFocus.focusStage;
      }
      const actionLabel = getMosaicActionLabel(mosaicAction);
      const title = mosaicAction === DEMO_MOSAIC_ACTION.SHOW_GRID
        ? (preset?.title || 'Мультиэкран')
        : `${preset?.title || 'Мультиэкран'} · ${actionLabel}${slot ? ` ${String(slot).toUpperCase()}` : ''}`;
      if (mosaicAction === DEMO_MOSAIC_ACTION.EXPAND) {
        lastMosaicFocus = { presetId: preset?.id || null, slot, focusStage };
      } else if (mosaicAction === DEMO_MOSAIC_ACTION.SHOW_GRID) {
        lastMosaicFocus = { presetId: preset?.id || null, slot: null, focusStage: null };
      }
      const expandPlayback = mosaicAction === DEMO_MOSAIC_ACTION.EXPAND && focusStage
        ? buildStageBeats(focusStage.steps || [])
        : null;
      const beats = expandPlayback?.beats?.length
        ? fitStageBeatsToDuration(expandPlayback.beats, durationMs, { loop: Boolean(screen?.loop) })
        : [{ steps: [], indices: [], durationMs, startMs: 0, endMs: durationMs }];
      items.push({
        index,
        item,
        kind: DEMO_SEQUENCE_TYPE.MOSAIC,
        title,
        durationMs,
        enterMs,
        exitMs,
        startMs,
        endMs,
        beats,
        stage: mosaicAction === DEMO_MOSAIC_ACTION.EXPAND ? focusStage : null,
        preset,
        mosaicAction,
        slot,
        focusStage,
      });
      return;
    }
    if (item.type === DEMO_SEQUENCE_TYPE.TABLEAU) {
      const preset = findTableauPreset(tableau, item.preset_id);
      const stage = findStage(stages, preset?.stage_id);
      items.push({
        index,
        item,
        kind: DEMO_SEQUENCE_TYPE.TABLEAU,
        title: preset?.title || 'Художественный',
        durationMs,
        enterMs,
        exitMs,
        startMs,
        endMs,
        beats: [{ steps: [], indices: [], durationMs, startMs: 0, endMs: durationMs }],
        stage,
        preset,
        tableauPreset: preset,
        tableauBlocks: tableau?.blocks || [],
      });
      return;
    }
    const stage = findStage(stages, item.stage_id);
    const playback = buildStageBeats(stage?.steps || []);
    items.push({
      index,
      item,
      kind: DEMO_SEQUENCE_TYPE.STAGE,
      title: stage?.title || playback.title || `Этап ${index + 1}`,
      durationMs: playback.durationMs || durationMs,
      enterMs,
      exitMs,
      startMs,
      endMs,
      beats: playback.beats,
      stage,
      preset: null,
    });
  });
  return {
    items,
    totalMs: cursor,
  };
}

export function resolveMosaicScreen(screen, stages = []) {
  if (!screen) return screen;
  const stage = findStage(stages, mosaicScreenGridStageId(screen));
  if (!stage) return screen;
  const composed = composeStateForStage(stage);
  return {
    ...screen,
    label: screen.label || stage.title || screen.label,
    camera: composed.cameraStep?.camera || screen.camera,
    selection: {
      ...(screen.selection || {}),
      target_ids: composed.target_ids,
      event_ids: composed.event_ids,
      situation_ids: composed.situation_ids,
      zone_leaves: composed.zone_leaves,
      overlay_layer_ids: Array.isArray(composed.overlay_layer_ids) ? composed.overlay_layer_ids : [],
    },
    text: composed.texts?.[0]?.text || screen.text,
  };
}

/** Такт «сбрасывает» накопленное содержимое, если ни один его шаг не просит сохранить предыдущее. */
export function beatClearsPrevious(beat) {
  return !beat?.steps?.some((step) => step.hold_previous);
}

function emptyComposedState() {
  return {
    target_ids: [],
    event_ids: [],
    situation_ids: [],
    zone_leaves: [],
    overlay_layer_ids: null,
    texts: [],
    contentStep: null,
    cameraStep: null,
  };
}

function pushUnique(list, values) {
  const seen = new Set(list.map(String));
  (values || []).forEach((value) => {
    const key = String(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(key);
  });
}

function mergeStepIntoState(state, step, stepIndex) {
  const selection = step.selection || {};
  switch (step.tool) {
    case DEMO_TOOL.OBJECTS:
      pushUnique(state.target_ids, selection.target_ids);
      break;
    case DEMO_TOOL.EVENTS:
      pushUnique(state.event_ids, selection.event_ids);
      break;
    case DEMO_TOOL.SITUATIONS:
      state.situation_ids = (selection.situation_ids || []).slice(0, 1).map(String);
      break;
    case DEMO_TOOL.ZONES:
    case DEMO_TOOL.INUNDATION: {
      pushUnique(state.target_ids, selection.target_ids);
      const seen = new Set(
        state.zone_leaves.map((leaf) => `${leaf.country}\u0001${leaf.action_type_id}\u0001${leaf.leaf}`),
      );
      (selection.zone_leaves || []).forEach((leaf) => {
        const key = `${leaf.country}\u0001${leaf.action_type_id}\u0001${leaf.leaf}`;
        if (seen.has(key)) return;
        seen.add(key);
        state.zone_leaves.push(leaf);
      });
      break;
    }
    case DEMO_TOOL.LAYERS:
      if (selection.overlay_layer_ids?.length) {
        state.overlay_layer_ids = [...selection.overlay_layer_ids];
      }
      break;
    case DEMO_TOOL.FORMULAR:
    case DEMO_TOOL.COUNTRY:
      pushUnique(state.target_ids, selection.target_ids);
      state.contentStep = step;
      break;
    case DEMO_TOOL.TEXT:
      if (step.text?.content) {
        state.texts.push({ key: step.key || `step-${stepIndex}`, index: stepIndex, text: step.text });
      }
      break;
    case DEMO_TOOL.MOSAIC:
      break;
    default:
      break;
  }

  if (step.camera?.mode && step.camera.mode !== DEMO_CAMERA_MODE.NONE) {
    state.cameraStep = step;
  }
}

/**
 * Сворачивает шаги от начала сценария до конца указанного такта в итоговое
 * состояние карты. Нужно для перехода назад и прыжков по этапам: шаги
 * накопительные (`hold_previous`), поэтому просто «переиграть» один этап мало.
 *
 * @param {Array} stages результат buildScenarioStages
 * @param {number} stageIndex индекс целевого этапа
 * @param {number} [beatIndex] индекс последнего учитываемого такта внутри этапа
 */
export function composeStateAtStage(stages = [], stageIndex = 0, beatIndex = Infinity) {
  const state = emptyComposedState();
  if (!stages.length) return state;

  const lastStage = Math.max(0, Math.min(stages.length - 1, stageIndex));

  for (let s = 0; s <= lastStage; s += 1) {
    const stage = stages[s];
    const lastBeat = s === lastStage
      ? Math.min(stage.beats.length - 1, beatIndex)
      : stage.beats.length - 1;

    for (let b = 0; b <= lastBeat; b += 1) {
      const beat = stage.beats[b];
      if (!beat) continue;
      if (beatClearsPrevious(beat)) {
        const retainsPersistentTexts = s === lastStage
          && b > 0
          && !beat.steps.some((step) => step.wait_for_click);
        const persistentTexts = retainsPersistentTexts
          ? state.texts.filter((item) => item.text?.persist_until_click)
          : [];
        const carriedLayers = state.overlay_layer_ids;
        Object.assign(state, emptyComposedState());
        // Слои карты живут отдельно: их переключает только шаг «Слои карты».
        state.overlay_layer_ids = carriedLayers;
        state.texts = persistentTexts;
      }
      beat.steps.forEach((step, position) => mergeStepIntoState(state, step, beat.indices[position]));
    }
  }

  return state;
}

/**
 * Раскладка отдельных шагов по времени — для временной шкалы в конструкторе.
 * @returns {{ segments: Array<{step, index, stageIndex, startMs, endMs}>, totalMs: number }}
 */
export function buildScenarioTimeline(steps = []) {
  const stages = buildScenarioStages(steps);
  const segments = [];
  stages.forEach((stage) => {
    stage.beats.forEach((beat) => {
      beat.steps.forEach((step, position) => {
        segments.push({
          step,
          index: beat.indices[position],
          stageIndex: stage.index,
          startMs: stage.startMs + beat.startMs,
          endMs: stage.startMs + beat.startMs + step.duration_ms,
        });
      });
    });
  });
  segments.sort((a, b) => a.index - b.index);
  return {
    segments,
    stages,
    totalMs: stages.length ? stages[stages.length - 1].endMs : 0,
  };
}

export function formatDurationMs(ms) {
  const total = Math.max(0, Math.round(Number(ms) || 0));
  const seconds = total / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)} с`;
  if (seconds < 60) return `${Math.round(seconds)} с`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`;
}

export function describeStepSelection(step) {
  const selection = step?.selection || {};
  switch (step?.tool) {
    case DEMO_TOOL.OBJECTS:
      return selection.target_ids?.length
        ? `${selection.target_ids.length} объект(ов)`
        : 'объекты не выбраны';
    case DEMO_TOOL.EVENTS:
      return selection.event_ids?.length
        ? `${selection.event_ids.length} событие(й)`
        : 'события не выбраны';
    case DEMO_TOOL.ZONES:
    case DEMO_TOOL.INUNDATION:
      return selection.zone_leaves?.length
        ? `${selection.zone_leaves.length} тип(ов) зон`
        : 'зоны не выбраны';
    case DEMO_TOOL.SITUATIONS:
      return selection.situation_ids?.length
        ? `${selection.situation_ids.length} обстановка(и)`
        : 'обстановка не выбрана';
    case DEMO_TOOL.LAYERS:
      return selection.overlay_layer_ids?.length
        ? `${selection.overlay_layer_ids.length} слой(ёв)`
        : 'слои не выбраны';
    case DEMO_TOOL.FORMULAR:
      return selection.target_ids?.length
        ? `${selection.target_ids.length} формуляр(ов)`
        : 'объекты не выбраны';
    case DEMO_TOOL.COUNTRY:
      return selection.country_isos?.length
        ? `${selection.country_isos.length} стран(а)`
        : 'страны не выбраны';
    case DEMO_TOOL.TEXT: {
      const content = step.text?.content?.trim();
      if (!content) return 'текст не задан';
      const firstLine = content.split('\n')[0];
      const preview = firstLine.length > 32 ? `${firstLine.slice(0, 32)}…` : firstLine;
      return `«${preview}»`;
    }
    case DEMO_TOOL.MOSAIC: {
      const action = selection.mosaic_action || DEMO_MOSAIC_ACTION.SHOW_GRID;
      const actionLabel = getMosaicActionLabel(action);
      if (action === DEMO_MOSAIC_ACTION.EXIT || action === DEMO_MOSAIC_ACTION.COLLAPSE) {
        return actionLabel;
      }
      const slot = selection.slot ? String(selection.slot).toUpperCase() : '';
      if (action === DEMO_MOSAIC_ACTION.SHOW_SLOT || action === DEMO_MOSAIC_ACTION.FOCUS_SLOT) {
        return slot ? `${actionLabel}: ${slot}` : actionLabel;
      }
      return actionLabel;
    }
    case DEMO_TOOL.CAMERA:
      return step.camera?.mode === DEMO_CAMERA_MODE.FLY_TO && step.camera?.lat != null
        ? `${step.camera.lat.toFixed(3)}, ${step.camera.lng?.toFixed(3)} · zoom ${step.camera.zoom}`
        : 'точка не задана';
    default:
      return '';
  }
}

/** Функции сглаживания для rAF-анимаций. */
export const EASING_FUNCTIONS = {
  linear: (t) => t,
  ease_out: (t) => 1 - (1 - t) * (1 - t),
  ease_in_out: (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2),
};

export function applyEasing(easing, progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  const fn = EASING_FUNCTIONS[easing] || EASING_FUNCTIONS.ease_out;
  return fn(clamped);
}

/** Снимок включённых листьев фильтра зон — форма, которую принимает setZoneLeavesBatch. */
export function collectEnabledZoneLeaves(actionZoneFilters) {
  const leaves = [];
  Object.entries(actionZoneFilters || {}).forEach(([country, types]) => {
    Object.entries(types || {}).forEach(([actionTypeId, leafSet]) => {
      const items = leafSet instanceof Set
        ? [...leafSet]
        : Array.isArray(leafSet) ? leafSet : [];
      items.forEach((leaf) => {
        leaves.push({ country, actionTypeId, leaf });
      });
    });
  });
  return leaves;
}

/** Обратная операция: листья шага демонстрации → actionZoneFilters для слоя зон. */
export function zoneLeavesToFilters(leaves) {
  const filters = {};
  (leaves || []).forEach((leaf) => {
    const country = leaf.country;
    const typeKey = String(leaf.action_type_id ?? leaf.actionTypeId ?? '');
    const leafId = leaf.leaf;
    if (!country || !typeKey || leafId == null) return;
    if (!filters[country]) filters[country] = {};
    const set = filters[country][typeKey] instanceof Set
      ? filters[country][typeKey]
      : new Set();
    set.add(leafId);
    filters[country][typeKey] = set;
  });
  return filters;
}
