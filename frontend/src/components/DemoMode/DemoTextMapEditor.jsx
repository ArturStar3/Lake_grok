import { useEffect, useRef, useState } from 'react';
import {
  DEMO_TEXT_ANCHOR,
  DEMO_TEXT_FONTS,
  DEMO_TEXT_MAX_LENGTH,
  DEMO_TEXT_WEIGHTS,
} from '../../utils/demoScenario';
import DemoTextAlignPresets from './DemoTextAlignPresets';
import './DemoTextMapEditor.css';

function hexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
    || target.isContentEditable;
}

function clampOffset(left, top, el) {
  const parent = el.offsetParent || el.parentElement;
  if (!parent) return { left, top };
  const maxLeft = Math.max(0, parent.clientWidth - el.offsetWidth);
  const maxTop = Math.max(0, parent.clientHeight - el.offsetHeight);
  return {
    left: Math.min(maxLeft, Math.max(0, left)),
    top: Math.min(maxTop, Math.max(0, top)),
  };
}

/**
 * Плавающая панель правки текста прямо на карте.
 * Полный инспектор остаётся в конструкторе — здесь только то, что нужно видеть сразу:
 * содержимое, цвет, шрифт и положение.
 */
export default function DemoTextMapEditor({
  text,
  onChange,
  onFinish,
  getMapView,
  alignTextOnMap,
}) {
  const panelRef = useRef(null);
  const [offset, setOffset] = useState(null);
  const [dragging, setDragging] = useState(false);

  const value = text || {};
  const style = value.style || {};
  const isGeo = value.anchor === DEMO_TEXT_ANCHOR.GEO;

  const patch = (partial) => onChange?.({ ...value, ...partial });
  const patchStyle = (partial) => patch({ style: { ...style, ...partial } });

  const handleAnchorChange = (anchor) => {
    if (anchor === DEMO_TEXT_ANCHOR.GEO) {
      const center = getMapView?.();
      patch({
        anchor,
        lat: value.lat ?? center?.lat ?? null,
        lng: value.lng ?? center?.lng ?? null,
      });
      return;
    }
    patch({ anchor });
  };

  const handleGripPointerDown = (event) => {
    if (event.button !== 0) return;
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();

    const el = panelRef.current;
    if (!el) return;
    const parent = el.offsetParent || el.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const startLeft = rect.left - parentRect.left;
    const startTop = rect.top - parentRect.top;
    const originX = event.clientX;
    const originY = event.clientY;
    setOffset(clampOffset(startLeft, startTop, el));
    setDragging(true);

    const onMove = (ev) => {
      setOffset(clampOffset(
        startLeft + (ev.clientX - originX),
        startTop + (ev.clientY - originY),
        el,
      ));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== 'Escape') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      onFinish?.(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onFinish]);

  return (
    <div
      ref={panelRef}
      className={[
        'demo-text-map-editor',
        offset ? 'demo-text-map-editor--moved' : '',
        dragging ? 'demo-text-map-editor--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={offset ? { left: offset.left, top: offset.top } : undefined}
      role="toolbar"
      aria-label="Настройка текста на карте"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="demo-text-map-editor__grip"
        onPointerDown={handleGripPointerDown}
        title="Перетащите панель"
      >
        Перетащите панель
      </div>
      <p className="demo-text-map-editor__hint">
        Перетащите текст или щёлкните по карте, чтобы поставить
      </p>

      <textarea
        className="demo-text-map-editor__content"
        rows={2}
        maxLength={DEMO_TEXT_MAX_LENGTH}
        value={value.content || ''}
        placeholder="Текст на карте"
        onChange={(e) => patch({ content: e.target.value })}
      />

      <div className="demo-text-map-editor__row">
        <label className="demo-text-map-editor__field">
          <span>Цвет</span>
          <span className="demo-text-map-editor__color">
            <input
              type="color"
              value={hexColor(style.color)}
              onChange={(e) => patchStyle({ color: e.target.value })}
            />
            <input
              type="text"
              value={style.color || ''}
              onChange={(e) => patchStyle({ color: e.target.value })}
            />
          </span>
        </label>

        <label className="demo-text-map-editor__field">
          <span>Шрифт</span>
          <select
            value={style.font_family || 'Roboto'}
            onChange={(e) => patchStyle({ font_family: e.target.value })}
          >
            {DEMO_TEXT_FONTS.map((font) => (
              <option key={font.id} value={font.id}>{font.label}</option>
            ))}
          </select>
        </label>

        <label className="demo-text-map-editor__field demo-text-map-editor__field--narrow">
          <span>Размер</span>
          <input
            type="number"
            min={8}
            max={200}
            value={style.font_size ?? 32}
            onChange={(e) => patchStyle({ font_size: Number(e.target.value) || 32 })}
          />
        </label>

        <label className="demo-text-map-editor__field">
          <span>Насыщенность</span>
          <select
            value={String(style.font_weight ?? 700)}
            onChange={(e) => patchStyle({ font_weight: Number(e.target.value) })}
          >
            {DEMO_TEXT_WEIGHTS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="demo-text-map-editor__check">
          <input
            type="checkbox"
            checked={Boolean(style.italic)}
            onChange={(e) => patchStyle({ italic: e.target.checked })}
          />
          Курсив
        </label>
      </div>

      <div className="demo-text-map-editor__row">
        <label className="demo-text-map-editor__field">
          <span>Привязка</span>
          <select
            value={value.anchor || DEMO_TEXT_ANCHOR.SCREEN}
            onChange={(e) => handleAnchorChange(e.target.value)}
          >
            <option value={DEMO_TEXT_ANCHOR.SCREEN}>К экрану</option>
            <option value={DEMO_TEXT_ANCHOR.GEO}>К координатам</option>
          </select>
        </label>

        {isGeo ? (
          <>
            <label className="demo-text-map-editor__field demo-text-map-editor__field--narrow">
              <span>Широта</span>
              <input
                type="number"
                step={0.001}
                min={-90}
                max={90}
                value={value.lat ?? ''}
                onChange={(e) => patch({ lat: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
            <label className="demo-text-map-editor__field demo-text-map-editor__field--narrow">
              <span>Долгота</span>
              <input
                type="number"
                step={0.001}
                min={-180}
                max={180}
                value={value.lng ?? ''}
                onChange={(e) => patch({ lng: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </label>
          </>
        ) : (
          <>
            <label className="demo-text-map-editor__field demo-text-map-editor__field--narrow">
              <span>X, %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round((value.screen?.x ?? 0.5) * 100)}
                onChange={(e) => patch({
                  screen: { ...(value.screen || {}), x: (Number(e.target.value) || 0) / 100 },
                })}
              />
            </label>
            <label className="demo-text-map-editor__field demo-text-map-editor__field--narrow">
              <span>Y, %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round((value.screen?.y ?? 0.15) * 100)}
                onChange={(e) => patch({
                  screen: { ...(value.screen || {}), y: (Number(e.target.value) || 0) / 100 },
                })}
              />
            </label>
          </>
        )}
      </div>

      <DemoTextAlignPresets
        onAlign={(axis) => {
          if (alignTextOnMap) {
            const next = alignTextOnMap(value, axis);
            if (next) onChange?.(next);
            return;
          }
          if (isGeo) return;
          patch({
            screen: {
              ...(value.screen || {}),
              ...(axis.x != null ? { x: axis.x } : {}),
              ...(axis.y != null ? { y: axis.y } : {}),
            },
          });
        }}
      />

      <div className="demo-text-map-editor__actions">
        <button type="button" className="demo-text-map-editor__cancel" onClick={() => onFinish?.(false)}>
          Отмена
        </button>
        <button type="button" className="demo-text-map-editor__done" onClick={() => onFinish?.(true)}>
          Готово
        </button>
      </div>
    </div>
  );
}
