import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DemoMosaicTile from './DemoMosaicTile';
import { DEMO_MOSAIC_SLOT_LABELS, getMosaicLayoutDef } from '../../utils/demoScenario';
import './DemoMosaic.css';

const SLOT_OUTLINE = {
  a: 'rgba(47, 128, 237, 0.85)',
  b: 'rgba(22, 163, 74, 0.85)',
  c: 'rgba(217, 119, 6, 0.85)',
  d: 'rgba(219, 39, 119, 0.85)',
  e: 'rgba(14, 165, 233, 0.85)',
  f: 'rgba(168, 85, 247, 0.85)',
};

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function measureSlotRect(root, slotId) {
  if (!root || !slotId) return null;
  const cell = root.querySelector(`.demo-mosaic__cell--${slotId}`);
  if (!cell) return null;
  const parent = root.getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  return {
    t: rect.top - parent.top,
    l: rect.left - parent.left,
    w: rect.width,
    h: rect.height,
  };
}

const mlByLeafletMap = new WeakMap();

function resizeLiveMap(map) {
  if (!map) return;
  try {
    map.invalidateSize({ animate: false, pan: false });
  } catch {
    try {
      map.invalidateSize();
    } catch {
      // карта ещё без контейнера
    }
  }
  let ml = mlByLeafletMap.get(map);
  if (!ml && typeof map.eachLayer === 'function') {
    map.eachLayer((layer) => {
      if (!ml) ml = layer.getMaplibreMap?.() || null;
    });
    if (ml) mlByLeafletMap.set(map, ml);
  }
  if (ml?.resize) {
    try {
      ml.resize();
    } catch {
      // слой ещё не готов
    }
  }
}

/**
 * Оболочка мультиэкрана: сетка независимых экранов + фокус (живой MapComponent).
 * Разворот/свертывание идут из позиции ячейки (FLIP).
 */
function DemoMosaicShell({
  mosaicRuntime = null,
  mapRef = null,
  objects = [],
  events = [],
  situations = [],
  situationRevisions = [],
  actionTypes = [],
  countriesList = [],
  stages = [],
  children,
}) {
  const rootRef = useRef(null);
  const [focusFull, setFocusFull] = useState(false);
  const active = Boolean(mosaicRuntime?.active);
  const layout = mosaicRuntime?.layout || '2x2';
  const slotDefs = getMosaicLayoutDef(layout).slots;
  const screens = mosaicRuntime?.screens || {};
  const transitioning = mosaicRuntime?.transitioning || null;
  const focusHidden = Boolean(mosaicRuntime?.focusHidden);
  const mode = mosaicRuntime?.mode || 'grid';
  const focusSlot = mosaicRuntime?.focusSlot || null;
  const transitionMs = mosaicRuntime?.transitionMs || 700;
  const staggerMs = mosaicRuntime?.staggerMs || 0;
  const reveal = mosaicRuntime?.reveal || 'all';

  const visible = useMemo(
    () => new Set(mosaicRuntime?.visibleSlotIds || []),
    [mosaicRuntime?.visibleSlotIds],
  );

  const applyRectVars = useCallback((rect) => {
    const root = rootRef.current;
    if (!root || !rect) return;
    root.style.setProperty('--focus-t', `${rect.t}px`);
    root.style.setProperty('--focus-l', `${rect.l}px`);
    root.style.setProperty('--focus-w', `${rect.w}px`);
    root.style.setProperty('--focus-h', `${rect.h}px`);
  }, []);

  useLayoutEffect(() => {
    if (!active) {
      setFocusFull(false);
      return undefined;
    }
    const reduced = prefersReducedMotion();

    if (mode === 'expanding' && focusSlot) {
      applyRectVars(measureSlotRect(rootRef.current, focusSlot));
      setFocusFull(reduced);
      if (reduced) return undefined;
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setFocusFull(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    if (mode === 'focus') {
      setFocusFull(true);
      return undefined;
    }

    if (mode === 'collapsing' && focusSlot) {
      applyRectVars(measureSlotRect(rootRef.current, focusSlot));
      setFocusFull(true);
      if (reduced) {
        setFocusFull(false);
        return undefined;
      }
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setFocusFull(false));
      });
      return () => cancelAnimationFrame(frame);
    }

    setFocusFull(false);
    return undefined;
  }, [active, applyRectVars, focusSlot, layout, mode, transitioning]);

  useEffect(() => {
    if (!active) return undefined;
    const run = () => resizeLiveMap(mapRef?.current);
    run();
    const animating = mode === 'expanding' || mode === 'collapsing';
    if (!animating) return undefined;
    const focusEl = rootRef.current?.querySelector('.demo-mosaic__focus');
    const onEnd = (event) => {
      if (event?.propertyName && !['width', 'height', 'top', 'left'].includes(event.propertyName)) {
        return;
      }
      run();
    };
    focusEl?.addEventListener('transitionend', onEnd);
    const interval = setInterval(run, 80);
    return () => {
      focusEl?.removeEventListener('transitionend', onEnd);
      clearInterval(interval);
    };
  }, [active, mapRef, mode]);

  const tilesPlaying = mode === 'grid';

  const rootClassName = useMemo(() => [
    'demo-mosaic',
    active ? 'demo-mosaic--multi' : 'demo-mosaic--mono',
    `demo-mosaic--layout-${layout}`,
    `demo-mosaic--${mode}`,
    mode === 'focus' || (mode === 'expanding' && focusFull) ? 'demo-mosaic--focus-mode' : '',
    transitioning ? `demo-mosaic--${transitioning}` : '',
    focusHidden && mode === 'grid' ? 'demo-mosaic--focus-hidden' : '',
    focusFull ? 'demo-mosaic--focus-full' : '',
  ].filter(Boolean).join(' '), [active, focusFull, focusHidden, layout, mode, transitioning]);

  const rootStyle = useMemo(
    () => ({
      '--demo-mosaic-ms': `${transitionMs}ms`,
      '--focus-outline': SLOT_OUTLINE[focusSlot] || SLOT_OUTLINE.a,
    }),
    [focusSlot, transitionMs],
  );

  const showFocus = active && (mode === 'expanding' || mode === 'focus' || mode === 'collapsing');

  return (
    <div ref={rootRef} className={rootClassName} style={rootStyle}>
      {active && (
        <div className="demo-mosaic__grid" aria-hidden={false}>
          {slotDefs.map((slotId, index) => {
            if (!visible.has(slotId)) {
              return (
                <div
                  key={slotId}
                  className={`demo-mosaic__cell demo-mosaic__cell--${slotId} demo-mosaic__cell--empty`}
                >
                  <span className="demo-mosaic__empty-label">
                    {DEMO_MOSAIC_SLOT_LABELS[slotId] || slotId.toUpperCase()}
                  </span>
                </div>
              );
            }
            const screen = screens[slotId];
            const delay = reveal === 'stagger' ? index * staggerMs : 0;
            const isSource = Boolean(focusSlot && focusSlot === slotId && showFocus);
            return (
              <div
                key={slotId}
                className={[
                  'demo-mosaic__cell',
                  `demo-mosaic__cell--${slotId}`,
                  isSource ? 'demo-mosaic__cell--source' : '',
                ].filter(Boolean).join(' ')}
                style={{ animationDelay: `${delay}ms` }}
              >
                <DemoMosaicTile
                  slotId={slotId}
                  screen={screen}
                  stages={stages}
                  startDelayMs={delay}
                  playing={tilesPlaying}
                  objects={objects}
                  events={events}
                  situations={situations}
                  situationRevisions={situationRevisions}
                  actionTypes={actionTypes}
                  countriesList={countriesList}
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="demo-mosaic__focus" aria-hidden={!showFocus && active}>
        {children}
      </div>
    </div>
  );
}

export default memo(DemoMosaicShell);
