import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import DemoMosaicTile from './DemoMosaicTile';
import DemoCueMark from './DemoCueMark';
import {
  DEMO_EASING_CSS,
  DEMO_MOSAIC_EXPAND_ANIMATION,
  DEMO_MOSAIC_SLOT_LABELS,
  getMosaicLayoutDef,
  mosaicScreenHasVideo,
  mosaicScreenGridStageId,
  mosaicScreenStageIds,
} from '../../utils/demoScenario';
import { resolveMediaUrl } from '../../utils/mediaUrl';
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
  onHandoffPrepare = null,
  onSwitchComplete = null,
  cue = null,
  children,
}) {
  const rootRef = useRef(null);
  const focusElRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const rafRef = useRef(0);
  const morphGenRef = useRef(0);
  const morphingRef = useRef(false);
  const slotOriginRef = useRef(null);
  const prevModeRef = useRef(null);
  const prevFocusSlotRef = useRef(null);
  const incomingGenRef = useRef(0);
  const incomingTimerRef = useRef(null);
  const incomingRafRef = useRef(0);
  const incomingRunningRef = useRef(null);
  const paintedSlotsRef = useRef(new Set());

  const [focusGeom, setFocusGeom] = useState(null);
  const [translate, setTranslate] = useState(ZERO_TX);
  const [scale, setScale] = useState(IDENTITY_SCALE);
  const [focusPhase, setFocusPhase] = useState(FOCUS_PHASE.SLOT);
  const [animKind, setAnimKind] = useState(ANIM.NONE);
  const [phaseMs, setPhaseMs] = useState(350);
  const [flipPrep, setFlipPrep] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [incomingSlotId, setIncomingSlotId] = useState(null);
  const [incomingTx, setIncomingTx] = useState(ZERO_TX);
  const [incomingScale, setIncomingScale] = useState(IDENTITY_SCALE);
  const [incomingMs, setIncomingMs] = useState(700);
  const [incomingPrep, setIncomingPrep] = useState(false);
  const [incomingAnim, setIncomingAnim] = useState(false);
  const [paintedCount, setPaintedCount] = useState(0);
  const [liveMapVisible, setLiveMapVisible] = useState(true);

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
  const incomingSlot = mosaicRuntime?.incomingSlot || null;
  const fromSlot = mosaicRuntime?.fromSlot || null;
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

  const clearIncomingTimers = useCallback(() => {
    if (incomingTimerRef.current) {
      clearTimeout(incomingTimerRef.current);
      incomingTimerRef.current = null;
    }
    if (incomingRafRef.current) {
      cancelAnimationFrame(incomingRafRef.current);
      incomingRafRef.current = 0;
    }
  }, []);

  const clearIncomingVisual = useCallback(() => {
    incomingRunningRef.current = null;
    setIncomingSlotId(null);
    setIncomingTx(ZERO_TX);
    setIncomingScale(IDENTITY_SCALE);
    setIncomingPrep(false);
    setIncomingAnim(false);
  }, []);

  const holdFull = useCallback(() => {
    commitFull();
  }, [commitFull]);

  const runIncomingExpand = useCallback((toSlot, { retry = 0 } = {}) => {
    clearIncomingTimers();
    const gen = ++incomingGenRef.current;
    incomingRunningRef.current = toSlot;

    const reduced = prefersReducedMotion();
    const rect = toSlot ? readSlotRect(toSlot) : null;

    if (!rect && retry < 2) {
      incomingRafRef.current = requestAnimationFrame(() => {
        if (gen !== incomingGenRef.current) return;
        incomingRunningRef.current = null;
        runIncomingExpand(toSlot, { retry: retry + 1 });
      });
      return;
    }

    const afterIncomingPaint = (fn) => {
      incomingRafRef.current = requestAnimationFrame(() => {
        if (gen !== incomingGenRef.current) return;
        incomingRafRef.current = requestAnimationFrame(() => {
          if (gen !== incomingGenRef.current) return;
          fn();
        });
      });
    };

    const finishIncoming = () => {
      if (gen !== incomingGenRef.current) return;
      onHandoffPrepare?.();
      // Плитка уже закрывает экран: останавливаем исходящую свёртку,
      // чтобы её таймеры не сжали основную карту после commitFull.
      morphGenRef.current += 1;
      clearTimers();
      morphingRef.current = false;
      commitFull();
      afterIncomingPaint(() => {
        clearIncomingTimers();
        clearIncomingVisual();
        onSwitchComplete?.();
      });
    };

    if (!rect || reduced) {
      finishIncoming();
      return;
    }

    const root = rootRef.current;
    const cell = root?.querySelector(`.demo-mosaic__cell--${toSlot}`) || root;
    const full = rootFullRect(root);
    const toCenter = {
      x: full.w / 2 - (rect.l + rect.w / 2),
      y: full.h / 2 - (rect.t + rect.h / 2),
    };
    const scaleFromSlot = fillScale(rect, full);
    const { first: ms1, second: ms2 } = splitDuration(transitionMs);

    flushSync(() => {
      setIncomingPrep(true);
      setIncomingAnim(false);
      setIncomingSlotId(toSlot);
      setIncomingTx(ZERO_TX);
      setIncomingScale(IDENTITY_SCALE);
      setIncomingMs(useCenterThenStretch ? ms1 : transitionMs);
    });
    forceReflow(cell);

    if (!useCenterThenStretch) {
      afterIncomingPaint(() => {
        flushSync(() => {
          setIncomingPrep(false);
          setIncomingAnim(true);
          setIncomingTx(toCenter);
          setIncomingScale(scaleFromSlot);
        });
        incomingTimerRef.current = setTimeout(finishIncoming, transitionMs);
      });
      return;
    }

    afterIncomingPaint(() => {
      flushSync(() => {
        setIncomingPrep(false);
        setIncomingAnim(true);
        setIncomingTx(toCenter);
        setIncomingScale(IDENTITY_SCALE);
      });
      incomingTimerRef.current = setTimeout(() => {
        if (gen !== incomingGenRef.current) return;
        flushSync(() => {
          setIncomingPrep(true);
          setIncomingAnim(false);
          setIncomingMs(ms2);
        });
        forceReflow(cell);
        flushSync(() => setIncomingPrep(false));
        afterIncomingPaint(() => {
          flushSync(() => {
            setIncomingAnim(true);
            setIncomingScale(scaleFromSlot);
          });
          incomingTimerRef.current = setTimeout(finishIncoming, ms2);
        });
      }, ms1);
    });
  }, [
    clearIncomingTimers,
    clearIncomingVisual,
    clearTimers,
    commitFull,
    onHandoffPrepare,
    onSwitchComplete,
    readSlotRect,
    transitionMs,
    useCenterThenStretch,
  ]);

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
      prevModeRef.current = null;
      prevFocusSlotRef.current = null;
      morphGenRef.current += 1;
      incomingGenRef.current += 1;
      incomingRunningRef.current = null;
      clearTimers();
      clearIncomingTimers();
      morphingRef.current = false;
      slotOriginRef.current = null;
      setFlipPrep(false);
      setPanelVisible(false);
      setFocusGeom(null);
      setTranslate(ZERO_TX);
      setScale(IDENTITY_SCALE);
      setFocusPhase(FOCUS_PHASE.SLOT);
      setAnimKind(ANIM.NONE);
      clearIncomingVisual();
      return undefined;
    }

    if (mode === 'switching') {
      prevModeRef.current = mode;
      if (incomingSlot && incomingRunningRef.current !== incomingSlot) {
        runIncomingExpand(incomingSlot);
      }
      return undefined;
    }

    if (mode === 'expanding' && focusSlot) {
      const shouldMorph = prevModeRef.current !== 'expanding'
        || prevFocusSlotRef.current !== focusSlot;
      prevModeRef.current = mode;
      prevFocusSlotRef.current = focusSlot;
      if (shouldMorph) runMorph('expand');
      return undefined;
    }

    if (mode === 'collapsing' && focusSlot) {
      prevModeRef.current = mode;
      incomingGenRef.current += 1;
      clearIncomingTimers();
      clearIncomingVisual();
      runMorph('collapse');
      return undefined;
    }

    if (mode === 'focus') {
      prevModeRef.current = mode;
      if (!morphingRef.current && focusPhase !== FOCUS_PHASE.FULL) {
        holdFull();
      }
      return undefined;
    }

    prevModeRef.current = mode;
    incomingGenRef.current += 1;
    clearIncomingTimers();
    clearIncomingVisual();

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
  }, [
    active,
    clearIncomingTimers,
    clearIncomingVisual,
    clearTimers,
    focusSlot,
    holdFull,
    incomingSlot,
    layout,
    mode,
    runIncomingExpand,
    runMorph,
  ]);

  useEffect(() => () => {
    morphGenRef.current += 1;
    incomingGenRef.current += 1;
    clearTimers();
    clearIncomingTimers();
  }, [clearIncomingTimers, clearTimers]);

  // Resize только в steady fullscreen (не во время morph).
  useEffect(() => {
    if (!active || !panelVisible) return undefined;
    if (mode === 'expanding' || mode === 'collapsing' || mode === 'switching') return undefined;
    if (focusPhase !== FOCUS_PHASE.FULL) return undefined;
    resizeLiveMap(mapRef?.current);
    return undefined;
  }, [active, focusPhase, mapRef, mode, panelVisible]);

  const tilesPlaying = mode === 'grid' && !warming && !mosaicRuntime?.handoff;
  const showFocus = active && !warming && panelVisible
    && (mode === 'expanding' || mode === 'focus' || mode === 'collapsing' || mode === 'switching');
  const isFull = focusPhase === FOCUS_PHASE.FULL;
  const coverMain = warming || showFocus;

  const coverVideoUrl = useMemo(() => {
    if (!active || !showFocus) return null;
    const outgoingId = fromSlot || focusSlot;
    const coverId = mode === 'switching' ? outgoingId : focusSlot;
    const screen = coverId ? screens[coverId] : null;
    if (!mosaicScreenHasVideo(screen)) return null;
    return resolveMediaUrl(screen.video_url);
  }, [active, focusSlot, fromSlot, mode, screens, showFocus]);

  useEffect(() => {
    if (!coverVideoUrl) {
      setLiveMapVisible(true);
      return undefined;
    }
    if (mode === 'expanding' || mode === 'collapsing' || mode === 'switching') {
      setLiveMapVisible(false);
      return undefined;
    }
    if (mode === 'focus') {
      const timer = window.setTimeout(() => setLiveMapVisible(true), 40);
      return () => window.clearTimeout(timer);
    }
    setLiveMapVisible(false);
    return undefined;
  }, [coverVideoUrl, mode]);

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
    paintedSlotsRef.current = new Set();
    setPaintedCount(0);
  }, [active, mosaicRuntime?.presetId]);

  const onTilePainted = useCallback((slotId) => {
    if (!slotId || paintedSlotsRef.current.has(slotId)) return;
    paintedSlotsRef.current.add(slotId);
    setPaintedCount(paintedSlotsRef.current.size);
  }, []);

  useEffect(() => {
    if (!onTilesReady) return undefined;
    if (!active) {
      onTilesReady(false);
      return undefined;
    }
    const allMounted = mountSlotIds.length > 0
      && mountSlotIds.every((id) => mountedSlots.has(id));
    const allPainted = allMounted
      && mountSlotIds.every((id) => paintedSlotsRef.current.has(id));
    if (!allPainted) {
      onTilesReady(false);
      return undefined;
    }
    let timeoutId = 0;
    const raf = requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => onTilesReady(true), 120);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, mosaicRuntime?.presetId, mountSlotIds, mountedSlots, onTilesReady, paintedCount]);

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
      mosaicScreenStageIds(screen).forEach((id) => wanted.add(String(id)));
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
    incomingSlotId ? 'demo-mosaic--incoming' : '',
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
    incomingSlotId,
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
      zIndex: incomingSlotId ? 3 : undefined,
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
    incomingSlotId,
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
            const isIncoming = incomingSlotId === slotId;
            const vacatedSlot = fromSlot || focusSlot;
            const isVacated = Boolean(vacatedSlot && vacatedSlot === slotId && showFocus && !isIncoming);
            const screen = screens[slotId];
            const delay = reveal === 'stagger' ? index * staggerMs : 0;
            const mapMounted = mountedSlots.has(slotId);
            const incomingStyle = isIncoming
              ? {
                animationDelay: `${delay}ms`,
                transformOrigin: 'center center',
                transform: `translate3d(${incomingTx.x}px, ${incomingTx.y}px, 0) scale(${incomingScale.x}, ${incomingScale.y})`,
                transition: (!incomingPrep && incomingAnim)
                  ? `transform ${incomingMs}ms ${cssEasing}`
                  : 'none',
                zIndex: 4,
              }
              : { animationDelay: `${delay}ms` };
            return (
              <div
                key={slotId}
                className={[
                  'demo-mosaic__cell',
                  `demo-mosaic__cell--${slotId}`,
                  isVacated ? 'demo-mosaic__cell--vacated' : '',
                  isIncoming ? 'demo-mosaic__cell--incoming' : '',
                  mapMounted ? '' : 'demo-mosaic__cell--pending',
                ].filter(Boolean).join(' ')}
                style={incomingStyle}
              >
                {mapMounted ? (
                  <DemoMosaicTile
                    slotId={slotId}
                    screen={screen}
                    stages={stages}
                    startDelayMs={0}
                    playing={tilesPlaying && !isVacated}
                    onPainted={onTilePainted}
                    catalogs={
                      mosaicScreenGridStageId(screen)
                        ? (catalogsByStageId.get(String(mosaicScreenGridStageId(screen))) || null)
                        : null
                    }
                  />
                ) : (
                  <div className={`demo-mosaic-tile demo-mosaic-tile--${slotId} demo-mosaic-tile--pending`}>
                    <DemoCueMark value={screen?.cue} size="sm" />
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
        <div
          className={[
            'demo-mosaic__focus-live',
            coverVideoUrl && !liveMapVisible ? 'demo-mosaic__focus-live--hidden' : '',
          ].filter(Boolean).join(' ')}
        >
          {children}
        </div>
        {coverVideoUrl ? (
          <video
            className={[
              'demo-mosaic__focus-video',
              liveMapVisible ? 'demo-mosaic__focus-video--hidden' : '',
            ].filter(Boolean).join(' ')}
            src={coverVideoUrl}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
          />
        ) : null}
      </div>
      <DemoCueMark value={cue} size="lg" />
    </div>
  );
}

export default memo(DemoMosaicShell);
