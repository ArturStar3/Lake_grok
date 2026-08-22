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
  { id: DEMO_START_MODE.AFTER_PREVIOUS, label: 'После предыдущего' },
  { id: DEMO_START_MODE.WITH_PREVIOUS, label: 'Вместе с предыдущим' },
];

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
      DEMO_START_MODE.AFTER_PREVIOUS,
    ),
    hold_previous: Boolean(data.hold_previous),
    camera: normalizeCamera(data.camera),
    selection: normalizeSelection(data.selection),
    animation,
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
  return normalizeStep({
    title: getToolLabel(tool),
    tool,
    duration_ms: DEMO_DEFAULT_STEP_DURATION_MS,
    camera: { mode: tool === DEMO_TOOL.CAMERA ? DEMO_CAMERA_MODE.FLY_TO : DEMO_CAMERA_MODE.FIT_SELECTION },
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
    })),
  };
}

/**
 * Группирует шаги в «сцены»: шаг с режимом «вместе с предыдущим» попадает
 * в сцену предыдущего шага. Плеер переключается между сценами, поэтому
 * параллельные шаги стартуют одновременно и живут max(длительностей).
 * @returns {Array<{ steps: Array, indices: number[], durationMs: number, startMs: number, endMs: number }>}
 */
export function buildScenarioCues(steps = []) {
  const cues = [];
  steps.forEach((step, index) => {
    const withPrevious = cues.length > 0 && step.start_mode === DEMO_START_MODE.WITH_PREVIOUS;
    if (withPrevious) {
      const cue = cues[cues.length - 1];
      cue.steps.push(step);
      cue.indices.push(index);
      cue.durationMs = Math.max(cue.durationMs, step.duration_ms);
      return;
    }
    cues.push({
      steps: [step],
      indices: [index],
      durationMs: step.duration_ms,
      startMs: 0,
      endMs: 0,
    });
  });

  let cursor = 0;
  cues.forEach((cue) => {
    cue.startMs = cursor;
    cue.endMs = cursor + cue.durationMs;
    cursor = cue.endMs;
  });
  return cues;
}

/**
 * Раскладка отдельных шагов по времени — для временной шкалы в конструкторе.
 * @returns {{ segments: Array<{step, index, startMs, endMs}>, totalMs: number }}
 */
export function buildScenarioTimeline(steps = []) {
  const cues = buildScenarioCues(steps);
  const segments = [];
  cues.forEach((cue) => {
    cue.steps.forEach((step, position) => {
      segments.push({
        step,
        index: cue.indices[position],
        startMs: cue.startMs,
        endMs: cue.startMs + step.duration_ms,
      });
    });
  });
  segments.sort((a, b) => a.index - b.index);
  return {
    segments,
    totalMs: cues.length ? cues[cues.length - 1].endMs : 0,
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
