import { ZONE_LEAF_MANUAL } from './inundationZone';

export const DEMO_STEP_MIN_DURATION_MS = 500;
export const DEMO_STEP_MAX_DURATION_MS = 600_000;
export const DEMO_DEFAULT_STEP_DURATION_MS = 6000;

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
};

export const DEMO_EFFECT = {
  NONE: 'none',
  FADE_IN: 'fade_in',
  REVEAL_FROM_CENTER: 'reveal_from_center',
  BLINK: 'blink',
  STATE_CYCLE: 'state_cycle',
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

export const DEMO_EFFECTS = [
  { id: DEMO_EFFECT.NONE, label: 'Без анимации' },
  { id: DEMO_EFFECT.FADE_IN, label: 'Проявление' },
  { id: DEMO_EFFECT.REVEAL_FROM_CENTER, label: 'Раскрытие от центра' },
  { id: DEMO_EFFECT.BLINK, label: 'Мигание' },
  { id: DEMO_EFFECT.STATE_CYCLE, label: 'Смена состояний (цикл)' },
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

export const DEMO_START_MODES = [
  { id: DEMO_START_MODE.ON_CLICK, label: 'По щелчку — новый этап' },
  { id: DEMO_START_MODE.AFTER_PREVIOUS, label: 'После предыдущего' },
  { id: DEMO_START_MODE.WITH_PREVIOUS, label: 'Вместе с предыдущим' },
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

/** Какие эффекты имеют смысл для каждого инструмента. */
const EFFECTS_BY_TOOL = {
  [DEMO_TOOL.CAMERA]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.OBJECTS]: [DEMO_EFFECT.NONE, DEMO_EFFECT.FADE_IN],
  [DEMO_TOOL.EVENTS]: [DEMO_EFFECT.NONE, DEMO_EFFECT.FADE_IN, DEMO_EFFECT.BLINK],
  [DEMO_TOOL.ZONES]: [DEMO_EFFECT.NONE, DEMO_EFFECT.FADE_IN, DEMO_EFFECT.REVEAL_FROM_CENTER],
  [DEMO_TOOL.INUNDATION]: [
    DEMO_EFFECT.NONE,
    DEMO_EFFECT.FADE_IN,
    DEMO_EFFECT.REVEAL_FROM_CENTER,
    DEMO_EFFECT.DIRECTIONAL_WIPE,
  ],
  [DEMO_TOOL.SITUATIONS]: [DEMO_EFFECT.NONE, DEMO_EFFECT.FADE_IN, DEMO_EFFECT.STATE_CYCLE],
  [DEMO_TOOL.LAYERS]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.FORMULAR]: [DEMO_EFFECT.NONE],
  [DEMO_TOOL.COUNTRY]: [DEMO_EFFECT.NONE],
  // У текста собственные эффекты входа/выхода внутри блока `text`.
  [DEMO_TOOL.TEXT]: [DEMO_EFFECT.NONE],
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
  return effect === DEMO_EFFECT.BLINK || effect === DEMO_EFFECT.STATE_CYCLE;
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

function toBool(value, fallback) {
  if (value === true || value === false) return value;
  if (value == null) return fallback;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
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

export function normalizeSelection(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    target_ids: toIdList(data.target_ids),
    event_ids: toIdList(data.event_ids),
    situation_ids: toIdList(data.situation_ids),
    zone_leaves: toZoneLeaves(data.zone_leaves),
    overlay_layer_ids: toIdList(data.overlay_layer_ids),
    country_isos: toIsoList(data.country_isos),
    card_ids: toIdList(data.card_ids),
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
    style: normalizeTextStyle(data.style),
    enter: normalizeTextTransition(data.enter, DEMO_TEXT_ENTER_DEFAULTS, DEMO_TEXT_ENTER_EFFECTS),
    exit: normalizeTextTransition(data.exit, DEMO_TEXT_EXIT_DEFAULTS, DEMO_TEXT_EXIT_EFFECTS),
  };
}

let localStepSeq = 0;

/** Локальный ключ шага для React — идентификаторы с сервера появляются только после сохранения. */
export function makeLocalStepKey() {
  localStepSeq += 1;
  return `local-${Date.now()}-${localStepSeq}`;
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
  };
}

export function normalizeScenario(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return {
    id: data.id ?? null,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    is_default: Boolean(data.is_default),
    loop: data.loop === undefined ? true : Boolean(data.loop),
    auto_advance: data.auto_advance === undefined ? true : Boolean(data.auto_advance),
    default_step_duration_ms: clampInt(
      data.default_step_duration_ms,
      DEMO_STEP_MIN_DURATION_MS,
      DEMO_STEP_MAX_DURATION_MS,
      DEMO_DEFAULT_STEP_DURATION_MS,
    ),
    steps: steps
      .map((step, index) => normalizeStep(step, index))
      .sort((a, b) => a.order - b.order)
      .map((step, index) => ({ ...step, order: index })),
  };
}

export function createDefaultStep(tool = DEMO_TOOL.CAMERA, overrides = {}) {
  const effect = DEFAULT_EFFECT_BY_TOOL[tool] || DEMO_EFFECT.NONE;
  const cameraMode = (() => {
    if (tool === DEMO_TOOL.CAMERA) return DEMO_CAMERA_MODE.FLY_TO;
    // Текст ничего не выделяет на карте — «вписать выбранное» для него бессмысленно.
    if (tool === DEMO_TOOL.TEXT) return DEMO_CAMERA_MODE.NONE;
    return DEMO_CAMERA_MODE.FIT_SELECTION;
  })();
  return normalizeStep({
    title: getToolLabel(tool),
    tool,
    duration_ms: DEMO_DEFAULT_STEP_DURATION_MS,
    start_mode: DEMO_START_MODE.ON_CLICK,
    camera: { mode: cameraMode },
    animation: { effect },
    ...overrides,
  });
}

export function createDefaultScenario(overrides = {}) {
  return normalizeScenario({
    title: 'Новый сценарий',
    description: '',
    is_default: false,
    loop: true,
    default_step_duration_ms: DEMO_DEFAULT_STEP_DURATION_MS,
    steps: [createDefaultStep(DEMO_TOOL.CAMERA)],
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
    default_step_duration_ms: normalized.default_step_duration_ms,
    steps: normalized.steps.map((step) => ({
      title: step.title,
      tool: step.tool,
      duration_ms: step.duration_ms,
      start_mode: step.start_mode,
      hold_previous: step.hold_previous,
      camera: step.camera,
      selection: step.selection,
      animation: step.animation,
      text: step.text,
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
        const carriedLayers = state.overlay_layer_ids;
        Object.assign(state, emptyComposedState());
        // Слои карты живут отдельно: их переключает только шаг «Слои карты».
        state.overlay_layer_ids = carriedLayers;
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
