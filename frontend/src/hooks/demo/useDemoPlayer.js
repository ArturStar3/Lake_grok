import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  DEMO_CAMERA_MODE,
  DEMO_EFFECT,
  DEMO_MOSAIC_ACTION,
  DEMO_MOSAIC_REVEAL,
  DEMO_PROGRAM_TRANSITION,
  DEMO_SEQUENCE_TYPE,
  DEMO_TOOL,
  buildProgramPlayback,
  composeStateForStage,
  createDefaultSequenceItem,
  findStage,
  normalizeScenario,
  resolveMosaicScreen,
} from '../../utils/demoScenario';
import { getEventCenter } from '../../utils/eventGeometry';
import { getSituationBounds } from '../../utils/situationUtils';
import { clearMosaicCatalogCache } from '../../utils/demoMosaicCatalog';

/** Пауза после ручного взаимодействия с картой, прежде чем таймер пойдёт дальше. */
const INTERACTION_RESUME_DELAY_MS = 1500;

const EMPTY_PROGRESS = {
  beatElapsedMs: 0,
  beatProgress: 0,
  stageProgress: 0,
  scenarioProgress: 0,
};

export const DEMO_STATUS = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
};

export const DEMO_BLACKOUT = {
  NONE: 'none',
  BLACK: 'black',
  WHITE: 'white',
};

const EMPTY_ANIMATION = {
  active: false,
  runId: 0,
  effects: {},
};

const EMPTY_TEXTS = [];

const EMPTY_MOSAIC = {
  active: false,
  mode: 'grid',
  layout: '2x2',
  transitionMs: 700,
  transitioning: null,
  focusHidden: false,
  focusSlot: null,
  visibleSlotIds: [],
  screens: {},
  presetId: null,
  reveal: 'all',
  staggerMs: 0,
};

function emptyComposedState() {
  return {
    target_ids: [],
    event_ids: [],
    situation_ids: [],
    zone_leaves: [],
    overlay_layer_ids: [],
    texts: [],
    contentStep: null,
    cameraStep: null,
  };
}

function mosaicRuntimeFromPreset(preset, stages, {
  transitioning = null,
  reveal = null,
  staggerMs = null,
} = {}) {
  if (!preset) return { ...EMPTY_MOSAIC };
  const screens = {};
  (preset.screens || []).forEach((screen) => {
    screens[screen.id] = resolveMosaicScreen(screen, stages);
  });
  return {
    active: true,
    mode: 'grid',
    layout: preset.layout || '2x2',
    transitionMs: preset.transition_ms || 700,
    transitioning,
    focusHidden: true,
    focusSlot: null,
    visibleSlotIds: (preset.screens || []).map((screen) => screen.id),
    screens,
    presetId: preset.id,
    reveal: reveal || preset.reveal || DEMO_MOSAIC_REVEAL.ALL,
    staggerMs: staggerMs ?? preset.stagger_ms ?? 0,
    expandableSlots: preset.expandable_slots || [],
  };
}

function composedStateForProgramItem(item, beatIndex) {
  if (item?.kind === DEMO_SEQUENCE_TYPE.STAGE && item.stage) {
    return composeStateForStage(item.stage, beatIndex);
  }
  if (item?.kind === DEMO_SEQUENCE_TYPE.MOSAIC && item.focusStage
    && (item.mosaicAction === DEMO_MOSAIC_ACTION.EXPAND
      || item.mosaicAction === DEMO_MOSAIC_ACTION.COLLAPSE)) {
    return composeStateForStage(item.focusStage);
  }
  return emptyComposedState();
}

/** Тексты, которые останутся после текущего такта — если ключа нет, пора играть выход. */
function nextComposedTexts(items, itemIndex, beatIndex, scenario) {
  const item = items[itemIndex];
  if (!item || item.kind !== DEMO_SEQUENCE_TYPE.STAGE || !item.stage) return [];
  if (beatIndex + 1 < (item.beats?.length || 0)) {
    return composeStateForStage(item.stage, beatIndex + 1).texts;
  }
  const nextIndex = itemIndex + 1 < items.length
    ? itemIndex + 1
    : (scenario?.loop && items.length ? 0 : -1);
  if (nextIndex < 0) return [];
  const next = items[nextIndex];
  if (next?.kind === DEMO_SEQUENCE_TYPE.STAGE && next.stage) {
    return composeStateForStage(next.stage, 0).texts;
  }
  return [];
}

function prefetchTargetFromItem(item, stages) {
  if (!item) return null;
  if (item.kind === DEMO_SEQUENCE_TYPE.STAGE) return item.stage;
  const steps = [];
  (item.preset?.screens || []).forEach((screen) => {
    const stage = findStage(stages, screen.stage_id);
    if (stage?.steps) steps.push(...stage.steps);
  });
  return steps.length ? { steps } : null;
}

function resolveIdsAgainst(collection, wantedIds, getId = (item) => item.id) {
  if (!wantedIds?.length || !collection?.length) return [];
  const wanted = new Set(wantedIds.map(String));
  return collection
    .filter((item) => wanted.has(String(getId(item))))
    .map((item) => getId(item));
}

function boundsFromLatLngs(latLngs) {
  const valid = latLngs.filter(
    (point) => point && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  );
  if (!valid.length) return null;
  return L.latLngBounds(valid);
}

function isContentStep(step) {
  return step?.tool === DEMO_TOOL.FORMULAR || step?.tool === DEMO_TOOL.COUNTRY;
}

function contentIdsForStep(step) {
  if (!step) return [];
  if (step.tool === DEMO_TOOL.FORMULAR) {
    return (step.selection?.target_ids || []).map(String).filter(Boolean);
  }
  if (step.tool === DEMO_TOOL.COUNTRY) {
    return (step.selection?.country_isos || []).map((iso) => String(iso).trim().toUpperCase()).filter(Boolean);
  }
  return [];
}

function contentPlaybackSlots(step) {
  const ids = contentIdsForStep(step);
  if (!ids.length) return [];
  const cardIds = (step.selection?.card_ids || []).map(String).filter(Boolean);
  if (!cardIds.length) {
    return ids.map((entityId) => ({ entityId, cardId: null }));
  }
  const slots = [];
  ids.forEach((entityId) => {
    cardIds.forEach((cardId) => slots.push({ entityId, cardId }));
  });
  return slots;
}

/**
 * Плеер режима демонстрации.
 *
 * Сценарий раскладывается на **блоки программы** (этап или мультиэкран)
 * и **такты** внутри этапа. Плеер ничего не рисует сам: он применяет свёрнутое
 * состояние через те же сеттеры, которыми пользуется оператор, и отдаёт
 * наружу описание активных анимаций (`demoAnimation`) и текстов (`demoTexts`).
 */
export function useDemoPlayer({ actions, data }) {
  const [scenario, setScenario] = useState(null);
  const [status, setStatus] = useState(DEMO_STATUS.IDLE);
  const [stageIndex, setStageIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [beatElapsedMs, setBeatElapsedMs] = useState(0);
  const [animationRunId, setAnimationRunId] = useState(0);
  const [waitingForPresenter, setWaitingForPresenter] = useState(false);
  const [blackout, setBlackout] = useState(DEMO_BLACKOUT.NONE);
  const [hideFinishedTexts, setHideFinishedTexts] = useState(false);
  const [mosaicRuntime, setMosaicRuntime] = useState(EMPTY_MOSAIC);

  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const dataRef = useRef(data);
  dataRef.current = data;

  const beatStartedAtRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const frameRef = useRef(null);
  const lastFrameAtRef = useRef(0);
  const snapshotRef = useRef(null);
  const progressRef = useRef(EMPTY_PROGRESS);
  const progressListenersRef = useRef(new Set());
  const timelineRef = useRef({
    beatDurationMs: 0,
    beatStartMs: 0,
    stageDurationMs: 0,
    stageStartMs: 0,
    totalMs: 0,
  });
  const advanceRef = useRef(() => {});
  const lastContentKeyRef = useRef(null);
  const interactionHoldsRef = useRef(0);
  const interactionReleaseTimerRef = useRef(null);
  const applyTokenRef = useRef(0);
  const mosaicTransitionTimerRef = useRef(null);
  const mosaicRuntimeRef = useRef(EMPTY_MOSAIC);
  mosaicRuntimeRef.current = mosaicRuntime;
  const enterTimerRef = useRef(null);
  const exitTimerRef = useRef(null);

  const program = useMemo(() => buildProgramPlayback(scenario || {}), [scenario]);
  const programItems = program.items;
  const currentItem = programItems[stageIndex] || null;
  const currentStage = currentItem;
  const currentBeat = currentItem?.beats?.[beatIndex] || null;
  const isActive = status !== DEMO_STATUS.IDLE && Boolean(currentItem);

  /** Состояние карты текущего блока программы (этап) или пустое (мультиэкран). */
  const composedState = useMemo(
    () => composedStateForProgramItem(currentItem, beatIndex),
    [currentItem, beatIndex],
  );

  /** Снимок пользовательского состояния карты, чтобы вернуть его после показа. */
  const captureSnapshot = useCallback(() => {
    const current = dataRef.current;
    snapshotRef.current = {
      selectedObj: [...(current.selectedObj || [])],
      selectedEvents: [...(current.selectedEvents || [])],
      selectedSituations: [...(current.selectedSituations || [])],
      selectedTargetId: current.selectedTargetId ?? null,
      selectedCountryIso: current.selectedCountryIso ?? null,
      detailSituation: current.detailSituation ?? null,
      timelineRevisionId: current.timelineRevisionId ?? null,
      zoneLeaves: current.enabledZoneLeaves ? [...current.enabledZoneLeaves] : [],
      overlayLayerIds: typeof current.getEnabledOverlayLayerIds === 'function'
        ? current.getEnabledOverlayLayerIds()
        : (current.enabledOverlayLayerIds ? [...current.enabledOverlayLayerIds] : null),
      center: current.mapRef?.current?.getCenter?.() || null,
      zoom: current.mapRef?.current?.getZoom?.() ?? null,
    };
  }, []);

  const restoreSnapshot = useCallback(() => {
    const snapshot = snapshotRef.current;
    const api = actionsRef.current;
    if (!snapshot) return;
    snapshotRef.current = null;

    api.resetZoneFilters?.(false);
    if (snapshot.zoneLeaves.length) {
      api.setZoneLeavesBatch?.(snapshot.zoneLeaves, true);
    }
    api.setSelectedObj?.(snapshot.selectedObj);
    api.setSelectedEvents?.(snapshot.selectedEvents);
    api.setSelectedSituations?.(snapshot.selectedSituations);
    api.setSelectedTargetId?.(snapshot.selectedTargetId ?? null);
    api.setSelectedCountryIso?.(snapshot.selectedCountryIso ?? null);
    api.setDetailSituation?.(snapshot.detailSituation ?? null);
    api.setTimelineRevisionId?.(snapshot.timelineRevisionId);
    if (Array.isArray(snapshot.overlayLayerIds)) {
      api.setOverlayLayers?.(snapshot.overlayLayerIds);
    }
    if (snapshot.center && snapshot.zoom != null) {
      api.flyTo?.(snapshot.center.lat, snapshot.center.lng, snapshot.zoom);
    }
  }, []);

  /** Границы выбранных в шаге сущностей — для режима камеры «вписать выбранное». */
  const computeStepBounds = useCallback((step) => {
    const current = dataRef.current;
    const selection = step.selection || {};

    if (
      (step.tool === DEMO_TOOL.OBJECTS || step.tool === DEMO_TOOL.FORMULAR)
      && selection.target_ids?.length
    ) {
      const wanted = new Set(selection.target_ids.map(String));
      return boundsFromLatLngs(
        (current.objects || [])
          .filter((obj) => wanted.has(String(obj.id)))
          .map((obj) => [obj.lat, obj.lng]),
      );
    }

    if (step.tool === DEMO_TOOL.EVENTS && selection.event_ids?.length) {
      const wanted = new Set(selection.event_ids.map(String));
      return boundsFromLatLngs(
        (current.events || [])
          .filter((item) => wanted.has(String(item.id)))
          .map((item) => getEventCenter(item))
          .filter(Boolean),
      );
    }

    if (step.tool === DEMO_TOOL.SITUATIONS && selection.situation_ids?.length) {
      const wanted = new Set(selection.situation_ids.map(String));
      let merged = null;
      (current.situations || [])
        .filter((item) => wanted.has(String(item.id)))
        .forEach((item) => {
          const bounds = getSituationBounds(item);
          if (!bounds) return;
          merged = merged ? merged.extend(bounds) : L.latLngBounds(bounds);
        });
      return merged;
    }

    if (
      (step.tool === DEMO_TOOL.ZONES || step.tool === DEMO_TOOL.INUNDATION)
      && selection.zone_leaves?.length
    ) {
      const countries = new Set(selection.zone_leaves.map((leaf) => leaf.country));
      return boundsFromLatLngs(
        (current.objects || [])
          .filter((obj) => countries.has(obj.country?.title))
          .map((obj) => [obj.lat, obj.lng]),
      );
    }

    if (step.tool === DEMO_TOOL.COUNTRY && selection.country_isos?.length) {
      const isos = new Set(selection.country_isos.map((iso) => String(iso).toUpperCase()));
      const titles = new Set(
        (current.countriesList || [])
          .filter((country) => isos.has(String(country.iso_code || '').toUpperCase()))
          .map((country) => country.title)
          .filter(Boolean),
      );
      const fromObjects = boundsFromLatLngs(
        (current.objects || [])
          .filter((obj) => {
            const iso = String(obj.country?.iso_code || '').toUpperCase();
            const title = obj.country?.title;
            return isos.has(iso) || (title && titles.has(title));
          })
          .map((obj) => [obj.lat, obj.lng]),
      );
      if (fromObjects) return fromObjects;
      const firstIso = selection.country_isos[0];
      return current.getCountryBounds?.(firstIso) || null;
    }

    return null;
  }, []);

  const applyCamera = useCallback((step, { instant = false } = {}) => {
    const api = actionsRef.current;
    const camera = step?.camera || {};
    // Leaflet при animate:false выполняет обычный setView — нужный эффект
    // для перехода назад и прыжков по этапам.
    const animation = instant
      ? { animate: false, duration: 0 }
      : { duration: camera.duration_ms / 1000, easeLinearity: camera.ease_linearity };

    if (camera.mode === DEMO_CAMERA_MODE.FLY_TO) {
      if (camera.lat == null || camera.lng == null) return;
      api.flyTo?.(camera.lat, camera.lng, camera.zoom, animation);
      return;
    }
    if (camera.mode === DEMO_CAMERA_MODE.FIT_SELECTION) {
      const bounds = computeStepBounds(step);
      if (!bounds) return;
      api.flyToBounds?.(bounds, {
        padding: [camera.padding, camera.padding],
        maxZoom: camera.zoom,
        ...animation,
      });
    }
  }, [computeStepBounds]);

  /** Подгружает данные, нужные шагам этапа (вкладки при этом не переключаются). */
  const prefetchForStage = useCallback(async (stage) => {
    if (!stage) return;
    const api = actionsRef.current;
    const current = dataRef.current;
    const tasks = [];

    const needsEvents = stage.steps.some((step) => step.tool === DEMO_TOOL.EVENTS);
    if (needsEvents && !(current.events || []).length) {
      tasks.push(api.fetchEvents?.());
    }

    const situationSteps = stage.steps.filter((step) => step.tool === DEMO_TOOL.SITUATIONS);
    if (situationSteps.length) {
      if (!(current.situations || []).length) {
        tasks.push(api.fetchSituations?.());
      }
      const situationIds = situationSteps.flatMap(
        (step) => (step.selection?.situation_ids || []).slice(0, 1),
      );
      if (situationIds.length) {
        tasks.push(api.loadSituationRevisions?.(situationIds));
      }
    }

    await Promise.all(tasks.filter(Boolean).map((task) => Promise.resolve(task).catch(() => null)));
  }, []);

  /**
   * Применяет свёрнутое состояние сценария целиком, а не по приращению:
   * только так переход назад и прыжок по этапам дают тот же вид карты,
   * что и последовательный проход вперёд.
   */
  const applyState = useCallback((state, { instant = false } = {}) => {
    const api = actionsRef.current;
    const current = dataRef.current;

    api.setSelectedObj?.(resolveIdsAgainst(current.objects, state.target_ids));
    api.setSelectedEvents?.(resolveIdsAgainst(current.events, state.event_ids));

    const situationIds = resolveIdsAgainst(current.situations, state.situation_ids).slice(0, 1);
    if (situationIds.length) {
      const situation = (current.situations || []).find(
        (item) => String(item.id) === String(situationIds[0]),
      );
      api.setSelectedSituations?.(situationIds);
      api.setFocusedSituationId?.(situationIds[0]);
      api.setDetailSituation?.(situation || null);
    } else {
      api.setSelectedSituations?.([]);
      api.setFocusedSituationId?.(null);
      api.setDetailSituation?.(null);
      api.setTimelineRevisionId?.(null);
    }

    api.resetZoneFilters?.(false);
    if (state.zone_leaves.length) {
      api.setZoneLeavesBatch?.(
        state.zone_leaves.map((leaf) => ({
          country: leaf.country,
          actionTypeId: leaf.action_type_id,
          leaf: leaf.leaf,
        })),
        true,
      );
    }

    if (Array.isArray(state.overlay_layer_ids)) {
      api.setOverlayLayers?.(state.overlay_layer_ids);
    }

    if (!state.contentStep) {
      api.setSelectedTargetId?.(null);
      api.setSelectedCountryIso?.(null);
      api.setDemoContentCardId?.(null);
      lastContentKeyRef.current = null;
    }

    if (state.cameraStep) applyCamera(state.cameraStep, { instant });
  }, [applyCamera]);

  const stopFrameLoop = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  /**
   * Прогресс такта раздаётся подписчикам мимо состояния React.
   *
   * Раньше он лежал в useState и обновлялся 10 раз в секунду: каждый такой
   * тик перерисовывал Formular целиком вместе с картой ради одной полоски в
   * HUD. Теперь значение пишется в ref, а HUD правит ширину полосы прямо в
   * DOM — рендеров нет вовсе, а полоса едет с частотой кадров, а не рывками.
   */
  const publishProgress = useCallback((elapsedMs) => {
    const timeline = timelineRef.current;
    const stageElapsedMs = timeline.beatStartMs + elapsedMs;
    const next = {
      beatElapsedMs: elapsedMs,
      beatProgress: timeline.beatDurationMs
        ? Math.min(1, elapsedMs / timeline.beatDurationMs)
        : 0,
      stageProgress: timeline.stageDurationMs
        ? Math.min(1, stageElapsedMs / timeline.stageDurationMs)
        : 0,
      scenarioProgress: timeline.totalMs
        ? Math.min(1, (timeline.stageStartMs + stageElapsedMs) / timeline.totalMs)
        : 0,
    };
    progressRef.current = next;
    progressListenersRef.current.forEach((listener) => {
      try {
        listener(next);
      } catch (err) {
        console.warn('Ошибка подписчика прогресса демонстрации', err);
      }
    });
  }, []);

  const subscribeProgress = useCallback((listener) => {
    if (typeof listener !== 'function') return () => {};
    progressListenersRef.current.add(listener);
    listener(progressRef.current);
    return () => progressListenersRef.current.delete(listener);
  }, []);

  const clearMosaicTransitionTimer = useCallback(() => {
    if (mosaicTransitionTimerRef.current) {
      clearTimeout(mosaicTransitionTimerRef.current);
      mosaicTransitionTimerRef.current = null;
    }
  }, []);

  const clearEnterExitTimers = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const applyProgramMosaic = useCallback((item, { animate = true, enterEffect = DEMO_PROGRAM_TRANSITION.NONE } = {}) => {
    clearMosaicTransitionTimer();
    const prev = mosaicRuntimeRef.current;
    const stages = scenario?.stages || [];

    if (item?.kind === DEMO_SEQUENCE_TYPE.MOSAIC && item.preset) {
      const action = item.mosaicAction || item.item?.mosaic_action || DEMO_MOSAIC_ACTION.SHOW_GRID;
      const slot = item.slot || item.item?.slot || null;
      const samePreset = Boolean(prev.active && prev.presetId === item.preset.id);
      const stagger = !samePreset && (
        enterEffect === DEMO_PROGRAM_TRANSITION.STAGGER
        || item.preset.reveal === DEMO_MOSAIC_REVEAL.STAGGER
      );
      const fade = animate && !samePreset && enterEffect === DEMO_PROGRAM_TRANSITION.FADE;
      const transitionMs = animate
        ? (item.item?.enter?.duration_ms || item.preset.transition_ms || 700)
        : 0;

      const base = samePreset
        ? {
          ...prev,
          transitioning: null,
          reveal: DEMO_MOSAIC_REVEAL.ALL,
          staggerMs: 0,
          transitionMs: transitionMs || prev.transitionMs || 700,
        }
        : mosaicRuntimeFromPreset(item.preset, stages, {
          transitioning: fade ? 'enter' : null,
          reveal: stagger ? DEMO_MOSAIC_REVEAL.STAGGER : item.preset.reveal,
          staggerMs: item.preset.stagger_ms,
        });

      if (transitionMs) base.transitionMs = transitionMs;

      if (action === DEMO_MOSAIC_ACTION.EXPAND && slot
        && (item.preset.expandable_slots || []).includes(slot)) {
        setMosaicRuntime({
          ...base,
          mode: animate ? 'expanding' : 'focus',
          focusHidden: false,
          focusSlot: slot,
          transitioning: animate ? 'expand' : null,
        });
        if (animate) {
          mosaicTransitionTimerRef.current = setTimeout(() => {
            setMosaicRuntime((current) => ({
              ...current,
              mode: 'focus',
              transitioning: null,
            }));
          }, base.transitionMs || 700);
        }
        return;
      }

      if (action === DEMO_MOSAIC_ACTION.COLLAPSE) {
        const fromSlot = prev.focusSlot || slot;
        const wasFocused = prev.mode === 'focus' || prev.mode === 'expanding' || !prev.focusHidden;
        if (animate && wasFocused && fromSlot) {
          setMosaicRuntime({
            ...base,
            mode: 'collapsing',
            focusHidden: false,
            focusSlot: fromSlot,
            transitioning: 'collapse',
          });
          mosaicTransitionTimerRef.current = setTimeout(() => {
            setMosaicRuntime((current) => ({
              ...current,
              mode: 'grid',
              focusHidden: true,
              transitioning: null,
            }));
          }, base.transitionMs || 700);
          return;
        }
        setMosaicRuntime({
          ...base,
          mode: 'grid',
          focusHidden: true,
          focusSlot: null,
          transitioning: null,
        });
        return;
      }

      setMosaicRuntime({
        ...base,
        mode: 'grid',
        focusHidden: true,
        focusSlot: action === DEMO_MOSAIC_ACTION.SHOW_GRID ? null : (base.focusSlot || null),
      });
      if (base.transitioning) {
        mosaicTransitionTimerRef.current = setTimeout(() => {
          setMosaicRuntime((current) => ({ ...current, transitioning: null }));
        }, base.transitionMs || 700);
      }
      return;
    }

    const transitioning = animate && prev.active
      ? 'exit'
      : (animate && enterEffect === DEMO_PROGRAM_TRANSITION.FADE ? 'enter' : null);
    if (prev.active && transitioning === 'exit') {
      setMosaicRuntime({ ...prev, transitioning, focusHidden: true, mode: 'grid' });
      mosaicTransitionTimerRef.current = setTimeout(() => {
        setMosaicRuntime({ ...EMPTY_MOSAIC });
      }, prev.transitionMs || 700);
      return;
    }
    setMosaicRuntime(transitioning === 'enter'
      ? { ...EMPTY_MOSAIC, transitioning: 'enter' }
      : { ...EMPTY_MOSAIC });
    if (transitioning === 'enter') {
      mosaicTransitionTimerRef.current = setTimeout(() => {
        setMosaicRuntime({ ...EMPTY_MOSAIC });
      }, 700);
    }
  }, [clearMosaicTransitionTimer, scenario?.stages]);

  /**
   * Переход на блок программы `index` и такт `beat`. Состояние этапа
   * собирается только из этого этапа, а не накопительно по всей программе.
   */
  const goTo = useCallback((nextIndex, {
    beat = 0,
    instant = false,
    autoplay = true,
    programList = null,
    skipEnter = false,
  } = {}) => {
    const list = programList || programItems;
    if (!list.length) return;

    const boundedIndex = Math.max(0, Math.min(list.length - 1, nextIndex));
    const item = list[boundedIndex];
    const beats = item.beats?.length
      ? item.beats
      : [{ steps: [], indices: [], durationMs: item.durationMs || 0, startMs: 0, endMs: item.durationMs || 0 }];
    const boundedBeat = Math.max(0, Math.min(beats.length - 1, beat));

    clearEnterExitTimers();

    setStageIndex(boundedIndex);
    setBeatIndex(boundedBeat);
    setBeatElapsedMs(0);
    setWaitingForPresenter(false);
    setHideFinishedTexts(false);
    pausedElapsedRef.current = 0;
    beatStartedAtRef.current = performance.now();
    lastFrameAtRef.current = performance.now();
    lastContentKeyRef.current = null;

    const itemDuration = (item.enterMs || 0) + (item.durationMs || 0) + (item.exitMs || 0);
    timelineRef.current = {
      beatDurationMs: beats[boundedBeat]?.durationMs || 0,
      beatStartMs: (beats[boundedBeat]?.startMs || 0) + (item.enterMs || 0),
      stageDurationMs: itemDuration,
      stageStartMs: item.startMs || 0,
      totalMs: list.length ? list[list.length - 1].endMs : 0,
    };
    publishProgress(0);

    const enter = item.item?.enter || {};
    const enterEffect = skipEnter || instant
      ? DEMO_PROGRAM_TRANSITION.NONE
      : (enter.effect || DEMO_PROGRAM_TRANSITION.NONE);
    if (!skipEnter && !instant && enterEffect === DEMO_PROGRAM_TRANSITION.BLACKOUT) {
      setBlackout(DEMO_BLACKOUT.BLACK);
      enterTimerRef.current = setTimeout(() => {
        setBlackout(DEMO_BLACKOUT.NONE);
        enterTimerRef.current = null;
      }, enter.duration_ms || 400);
    } else if (skipEnter || instant || enterEffect !== DEMO_PROGRAM_TRANSITION.BLACKOUT) {
      setBlackout(DEMO_BLACKOUT.NONE);
    }

    applyProgramMosaic(item, { animate: !instant, enterEffect });

    applyTokenRef.current += 1;
    const token = applyTokenRef.current;
    const state = composedStateForProgramItem(item, boundedBeat);
    const mosaicFocus = item.kind === DEMO_SEQUENCE_TYPE.MOSAIC
      && (item.mosaicAction === DEMO_MOSAIC_ACTION.EXPAND
        || item.mosaicAction === DEMO_MOSAIC_ACTION.COLLAPSE);
    const prefetchTarget = prefetchTargetFromItem(item, scenario?.stages || []);
    prefetchForStage(prefetchTarget).then(() => {
      if (applyTokenRef.current !== token) return;
      applyState(state, { instant: instant || mosaicFocus });
    });
    setAnimationRunId((prev) => prev + 1);
    if (autoplay) setStatus(DEMO_STATUS.PLAYING);
  }, [
    applyProgramMosaic,
    applyState,
    clearEnterExitTimers,
    prefetchForStage,
    programItems,
    publishProgress,
    scenario?.stages,
  ]);

  const moveToNextItem = useCallback((list = programItems, index = stageIndex) => {
    if (index + 1 < list.length) {
      goTo(index + 1, { programList: list });
      return true;
    }
    if (scenario?.loop && list.length) {
      goTo(0, { programList: list });
      return true;
    }
    return false;
  }, [goTo, programItems, scenario, stageIndex]);

  const runExitThen = useCallback((item, thenGo) => {
    const effect = item?.item?.exit?.effect || DEMO_PROGRAM_TRANSITION.NONE;
    const duration = item?.item?.exit?.duration_ms || 0;
    if (effect === DEMO_PROGRAM_TRANSITION.NONE || duration <= 0) {
      thenGo();
      return;
    }
    stopFrameLoop();
    if (effect === DEMO_PROGRAM_TRANSITION.BLACKOUT) {
      setBlackout(DEMO_BLACKOUT.BLACK);
    } else if (effect === DEMO_PROGRAM_TRANSITION.FADE && mosaicRuntimeRef.current.active) {
      setMosaicRuntime((current) => ({ ...current, transitioning: 'exit' }));
    }
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setBlackout(DEMO_BLACKOUT.NONE);
      thenGo();
    }, duration);
  }, [stopFrameLoop]);

  /** Автоматический переход по таймеру: следующий такт, следующий блок или ожидание докладчика. */
  const advance = useCallback(() => {
    const item = programItems[stageIndex];
    if (!item) return;

    if (beatIndex + 1 < (item.beats?.length || 0)) {
      goTo(stageIndex, { beat: beatIndex + 1, skipEnter: true });
      return;
    }

    const wait = Boolean(item.item?.wait_for_presenter);
    if (wait) {
      stopFrameLoop();
      setHideFinishedTexts(true);
      setWaitingForPresenter(true);
      const finished = item.beats[beatIndex]?.durationMs || item.durationMs || 0;
      setBeatElapsedMs(finished);
      publishProgress(finished);
      pausedElapsedRef.current = finished;
      return;
    }

    runExitThen(item, () => {
      if (moveToNextItem()) return;
      stopFrameLoop();
      setHideFinishedTexts(true);
      setStatus(DEMO_STATUS.PAUSED);
      setWaitingForPresenter(true);
      const finished = item.beats[beatIndex]?.durationMs || item.durationMs || 0;
      setBeatElapsedMs(finished);
      publishProgress(finished);
      pausedElapsedRef.current = finished;
    });
  }, [
    beatIndex,
    goTo,
    moveToNextItem,
    programItems,
    publishProgress,
    runExitThen,
    scenario,
    stageIndex,
    stopFrameLoop,
  ]);

  advanceRef.current = advance;

  useEffect(() => {
    if (status !== DEMO_STATUS.PLAYING || waitingForPresenter || !currentBeat) {
      stopFrameLoop();
      return undefined;
    }

    const duration = currentBeat.durationMs;
    const tick = (now) => {
      const delta = now - (lastFrameAtRef.current || now);
      lastFrameAtRef.current = now;

      // Пока докладчик двигает карту, отсчёт такта стоит: автопереход не должен
      // выдёргивать камеру из-под руки.
      if (interactionHoldsRef.current > 0) {
        beatStartedAtRef.current += delta;
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - beatStartedAtRef.current;
      if (elapsed >= duration) {
        stopFrameLoop();
        advanceRef.current();
        return;
      }
      // Прогресс идёт мимо состояния React, поэтому его можно отдавать каждый кадр.
      publishProgress(elapsed);
      frameRef.current = requestAnimationFrame(tick);
    };

    lastFrameAtRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);
    return stopFrameLoop;
  }, [status, currentBeat, waitingForPresenter, publishProgress, stopFrameLoop]);

  /** Ротация формуляров и справок внутри такта. */
  useEffect(() => {
    if (!isActive) return undefined;
    const api = actionsRef.current;
    const beatContentStep = currentBeat?.steps?.find(isContentStep) || null;
    const contentStep = beatContentStep || composedState.contentStep;
    const slots = contentPlaybackSlots(contentStep);

    if (!contentStep || !slots.length) {
      if (lastContentKeyRef.current) {
        lastContentKeyRef.current = null;
        api.setSelectedTargetId?.(null);
        api.setSelectedCountryIso?.(null);
        api.setDemoContentCardId?.(null);
      }
      return undefined;
    }

    // Карточки листаются только у шага текущего такта; перенесённый из прошлых
    // этапов формуляр просто остаётся открытым на первом пункте.
    const rotates = Boolean(beatContentStep && currentBeat?.durationMs && slots.length > 1);
    const slice = rotates
      ? Math.max(500, Math.floor(currentBeat.durationMs / slots.length))
      : 0;

    let lastIndex = -1;
    const showAt = (elapsedMs) => {
      const index = rotates
        ? Math.min(slots.length - 1, Math.floor(elapsedMs / slice))
        : 0;
      // Кадр без смены карточки не должен доходить до setState в Formular.
      if (index === lastIndex && lastContentKeyRef.current !== null) return;
      lastIndex = index;

      const slot = slots[index];
      const key = `${contentStep.tool}:${slot.entityId}:${slot.cardId || ''}`;
      if (lastContentKeyRef.current === key) return;
      lastContentKeyRef.current = key;
      api.setDemoContentCardId?.(slot.cardId);
      if (contentStep.tool === DEMO_TOOL.FORMULAR) {
        api.setSelectedCountryIso?.(null);
        api.setSelectedTargetId?.(slot.entityId);
      } else {
        api.setSelectedTargetId?.(null);
        api.setSelectedCountryIso?.(slot.entityId);
      }
    };

    // Листание карточек внутри такта слушает тот же прогресс, что и HUD.
    // Подписка вызывает слушателя сразу, поэтому первая карточка встаёт на
    // место без ожидания кадра.
    return subscribeProgress((progress) => showAt(progress.beatElapsedMs));
  }, [composedState, currentBeat, isActive, subscribeProgress]);

  const start = useCallback((nextScenario, { startIndex = 0 } = {}) => {
    const normalized = normalizeScenario(nextScenario || {});
    const nextProgram = buildProgramPlayback(normalized);
    if (!nextProgram.items.length) return false;
    clearMosaicCatalogCache();
    if (!snapshotRef.current) captureSnapshot();
    setScenario(normalized);
    setBlackout(DEMO_BLACKOUT.NONE);
    goTo(startIndex, { programList: nextProgram.items });
    return true;
  }, [captureSnapshot, goTo]);

  const stop = useCallback(({ restore = true } = {}) => {
    stopFrameLoop();
    clearMosaicTransitionTimer();
    clearEnterExitTimers();
    if (interactionReleaseTimerRef.current) {
      clearTimeout(interactionReleaseTimerRef.current);
      interactionReleaseTimerRef.current = null;
    }
    interactionHoldsRef.current = 0;
    setStatus(DEMO_STATUS.IDLE);
    setScenario(null);
    setStageIndex(0);
    setBeatIndex(0);
    setBeatElapsedMs(0);
    setWaitingForPresenter(false);
    setHideFinishedTexts(false);
    setBlackout(DEMO_BLACKOUT.NONE);
    setMosaicRuntime(EMPTY_MOSAIC);
    pausedElapsedRef.current = 0;
    progressRef.current = EMPTY_PROGRESS;
    setAnimationRunId((prev) => prev + 1);
    lastContentKeyRef.current = null;
    if (restore) restoreSnapshot();
    else {
      snapshotRef.current = null;
      const api = actionsRef.current;
      api.setSelectedTargetId?.(null);
      api.setSelectedCountryIso?.(null);
      api.setDetailSituation?.(null);
      api.setDemoContentCardId?.(null);
    }
  }, [clearEnterExitTimers, clearMosaicTransitionTimer, restoreSnapshot, stopFrameLoop]);

  const pause = useCallback(() => {
    // Пока показ ждёт докладчика, таймер и так стоит — паузу ставить не от чего.
    if (status !== DEMO_STATUS.PLAYING || waitingForPresenter) return;
    pausedElapsedRef.current = performance.now() - beatStartedAtRef.current;
    setBeatElapsedMs(pausedElapsedRef.current);
    publishProgress(pausedElapsedRef.current);
    setStatus(DEMO_STATUS.PAUSED);
  }, [publishProgress, status, waitingForPresenter]);

  const resume = useCallback(() => {
    if (status !== DEMO_STATUS.PAUSED) return;
    if (currentBeat && pausedElapsedRef.current >= currentBeat.durationMs) {
      goTo(stageIndex, { beat: beatIndex, skipEnter: true });
      return;
    }
    lastContentKeyRef.current = null;
    beatStartedAtRef.current = performance.now() - pausedElapsedRef.current;
    lastFrameAtRef.current = performance.now();
    setStatus(DEMO_STATUS.PLAYING);
  }, [beatIndex, currentBeat, goTo, stageIndex, status]);

  const toggle = useCallback(() => {
    if (status === DEMO_STATUS.PLAYING) pause();
    else if (status === DEMO_STATUS.PAUSED) resume();
  }, [pause, resume, status]);

  /**
   * «Вперёд» как в PowerPoint: если этап ещё доигрывает такты — первое нажатие
   * досрочно показывает его целиком, следующее переводит на новый блок программы.
   */
  const next = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    const item = programItems[stageIndex];
    if (!item) return;

    const incomplete = !waitingForPresenter && beatIndex + 1 < (item.beats?.length || 0);
    if (incomplete) {
      goTo(stageIndex, { beat: item.beats.length - 1, instant: true, skipEnter: true });
      return;
    }

    runExitThen(item, () => {
      if (moveToNextItem()) return;
      if (scenario?.loop && programItems.length) goTo(0);
    });
  }, [
    beatIndex,
    goTo,
    moveToNextItem,
    programItems,
    runExitThen,
    scenario,
    stageIndex,
    status,
    waitingForPresenter,
  ]);

  const prev = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    if (stageIndex > 0) {
      goTo(stageIndex - 1);
      return;
    }
    if (scenario?.loop && programItems.length) goTo(programItems.length - 1);
  }, [goTo, programItems.length, scenario, stageIndex, status]);

  const goToStage = useCallback((index) => {
    if (status === DEMO_STATUS.IDLE) return;
    goTo(index, { instant: true });
  }, [goTo, status]);

  const restart = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    goTo(0);
  }, [goTo, status]);

  const toggleBlackout = useCallback((mode = DEMO_BLACKOUT.BLACK) => {
    setBlackout((prev) => (prev === mode ? DEMO_BLACKOUT.NONE : mode));
  }, []);

  /**
   * Ручное взаимодействие с картой не прерывает показ — оно лишь придерживает
   * отсчёт текущего такта, пока докладчик работает с картой.
   */
  const holdForInteraction = useCallback(() => {
    if (interactionReleaseTimerRef.current) {
      clearTimeout(interactionReleaseTimerRef.current);
      interactionReleaseTimerRef.current = null;
    }
    interactionHoldsRef.current += 1;
  }, []);

  const releaseInteraction = useCallback(() => {
    if (interactionHoldsRef.current <= 0) return;
    if (interactionReleaseTimerRef.current) clearTimeout(interactionReleaseTimerRef.current);
    interactionReleaseTimerRef.current = setTimeout(() => {
      interactionReleaseTimerRef.current = null;
      interactionHoldsRef.current = 0;
    }, INTERACTION_RESUME_DELAY_MS);
  }, []);

  /** Одиночный предпросмотр шага из конструктора — полноценный показ одного шага. */
  const previewStep = useCallback((step) => {
    if (!step) return false;
    const stage = {
      id: 'preview-stage',
      key: 'preview-stage',
      title: step.title || 'Просмотр шага',
      steps: [step],
    };
    return start({
      title: step.title || 'Просмотр шага',
      loop: false,
      auto_advance: true,
      stages: [stage],
      sequence: [createDefaultSequenceItem({
        type: DEMO_SEQUENCE_TYPE.STAGE,
        stage_id: stage.id,
      })],
    });
  }, [start]);

  /** Предпросмотр этапа целиком — последний такт составленного вида. */
  const previewStage = useCallback((stage) => {
    if (!stage) return false;
    const id = stage.id || stage.key || 'preview-stage';
    return start({
      title: stage.title || 'Просмотр этапа',
      loop: false,
      auto_advance: true,
      stages: [{ ...stage, id, key: id }],
      sequence: [createDefaultSequenceItem({
        type: DEMO_SEQUENCE_TYPE.STAGE,
        stage_id: id,
      })],
    });
  }, [start]);

  /** Предпросмотр пресета мультиэкрана (сетка или разворот слота). */
  const previewMosaic = useCallback((preset, stages = [], { action, slot } = {}) => {
    if (!preset) return false;
    const mosaicAction = action || DEMO_MOSAIC_ACTION.SHOW_GRID;
    return start({
      title: preset.title || 'Просмотр мультиэкрана',
      loop: false,
      auto_advance: true,
      stages,
      mosaic: {
        presets: [preset],
        active_preset_id: preset.id,
      },
      sequence: [createDefaultSequenceItem({
        type: DEMO_SEQUENCE_TYPE.MOSAIC,
        preset_id: preset.id,
        mosaic_action: mosaicAction,
        slot: slot || null,
        duration_ms: mosaicAction === DEMO_MOSAIC_ACTION.SHOW_GRID ? 0 : (preset.transition_ms || 700),
      })],
    });
  }, [start]);

  /** Предпросмотр одного блока программы из черновика конструктора. */
  const previewProgramItem = useCallback((draft, item) => {
    if (!draft || !item) return false;
    return start({
      ...draft,
      title: draft.title || 'Просмотр блока',
      loop: false,
      auto_advance: true,
      sequence: [{ ...item, wait_for_presenter: false }],
    });
  }, [start]);

  useEffect(() => () => {
    stopFrameLoop();
    clearMosaicTransitionTimer();
    clearEnterExitTimers();
    if (interactionReleaseTimerRef.current) clearTimeout(interactionReleaseTimerRef.current);
  }, [clearEnterExitTimers, clearMosaicTransitionTimer, stopFrameLoop]);

  /**
   * Описание активных анимаций для слоёв карты. Берём только шаги текущего
   * такта: содержимое, показанное раньше, не должно проигрывать вход заново.
   */
  const demoAnimation = useMemo(() => {
    if (!isActive || !currentBeat) return EMPTY_ANIMATION;

    const effects = {};
    (currentBeat.steps || []).forEach((step) => {
      const animation = step.animation || {};
      if (!animation.effect || animation.effect === DEMO_EFFECT.NONE) return;
      const entry = {
        effect: animation.effect,
        direction: animation.direction,
        durationMs: animation.duration_ms,
        delayMs: animation.delay_ms,
        easing: animation.easing,
        repeat: animation.repeat,
        continuous: Boolean(animation.continuous),
        stateCycle: animation.state_cycle,
        stepDurationMs: step.duration_ms,
      };

      switch (step.tool) {
        case DEMO_TOOL.EVENTS:
          effects.events = { ...entry, eventIds: step.selection?.event_ids || [] };
          break;
        case DEMO_TOOL.ZONES:
          effects.zones = { ...entry, zoneLeaves: step.selection?.zone_leaves || [] };
          break;
        case DEMO_TOOL.INUNDATION:
          effects.inundation = { ...entry, zoneLeaves: step.selection?.zone_leaves || [] };
          break;
        case DEMO_TOOL.SITUATIONS:
          effects.situations = {
            ...entry,
            situationIds: (step.selection?.situation_ids || []).slice(0, 1),
          };
          break;
        case DEMO_TOOL.OBJECTS:
          effects.objects = { ...entry, targetIds: step.selection?.target_ids || [] };
          break;
        default:
          break;
      }
    });

    return { active: true, runId: animationRunId, effects };
  }, [animationRunId, currentBeat, isActive]);

  /**
   * Тексты на карте. `enterToken` меняется только у шагов текущего такта —
   * удержанные с прошлого такта не переигрывают вход.
   */
  const demoTexts = useMemo(() => {
    if (!isActive) return EMPTY_TEXTS;
    let list = composedState.texts || [];
    if (hideFinishedTexts) {
      const surviving = new Set(
        nextComposedTexts(programItems, stageIndex, beatIndex, scenario).map((item) => item.key),
      );
      list = list.filter((item) => surviving.has(item.key));
    }
    if (!list.length) return EMPTY_TEXTS;

    const beatKeys = new Set();
    (currentBeat?.steps || []).forEach((step) => {
      if (step.tool === DEMO_TOOL.TEXT && step.text?.content) {
        beatKeys.add(step.key);
      }
    });

    return list.map((item) => ({
      ...item,
      enterToken: beatKeys.has(item.key) ? animationRunId : 0,
    }));
  }, [
    animationRunId,
    beatIndex,
    composedState,
    currentBeat,
    hideFinishedTexts,
    isActive,
    programItems,
    scenario,
    stageIndex,
  ]);

  const totalMs = program.totalMs || 0;
  const beatProgress = currentBeat?.durationMs
    ? Math.min(1, beatElapsedMs / currentBeat.durationMs)
    : 0;
  const stageElapsedMs = (currentBeat?.startMs || 0) + beatElapsedMs;
  const stageProgress = currentStage?.durationMs
    ? Math.min(1, stageElapsedMs / currentStage.durationMs)
    : 0;
  const scenarioProgress = totalMs
    ? Math.min(1, ((currentStage?.startMs || 0) + stageElapsedMs) / totalMs)
    : 0;

  // Шкала для publishProgress: считать её в кадре по currentStage/currentBeat
  // нельзя — те живут в замыкании эффекта и устаревают вместе с ним.
  timelineRef.current = {
    beatDurationMs: currentBeat?.durationMs || 0,
    beatStartMs: (currentBeat?.startMs || 0) + (currentItem?.enterMs || 0),
    stageDurationMs: (currentItem?.enterMs || 0) + (currentItem?.durationMs || 0) + (currentItem?.exitMs || 0),
    stageStartMs: currentItem?.startMs || 0,
    totalMs,
  };

  const stageSummaries = useMemo(() => programItems.map((item) => ({
    index: item.index,
    title: item.title,
    kind: item.kind,
    tools: (item.beats || []).flatMap((beat) => (beat.steps || []).map((step) => step.tool)),
    durationMs: item.durationMs,
    beatCount: item.beats?.length || 0,
  })), [programItems]);

  const playback = useMemo(() => ({
    status,
    isActive,
    isPlaying: status === DEMO_STATUS.PLAYING && !waitingForPresenter,
    waitingForPresenter,
    autoAdvance: Boolean(scenario?.auto_advance),
    blackout,
    scenarioTitle: scenario?.title || '',
    kind: currentItem?.kind || DEMO_SEQUENCE_TYPE.STAGE,
    stageIndex,
    stageCount: programItems.length,
    beatIndex,
    beatCount: currentItem?.beats?.length || 0,
    stageProgress,
    beatProgress,
    scenarioProgress,
    stageTitle: currentItem?.title || '',
    stepTitle: currentBeat?.steps?.[0]?.title || currentItem?.title || '',
    stepTools: currentBeat?.steps?.map((step) => step.tool) || [],
    stages: stageSummaries,
    loop: Boolean(scenario?.loop),
    // Живой прогресс HUD берёт отсюда: значения выше — только срез на момент
    // смены такта, паузы или остановки.
    subscribeProgress,
  }), [
    beatIndex,
    beatProgress,
    blackout,
    currentBeat,
    currentItem,
    isActive,
    programItems.length,
    scenario,
    scenarioProgress,
    stageIndex,
    stageProgress,
    stageSummaries,
    status,
    subscribeProgress,
    waitingForPresenter,
  ]);

  return {
    playback,
    demoAnimation,
    demoTexts,
    mosaicRuntime,
    isActive,
    start,
    stop,
    pause,
    resume,
    toggle,
    next,
    prev,
    goToStage,
    restart,
    toggleBlackout,
    holdForInteraction,
    releaseInteraction,
    previewStep,
    previewStage,
    previewMosaic,
    previewProgramItem,
    scenario,
  };
}
