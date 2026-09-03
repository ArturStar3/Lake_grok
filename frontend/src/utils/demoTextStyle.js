/**
 * Построение инлайн-стилей текстового оверлея демонстрации.
 *
 * Один и тот же билдер используется слоем карты и превью в конструкторе,
 * поэтому докладчик видит в редакторе ровно то, что появится на показе.
 */

const CSS_EASINGS = {
  linear: 'linear',
  ease_out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  ease_in_out: 'cubic-bezier(0.65, 0, 0.35, 1)',
};

/** Смещение старта/финиша для эффекта «выезд». */
const SLIDE_OFFSETS = {
  left: { dx: -48, dy: 0 },
  right: { dx: 48, dy: 0 },
  top: { dx: 0, dy: -48 },
  bottom: { dx: 0, dy: 48 },
};

export function cssEasing(easing) {
  return CSS_EASINGS[easing] || CSS_EASINGS.ease_out;
}

/** Добавляет альфа-канал к hex-цвету; остальные форматы отдаём как есть. */
function withAlpha(color, alpha) {
  if (typeof color !== 'string') return color;
  const value = color.trim();
  if (alpha >= 1) return value;
  const hex = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hex) return value;
  const digits = hex[1];
  const full = digits.length === 3
    ? digits.split('').map((char) => char + char).join('')
    : digits;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * @param {object} text нормализованный блок `step.text`
 * @param {{ fontScale?: number }} options fontScale — коэффициент масштабирования с картой
 */
export function buildDemoTextStyles(text, { fontScale = 1 } = {}) {
  const style = text?.style || {};
  const gradient = style.gradient || {};
  const stroke = style.stroke || {};
  const background = style.background || {};
  const shadow = style.shadow || {};

  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const fontSize = Math.max(4, Math.round((style.font_size || 32) * scale));
  const strokeWidth = Math.max(0, (stroke.width || 0) * scale);

  // Обводка и градиент конфликтуют: background-clip:text обрезает всё,
  // включая штрих, поэтому при их сочетании рисуем два наложенных слоя.
  const useStrokeLayer = Boolean(gradient.enabled && stroke.enabled && strokeWidth > 0);

  const textShadow = shadow.enabled
    ? `${(shadow.x || 0) * scale}px ${(shadow.y || 0) * scale}px ${(shadow.blur || 0) * scale}px ${shadow.color}`
    : undefined;

  const fontBase = {
    fontFamily: `"${style.font_family || 'Roboto'}", sans-serif`,
    fontSize: `${fontSize}px`,
    fontWeight: style.font_weight || 700,
    fontStyle: style.italic ? 'italic' : 'normal',
    lineHeight: style.line_height || 1.2,
    letterSpacing: `${(style.letter_spacing || 0) * scale}px`,
    textDecoration: style.underline ? 'underline' : 'none',
    textUnderlineOffset: style.underline ? `${Math.round(fontSize * 0.14)}px` : undefined,
    textDecorationThickness: style.underline ? `${Math.max(1, Math.round(fontSize * 0.06))}px` : undefined,
  };

  const fill = { ...fontBase, textShadow };
  if (gradient.enabled) {
    fill.backgroundImage = `linear-gradient(${gradient.angle ?? 90}deg, ${gradient.from}, ${gradient.to})`;
    fill.WebkitBackgroundClip = 'text';
    fill.backgroundClip = 'text';
    fill.color = 'transparent';
    fill.WebkitTextFillColor = 'transparent';
  } else {
    fill.color = style.color || '#ffffff';
    if (stroke.enabled && strokeWidth > 0) {
      fill.WebkitTextStroke = `${strokeWidth}px ${stroke.color}`;
      fill.paintOrder = 'stroke fill';
    }
  }

  const strokeLayer = useStrokeLayer
    ? {
      ...fontBase,
      color: stroke.color,
      WebkitTextStroke: `${strokeWidth}px ${stroke.color}`,
      paintOrder: 'stroke fill',
      textShadow,
    }
    : null;

  const box = {
    textAlign: style.text_align || 'center',
    opacity: style.opacity ?? 1,
    width: text?.width ? `${text.width}px` : undefined,
    maxWidth: text?.width ? undefined : '70vw',
  };
  if (background.enabled) {
    box.backgroundColor = withAlpha(background.color, background.opacity ?? 1);
    box.borderRadius = `${background.radius || 0}px`;
    box.padding = `${Math.round((background.padding || 0) * 0.6)}px ${background.padding || 0}px`;
  }

  return {
    box,
    fill,
    strokeLayer,
    useStrokeLayer,
    rotation: style.rotation || 0,
  };
}

/**
 * CSS-переменные и класс анимации для одной фазы (вход или выход).
 * @param {object} transition блок `text.enter` или `text.exit`
 * @param {'enter'|'exit'} phase
 */
export function buildDemoTextAnimation(transition, phase) {
  const effect = transition?.effect || 'none';
  if (effect === 'none' || effect === 'typewriter') {
    return { className: '', vars: {}, durationMs: 0 };
  }

  const offsets = SLIDE_OFFSETS[transition?.direction] || SLIDE_OFFSETS.bottom;
  // На выходе текст уходит в сторону, указанную направлением, а не приходит из неё.
  const sign = phase === 'exit' ? -1 : 1;

  return {
    className: `demo-text--${phase} demo-text--${phase}-${effect}`,
    vars: {
      [`--demo-text-${phase}-duration`]: `${transition?.duration_ms ?? 400}ms`,
      [`--demo-text-${phase}-delay`]: `${transition?.delay_ms ?? 0}ms`,
      [`--demo-text-${phase}-ease`]: cssEasing(transition?.easing),
      '--demo-text-dx': `${offsets.dx * sign}px`,
      '--demo-text-dy': `${offsets.dy * sign}px`,
    },
    durationMs: (transition?.duration_ms ?? 400) + (transition?.delay_ms ?? 0),
  };
}

/** Полное время исчезновения — на столько элемент задерживается в DOM после снятия. */
export function demoTextExitDuration(text) {
  const exit = text?.exit;
  if (!exit || exit.effect === 'none') return 0;
  return (exit.duration_ms ?? 400) + (exit.delay_ms ?? 0);
}
