import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import DemoMosaicTile from './DemoMosaicTile';
import {
  DEMO_EASING_CSS,
  DEMO_MOSAIC_EXPAND_ANIMATION,
  DEMO_MOSAIC_SLOT_LABELS,
  getMosaicLayoutDef,
} from '../../utils/demoScenario';
import { sliceCatalogsForStage } from '../../utils/demoMosaicCatalog';
import { setMosaicClockEnabled } from '../../hooks/demo/mosaicStageClock';
import { useMosaicTileMountQueue } from '../../hooks/demo/useMosaicTileMountQueue';
import './DemoMosaic.css';

const SLOT_OUTLINE = {
  a: 'rgba(47, 128, 237, 0.85)',
  b: 'rgba(22, 163, 74, 0.85)',
  c: 'rgba(217, 119, 6, 0.85)',
  d: 'rgba(219, 39, 119, 0.85)',
  e: 'rgba(14, 165, 233, 0.85)',
  f: 'rgba(168, 85, 247, 0.85)',
};

const FOCUS_PHASE = {
  SLOT: 'slot',
  CENTER: 'center',
  FULL: 'full',
};

/** Transition только transform (translate + scale). */
const ANIM = {
  NONE: 'none',
  TRANSFORM: 'transform',
};

const IDENTITY_SCALE = { x: 1, y: 1 };
const ZERO_TX = { x: 0, y: 0 };

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
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    t: rect.top - parent.top,
    l: rect.left - parent.left,
    w: rect.width,
    h: rect.height,
  };
}

function rootFullRect(root) {
  if (!root) return { t: 0, l: 0, w: 0, h: 0 };
  const parent = root.getBoundingClientRect();
  return { t: 0, l: 0, w: parent.width, h: parent.height };
}

function centerAbsRect(root, slotRect) {
  if (!root || !slotRect) return null;
  const parent = root.getBoundingClientRect();
  return {
    t: (parent.height - slotRect.h) / 2,
    l: (parent.width - slotRect.w) / 2,
    w: slotRect.w,
    h: slotRect.h,
  };
}

function centerTranslate(root, slotRect) {
  const abs = centerAbsRect(root, slotRect);
  if (!abs || !slotRect) return ZERO_TX;
  return {
    x: abs.l - slotRect.l,
    y: abs.t - slotRect.t,
  };
}

/** scale, чтобы box fromRect визуально заполнил full (при origin center). */
function fillScale(fromRect, full) {
  if (!fromRect?.w || !fromRect?.h || !full?.w || !full?.h) return IDENTITY_SCALE;
  return {
    x: full.w / fromRect.w,
    y: full.h / fromRect.h,
  };
}

function forceReflow(el) {
  if (!el) return;
  // eslint-disable-next-line no-unused-expressions
  void el.offsetWidth;
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

function splitDuration(totalMs) {
  const total = Math.max(0, Number(totalMs) || 0);
  const first = Math.floor(total / 2);
  return { first, second: total - first };
}

/**
 * Morph: translate к центру + scale до fullscreen.
 * Layout (width/height) меняется только при commit в конце.
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
  onTilesReady = null,
  children,
}) {
  const rootRef = useRef(null);
  const focusElRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const rafRef = useRef(0);
  const morphGenRef = useRef(0);
  const morphingRef = useRef(false);
  const slotOriginRef = useRef(null);

  const [focusGeom, setFocusGeom] = useState(null);
  const [translate, setTranslate] = useState(ZERO_TX);
  const [scale, setScale] = useState(IDENTITY_SCALE);
  const [focusPhase, setFocusPhase] = useState(FOCUS_PHASE.SLOT);
  const [animKind, setAnimKind] = useState(ANIM.NONE);
  const [phaseMs, setPhaseMs] = useState(350);
  const [flipPrep, setFlipPrep] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);

  const active = Boolean(mosaicRuntime?.active);
  const warming = Boolean(mosaicRuntime?.warming);
  const tilesReady = Boolean(mosaicRuntime?.tilesReady);
  const layout = mosaicRuntime?.layout || '2x2';
  const slotDefs = getMosaicLayoutDef(layout).slots;
  const screens = mosaicRuntime?.screens || {};
  const transitioning = mosaicRuntime?.transitioning || null;
  const focusHidden = Boolean(mosaicRuntime?.focusHidden);
  const mode = mosaicRuntime?.mode || 'grid';
  const focusSlot = mosaicRuntime?.focusSlot || null;
  const transitionMs = mosaicRuntime?.transitionMs || 700;
  const expandAnimation = mosaicRuntime?.expandAnimation
    || DEMO_MOSAIC_EXPAND_ANIMATION.STRETCH;
  const useCenterThenStretch = expandAnimation
    === DEMO_MOSAIC_EXPAND_ANIMATION.CENTER_THEN_STRETCH;
  const cssEasing = mosaicRuntime?.cssEasing
    || DEMO_EASING_CSS[mosaicRuntime?.easing]
    || DEMO_EASING_CSS.ease_out;
  const staggerMs = mosaicRuntime?.staggerMs || 0;
  const reveal = mosaicRuntime?.reveal || 'all';

  const visible = useMemo(
    () => new Set(mosaicRuntime?.visibleSlotIds || []),
    [mosaicRuntime?.visibleSlotIds],
  );

  const clearTimers = useCallback(() => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const readSlotRect = useCallback((slotId) => {
    const root = rootRef.current;
    let rect = measureSlotRect(root, slotId);
    if (rect) return rect;
    forceReflow(root);
    return measureSlotRect(root, slotId);
  }, []);

  /** Настоящий fullscreen-layout + один resize карты. */
  const commitFull = useCallback(() => {
    const full = rootFullRect(rootRef.current);
    flushSync(() => {
      setFlipPrep(true);
      setAnimKind(ANIM.NONE);
      setFocusGeom(full);
      setTranslate(ZERO_TX);
      setScale(IDENTITY_SCALE);
      setFocusPhase(FOCUS_PHASE.FULL);
      setPanelVisible(true);
    });
    forceReflow(focusElRef.current || rootRef.current);
    flushSync(() => setFlipPrep(false));
    resizeLiveMap(mapRef?.current);
  }, [mapRef]);

  const holdFull = useCallback(() => {
    commitFull();
  }, [commitFull]);

  const runMorph = useCallback((direction, { retry = 0 } = {}) => {
    clearTimers();
    const gen = ++morphGenRef.current;
    morphingRef.current = true;

    const reduced = prefersReducedMotion();
    const rect = focusSlot ? readSlotRect(focusSlot) : null;

    if (!rect && retry < 2) {
      rafRef.current = requestAnimationFrame(() => {
        if (gen !== morphGenRef.current) return;
        clearTimers();
        morphGenRef.current = gen - 1;
        runMorph(direction, { retry: retry + 1 });
      });
      return;
    }

    if (!rect) {
      morphingRef.current = false;
      setPanelVisible(false);
      return;
    }

    slotOriginRef.current = rect;
    const root = rootRef.current;
    const full = rootFullRect(root);
    const centerAbs = centerAbsRect(root, rect);
    const toCenter = centerTranslate(root, rect);
    const scaleFromCenter = fillScale(centerAbs || rect, full);
    const scaleFromSlot = fillScale(rect, full);
    /** Сжатие full-layout до размера слота (origin center). */
    const shrinkScale = (full.w > 0 && full.h > 0)
      ? { x: rect.w / full.w, y: rect.h / full.h }
      : IDENTITY_SCALE;
    /** Сдвиг уменьшенной full-панели к центру ячейки. */
    const toSlotTx = {
      x: rect.l + rect.w / 2 - full.w / 2,
      y: rect.t + rect.h / 2 - full.h / 2,
    };
    const { first: ms1, second: ms2 } = splitDuration(transitionMs);

    const finishMorph = () => {
      if (gen !== morphGenRef.current) return;
      morphingRef.current = false;
      phaseTimerRef.current = null;
    };

    if (reduced) {
      if (direction === 'expand') {
        commitFull();
      } else {
        setFocusGeom(rect);
        setTranslate(ZERO_TX);
        setScale(IDENTITY_SCALE);
        setFocusPhase(FOCUS_PHASE.SLOT);
        setPanelVisible(false);
        setAnimKind(ANIM.NONE);
      }
      morphingRef.current = false;
      return;
    }

    const afterPaint = (fn) => {
      rafRef.current = requestAnimationFrame(() => {
        if (gen !== morphGenRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
          if (gen !== morphGenRef.current) return;
          fn();
        });
      });
    };

    const prepFrame = (stateFn) => {
      flushSync(() => {
        setFlipPrep(true);
        stateFn();
      });
      forceReflow(focusElRef.current || root);
      if (gen !== morphGenRef.current) return false;
      flushSync(() => setFlipPrep(false));
      forceReflow(focusElRef.current || root);
      return true;
    };

    // ——— EXPAND ———
    if (direction === 'expand') {
      if (!useCenterThenStretch) {
        // Одна фаза: translate+scale из слота → визуальный fullscreen, затем commit.
        if (!prepFrame(() => {
          setAnimKind(ANIM.TRANSFORM);
          setPhaseMs(transitionMs);
          setFocusGeom(rect);
          setTranslate(ZERO_TX);
          setScale(IDENTITY_SCALE);
          setFocusPhase(FOCUS_PHASE.SLOT);
          setPanelVisible(true);
        })) return;

        afterPaint(() => {
          setTranslate(toCenter);
          setScale(scaleFromSlot);
          setFocusPhase(FOCUS_PHASE.CENTER);
          phaseTimerRef.current = setTimeout(() => {
            if (gen !== morphGenRef.current) return;
            commitFull();
            finishMorph();
          }, transitionMs);
        });
        return;
      }

      // slot → center (translate) → scale up → commit full
      if (!prepFrame(() => {
        setAnimKind(ANIM.TRANSFORM);
        setPhaseMs(ms1);
        setFocusGeom(rect);
        setTranslate(ZERO_TX);
        setScale(IDENTITY_SCALE);
        setFocusPhase(FOCUS_PHASE.SLOT);
        setPanelVisible(true);
      })) return;

      afterPaint(() => {
        setTranslate(toCenter);
        setFocusPhase(FOCUS_PHASE.CENTER);
        phaseTimerRef.current = setTimeout(() => {
          if (gen !== morphGenRef.current) return;
          // Фиксируем center-rect без translate; scale=1
          if (!prepFrame(() => {
            setAnimKind(ANIM.TRANSFORM);
            setPhaseMs(ms2);
            setFocusGeom(centerAbs);
            setTranslate(ZERO_TX);
            setScale(IDENTITY_SCALE);
            setFocusPhase(FOCUS_PHASE.CENTER);
          })) return;

          afterPaint(() => {
            setScale(scaleFromCenter);
            phaseTimerRef.current = setTimeout(() => {
              if (gen !== morphGenRef.current) return;
              commitFull();
              finishMorph();
            }, ms2);
          });
        }, ms1);
      });
      return;
    }

    // ——— COLLAPSE ———
    // Layout остаётся full (как после commitFull) — только scale/translate, без сжатия DOM.
    if (!useCenterThenStretch) {
      if (!prepFrame(() => {
        setAnimKind(ANIM.TRANSFORM);
        setPhaseMs(transitionMs);
        setFocusGeom(full);
        setTranslate(ZERO_TX);
        setScale(IDENTITY_SCALE);
        setFocusPhase(FOCUS_PHASE.FULL);
        setPanelVisible(true);
      })) return;

      afterPaint(() => {
        setTranslate(toSlotTx);
        setScale(shrinkScale);
        phaseTimerRef.current = setTimeout(finishMorph, transitionMs);
      });
      return;
    }

    // full → scale down к размеру слота в центре → translate в ячейку
    if (!prepFrame(() => {
      setAnimKind(ANIM.TRANSFORM);
      setPhaseMs(ms1);
      setFocusGeom(full);
      setTranslate(ZERO_TX);
      setScale(IDENTITY_SCALE);
      setFocusPhase(FOCUS_PHASE.FULL);
      setPanelVisible(true);
    })) return;

    afterPaint(() => {
      setScale(shrinkScale);
      phaseTimerRef.current = setTimeout(() => {
        if (gen !== morphGenRef.current) return;
        // Только смена длительности фазы; geom/scale без визуального прыжка.
        if (!prepFrame(() => {
          setAnimKind(ANIM.TRANSFORM);
          setPhaseMs(ms2);
          setFocusGeom(full);
          setTranslate(ZERO_TX);
          setScale(shrinkScale);
          setFocusPhase(FOCUS_PHASE.FULL);
        })) return;

        afterPaint(() => {
          setTranslate(toSlotTx);
          phaseTimerRef.current = setTimeout(finishMorph, ms2);
        });
      }, ms1);
    });
  }, [
    clearTimers,
    commitFull,
    focusSlot,
    readSlotRect,
    transitionMs,
    useCenterThenStretch,
  ]);

  useLayoutEffect(() => {
    if (!active) {
      morphGenRef.current += 1;
      clearTimers();
      morphingRef.current = false;
      slotOriginRef.current = null;
      setFlipPrep(false);
      setPanelVisible(false);
      setFocusGeom(null);
      setTranslate(ZERO_TX);
      setScale(IDENTITY_SCALE);
      setFocusPhase(FOCUS_PHASE.SLOT);
      setAnimKind(ANIM.NONE);
      return undefined;
    }

    if (mode === 'expanding' && focusSlot) {
      runMorph('expand');
      return undefined;
    }

    if (mode === 'collapsing' && focusSlot) {
      runMorph('collapse');
      return undefined;
    }

    if (mode === 'focus') {
      if (!morphingRef.current) {
        holdFull();
      }
      return undefined;
    }

    morphGenRef.current += 1;
    clearTimers();
    morphingRef.current = false;
    setFlipPrep(false);
    setPanelVisible(false);
    setTranslate(ZERO_TX);
    setScale(IDENTITY_SCALE);
    setFocusPhase(FOCUS_PHASE.SLOT);
    setAnimKind(ANIM.NONE);
    return undefined;
  }, [active, clearTimers, focusSlot, holdFull, layout, mode, runMorph]);

  useEffect(() => () => {
    morphGenRef.current += 1;
    clearTimers();
  }, [clearTimers]);

  // Resize только в steady fullscreen (не во время morph).
  useEffect(() => {
    if (!active || !panelVisible) return undefined;
    if (mode === 'expanding' || mode === 'collapsing') return undefined;
    if (focusPhase !== FOCUS_PHASE.FULL) return undefined;
    resizeLiveMap(mapRef?.current);
    return undefined;
  }, [active, focusPhase, mapRef, mode, panelVisible]);

  const tilesPlaying = mode === 'grid' && !warming;
  const showFocus = active && !warming && panelVisible
    && (mode === 'expanding' || mode === 'focus' || mode === 'collapsing');
  const isFull = focusPhase === FOCUS_PHASE.FULL;
  const coverMain = warming || showFocus;

  useEffect(() => {
    setMosaicClockEnabled(Boolean(active && tilesPlaying));
    return () => setMosaicClockEnabled(false);
  }, [active, tilesPlaying]);

  const mountSlotIds = useMemo(
    () => slotDefs.filter((id) => visible.has(id)),
    [slotDefs, visible],
  );
  const mountedSlots = useMosaicTileMountQueue({
    active,
    presetId: mosaicRuntime?.presetId || null,
    slotIds: mountSlotIds,
  });

  useEffect(() => {
    if (!onTilesReady) return undefined;
    if (!active) {
      onTilesReady(false);
      return undefined;
    }
    const allMounted = mountSlotIds.length > 0
      && mountSlotIds.every((id) => mountedSlots.has(id));
    if (!allMounted) {
      onTilesReady(false);
      return undefined;
    }
    let timeoutId = 0;
    const raf = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => onTilesReady(true), 80);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, mosaicRuntime?.presetId, mountSlotIds, mountedSlots, onTilesReady]);

  const catalogsByStageId = useMemo(() => {
    const map = new Map();
    const bundle = {
      objects,
      events,
      situations,
      situationRevisions,
      actionTypes,
      countriesList,
    };
    const wanted = new Set();
    Object.values(screens).forEach((screen) => {
      if (screen?.stage_id != null) wanted.add(String(screen.stage_id));
    });
    if (!wanted.size) return map;
    (stages || []).forEach((stage) => {
      if (stage?.id == null) return;
      const id = String(stage.id);
      if (!wanted.has(id)) return;
      map.set(id, sliceCatalogsForStage(stage, bundle));
    });
    return map;
  }, [
    actionTypes,
    countriesList,
    events,
    objects,
    screens,
    situationRevisions,
    situations,
    stages,
  ]);

  const rootClassName = useMemo(() => [
    'demo-mosaic',
    active ? 'demo-mosaic--multi' : 'demo-mosaic--mono',
    `demo-mosaic--layout-${layout}`,
    `demo-mosaic--${mode}`,
    showFocus ? 'demo-mosaic--focus-mode' : '',
    transitioning ? `demo-mosaic--${transitioning}` : '',
    focusHidden && mode === 'grid' && !warming ? 'demo-mosaic--focus-hidden' : '',
    warming ? 'demo-mosaic--warming' : '',
    !warming && tilesReady ? 'demo-mosaic--preloaded' : '',
    flipPrep ? 'demo-mosaic--flip-prep' : '',
    showFocus ? 'demo-mosaic--panel-visible' : '',
    isFull ? 'demo-mosaic--focus-full' : '',
  ].filter(Boolean).join(' '), [
    active,
    flipPrep,
    focusHidden,
    isFull,
    layout,
    mode,
    showFocus,
    tilesReady,
    transitioning,
    warming,
  ]);

  const rootStyle = useMemo(() => ({
    '--demo-mosaic-ms': `${transitionMs}ms`,
    '--demo-mosaic-ease': cssEasing,
    '--focus-outline': SLOT_OUTLINE[focusSlot] || SLOT_OUTLINE.a,
  }), [cssEasing, focusSlot, transitionMs]);

  const focusStyle = useMemo(() => {
    if (!active) return undefined;
    const transition = (!flipPrep && animKind === ANIM.TRANSFORM)
      ? `transform ${phaseMs}ms ${cssEasing}`
      : 'none';

    const style = {
      opacity: coverMain ? 1 : 0,
      visibility: coverMain ? 'visible' : 'hidden',
      pointerEvents: coverMain ? 'auto' : 'none',
      transformOrigin: 'center center',
      transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale.x}, ${scale.y})`,
      transition,
      borderRadius: isFull ? 0 : undefined,
      boxShadow: isFull ? '0 0 0 0 transparent' : undefined,
    };
    if (focusGeom) {
      style.top = `${focusGeom.t}px`;
      style.left = `${focusGeom.l}px`;
      style.width = `${focusGeom.w}px`;
      style.height = `${focusGeom.h}px`;
    } else {
      // Не сжимаем основную карту до 0×0 на сетке — иначе MapLibre resize
      // совпадает с mount плиток и даёт подвисание на первом запуске.
      style.top = 0;
      style.left = 0;
      style.width = '100%';
      style.height = '100%';
    }
    return style;
  }, [
    active,
    animKind,
    coverMain,
    cssEasing,
    flipPrep,
    focusGeom,
    isFull,
    phaseMs,
    scale.x,
    scale.y,
    translate.x,
    translate.y,
  ]);

  return (
    <div ref={rootRef} className={rootClassName} style={rootStyle}>
      {active && (
        <div className="demo-mosaic__grid" aria-hidden={warming}>
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
            const isVacated = Boolean(focusSlot && focusSlot === slotId && showFocus);
            const screen = screens[slotId];
            const delay = reveal === 'stagger' ? index * staggerMs : 0;
            const mapMounted = mountedSlots.has(slotId);
            return (
              <div
                key={slotId}
                className={[
                  'demo-mosaic__cell',
                  `demo-mosaic__cell--${slotId}`,
                  isVacated ? 'demo-mosaic__cell--vacated' : '',
                  mapMounted ? '' : 'demo-mosaic__cell--pending',
                ].filter(Boolean).join(' ')}
                style={{ animationDelay: `${delay}ms` }}
              >
                {mapMounted ? (
                  <DemoMosaicTile
                    slotId={slotId}
                    screen={screen}
                    stages={stages}
                    startDelayMs={0}
                    playing={tilesPlaying && !isVacated}
                    catalogs={
                      screen?.stage_id != null
                        ? (catalogsByStageId.get(String(screen.stage_id)) || null)
                        : null
                    }
                  />
                ) : (
                  <div className={`demo-mosaic-tile demo-mosaic-tile--${slotId} demo-mosaic-tile--pending`}>
                    <div className="demo-mosaic-tile__skeleton" aria-hidden="true" />
                    <div className="demo-mosaic-tile__label">
                      <span>{screen?.label || DEMO_MOSAIC_SLOT_LABELS[slotId] || slotId.toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div
        ref={focusElRef}
        className="demo-mosaic__focus"
        style={focusStyle}
        aria-hidden={!coverMain}
      >
        {children}
      </div>
    </div>
  );
}

export default memo(DemoMosaicShell);
