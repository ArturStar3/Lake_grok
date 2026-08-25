import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  DEMO_CAMERA_MODE,
  DEMO_EFFECT,
  DEMO_TOOL,
  buildScenarioCues,
} from '../../utils/demoScenario';
import { getEventCenter } from '../../utils/eventGeometry';
import { getSituationBounds } from '../../utils/situationUtils';

const PROGRESS_TICK_MS = 100;

export const DEMO_STATUS = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
};

const EMPTY_ANIMATION = {
  active: false,
  runId: 0,
  effects: {},
};

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

function resolveContentStep(cue) {
  if (!cue?.steps?.length) return null;
  return [...cue.steps]
    .reverse()
    .find((step) => step.tool === DEMO_TOOL.FORMULAR || step.tool === DEMO_TOOL.COUNTRY)
    || null;
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
 * Не рисует ничего сам: применяет шаги сценария через те же сеттеры,
 * которыми пользуется оператор вручную, и отдаёт наружу описание активных
 * анимаций (`demoAnimation`) для слоёв карты.
 */
export function useDemoPlayer({ actions, data }) {
  const [scenario, setScenario] = useState(null);
  const [status, setStatus] = useState(DEMO_STATUS.IDLE);
  const [cueIndex, setCueIndex] = useState(0);
  const [cueElapsedMs, setCueElapsedMs] = useState(0);
  const [animationRunId, setAnimationRunId] = useState(0);

  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const dataRef = useRef(data);
  dataRef.current = data;

  const cueStartedAtRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const frameRef = useRef(null);
  const lastProgressPushRef = useRef(0);
  const snapshotRef = useRef(null);
  const advanceRef = useRef(() => {});
  const lastContentKeyRef = useRef(null);

  const cues = useMemo(() => buildScenarioCues(scenario?.steps || []), [scenario]);
  const currentCue = cues[cueIndex] || null;
  const isActive = status !== DEMO_STATUS.IDLE && Boolean(currentCue);

  const clearMapContent = useCallback(() => {
    const api = actionsRef.current;
    api.setSelectedObj?.([]);
    api.setSelectedEvents?.([]);
    api.setSelectedSituations?.([]);
    api.setTimelineRevisionId?.(null);
    api.setFocusedSituationId?.(null);
    api.setDetailSituation?.(null);
    api.setDemoContentCardId?.(null);
    api.resetZoneFilters?.(false);
  }, []);

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

  const applyStep = useCallback((step) => {
    const api = actionsRef.current;
    const current = dataRef.current;
    const selection = step.selection || {};

    switch (step.tool) {
      case DEMO_TOOL.OBJECTS: {
        const ids = resolveIdsAgainst(current.objects, selection.target_ids);
        if (ids.length) api.setSelectedObj?.((prev) => Array.from(new Set([...prev, ...ids])));
        break;
      }
      case DEMO_TOOL.EVENTS: {
        const ids = resolveIdsAgainst(current.events, selection.event_ids);
        if (ids.length) api.setSelectedEvents?.((prev) => Array.from(new Set([...prev, ...ids])));
        break;
      }
      case DEMO_TOOL.SITUATIONS: {
        const ids = resolveIdsAgainst(current.situations, selection.situation_ids).slice(0, 1);
        if (ids.length) {
          api.setSelectedSituations?.(ids);
          api.setFocusedSituationId?.(ids[0]);
          const situation = (current.situations || []).find(
            (item) => String(item.id) === String(ids[0]),
          );
          api.setDetailSituation?.(situation || null);
        }
        break;
      }
      case DEMO_TOOL.ZONES:
      case DEMO_TOOL.INUNDATION: {
        const items = (selection.zone_leaves || []).map((leaf) => ({
          country: leaf.country,
          actionTypeId: leaf.action_type_id,
          leaf: leaf.leaf,
        }));
        if (items.length) api.setZoneLeavesBatch?.(items, true);
        break;
      }
      case DEMO_TOOL.LAYERS: {
        if (selection.overlay_layer_ids?.length) {
          api.setOverlayLayers?.(selection.overlay_layer_ids);
        }
        break;
      }
      default:
        break;
    }
  }, []);

  const applyCamera = useCallback((step) => {
    const api = actionsRef.current;
    const camera = step.camera || {};
    if (camera.mode === DEMO_CAMERA_MODE.FLY_TO) {
      if (camera.lat == null || camera.lng == null) return;
      api.flyTo?.(camera.lat, camera.lng, camera.zoom, {
        duration: camera.duration_ms / 1000,
        easeLinearity: camera.ease_linearity,
      });
      return;
    }
    if (camera.mode === DEMO_CAMERA_MODE.FIT_SELECTION) {
      const bounds = computeStepBounds(step);
      if (!bounds) return;
      api.flyToBounds?.(bounds, {
        padding: [camera.padding, camera.padding],
        maxZoom: camera.zoom,
        duration: camera.duration_ms / 1000,
        easeLinearity: camera.ease_linearity,
      });
    }
  }, [computeStepBounds]);

  /** Подгружает данные, нужные шагам сцены (вкладки при этом не переключаются). */
  const prefetchForCue = useCallback(async (cue) => {
    const api = actionsRef.current;
    const current = dataRef.current;
    const tasks = [];

    const needsEvents = cue.steps.some((step) => step.tool === DEMO_TOOL.EVENTS);
    if (needsEvents && !(current.events || []).length) {
      tasks.push(api.fetchEvents?.());
    }

    const situationSteps = cue.steps.filter((step) => step.tool === DEMO_TOOL.SITUATIONS);
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

  const applyCue = useCallback(async (cue) => {
    if (!cue) return;
    const hasContent = cue.steps.some(
      (step) => step.tool === DEMO_TOOL.FORMULAR || step.tool === DEMO_TOOL.COUNTRY,
    );
    if (!hasContent) {
      const api = actionsRef.current;
      api.setSelectedTargetId?.(null);
      api.setSelectedCountryIso?.(null);
      api.setDemoContentCardId?.(null);
    }
    await prefetchForCue(cue);
    if (!cue.steps.some((step) => step.hold_previous)) {
      clearMapContent();
    }
    cue.steps.forEach(applyStep);
    const cameraStep = [...cue.steps]
      .reverse()
      .find((step) => step.camera?.mode && step.camera.mode !== DEMO_CAMERA_MODE.NONE);
    if (cameraStep) applyCamera(cameraStep);
    setAnimationRunId((prev) => prev + 1);
  }, [applyCamera, applyStep, clearMapContent, prefetchForCue]);

  const stopFrameLoop = useCallback(() => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const goToCue = useCallback((index, { autoplay = true } = {}) => {
    const list = cues;
    if (!list.length) return;
    const bounded = Math.max(0, Math.min(list.length - 1, index));
    setCueIndex(bounded);
    setCueElapsedMs(0);
    pausedElapsedRef.current = 0;
    cueStartedAtRef.current = performance.now();
    lastProgressPushRef.current = 0;
    lastContentKeyRef.current = null;
    applyCue(list[bounded]);
    if (autoplay) setStatus(DEMO_STATUS.PLAYING);
  }, [applyCue, cues]);

  const advance = useCallback(() => {
    const list = cues;
    const nextIndex = cueIndex + 1;
    if (nextIndex < list.length) {
      goToCue(nextIndex);
      return;
    }
    if (scenario?.loop && list.length) {
      goToCue(0);
      return;
    }
    setStatus(DEMO_STATUS.PAUSED);
    setCueElapsedMs(currentCue?.durationMs || 0);
    pausedElapsedRef.current = currentCue?.durationMs || 0;
  }, [cueIndex, cues, currentCue, goToCue, scenario]);

  advanceRef.current = advance;

  useEffect(() => {
    if (status !== DEMO_STATUS.PLAYING || !currentCue) {
      stopFrameLoop();
      return undefined;
    }

    const duration = currentCue.durationMs;
    const tick = (now) => {
      const elapsed = now - cueStartedAtRef.current;
      if (elapsed >= duration) {
        stopFrameLoop();
        advanceRef.current();
        return;
      }
      // Прогресс в state обновляем реже кадра — иначе Formular перерисовывается 60 раз в секунду.
      if (now - lastProgressPushRef.current >= PROGRESS_TICK_MS) {
        lastProgressPushRef.current = now;
        setCueElapsedMs(elapsed);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return stopFrameLoop;
  }, [status, currentCue, stopFrameLoop]);

  useEffect(() => {
    if (!isActive || !currentCue) return undefined;
    const api = actionsRef.current;
    const contentStep = resolveContentStep(currentCue);
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
    const slice = Math.max(500, Math.floor(currentCue.durationMs / slots.length));
    const index = Math.min(slots.length - 1, Math.floor(cueElapsedMs / slice));
    const slot = slots[index];
    const key = `${contentStep.tool}:${slot.entityId}:${slot.cardId || ''}`;
    if (lastContentKeyRef.current === key) return undefined;
    lastContentKeyRef.current = key;
    api.setDemoContentCardId?.(slot.cardId);
    if (contentStep.tool === DEMO_TOOL.FORMULAR) {
      api.setSelectedCountryIso?.(null);
      api.setSelectedTargetId?.(slot.entityId);
    } else {
      api.setSelectedTargetId?.(null);
      api.setSelectedCountryIso?.(slot.entityId);
    }
    return undefined;
  }, [cueElapsedMs, currentCue, isActive, status]);

  const start = useCallback((nextScenario, { startIndex = 0 } = {}) => {
    const steps = nextScenario?.steps || [];
    if (!steps.length) return false;
    if (!snapshotRef.current) captureSnapshot();
    setScenario(nextScenario);
    const list = buildScenarioCues(steps);
    const bounded = Math.max(0, Math.min(list.length - 1, startIndex));
    setCueIndex(bounded);
    setCueElapsedMs(0);
    pausedElapsedRef.current = 0;
    cueStartedAtRef.current = performance.now();
    lastProgressPushRef.current = 0;
    lastContentKeyRef.current = null;
    setStatus(DEMO_STATUS.PLAYING);
    applyCue(list[bounded]);
    return true;
  }, [applyCue, captureSnapshot]);

  const stop = useCallback(({ restore = true } = {}) => {
    stopFrameLoop();
    setStatus(DEMO_STATUS.IDLE);
    setScenario(null);
    setCueIndex(0);
    setCueElapsedMs(0);
    pausedElapsedRef.current = 0;
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
  }, [restoreSnapshot, stopFrameLoop]);

  const pause = useCallback(() => {
    if (status !== DEMO_STATUS.PLAYING) return;
    pausedElapsedRef.current = performance.now() - cueStartedAtRef.current;
    setCueElapsedMs(pausedElapsedRef.current);
    setStatus(DEMO_STATUS.PAUSED);
  }, [status]);

  const resume = useCallback(() => {
    if (status !== DEMO_STATUS.PAUSED) return;
    if (currentCue && pausedElapsedRef.current >= currentCue.durationMs) {
      goToCue(cueIndex);
      return;
    }
    lastContentKeyRef.current = null;
    cueStartedAtRef.current = performance.now() - pausedElapsedRef.current;
    setStatus(DEMO_STATUS.PLAYING);
  }, [cueIndex, currentCue, goToCue, status]);

  const toggle = useCallback(() => {
    if (status === DEMO_STATUS.PLAYING) pause();
    else if (status === DEMO_STATUS.PAUSED) resume();
  }, [pause, resume, status]);

  const next = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    if (cueIndex + 1 < cues.length) goToCue(cueIndex + 1);
    else if (scenario?.loop) goToCue(0);
  }, [cueIndex, cues.length, goToCue, scenario, status]);

  const prev = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    if (cueIndex > 0) goToCue(cueIndex - 1);
    else if (scenario?.loop && cues.length) goToCue(cues.length - 1);
  }, [cueIndex, cues.length, goToCue, scenario, status]);

  /** Одиночный предпросмотр шага из конструктора — полноценный показ одного шага. */
  const previewStep = useCallback((step) => {
    if (!step) return false;
    return start({
      title: step.title || 'Просмотр шага',
      loop: false,
      steps: [step],
    });
  }, [start]);

  useEffect(() => () => stopFrameLoop(), [stopFrameLoop]);

  /**
   * Описание активных анимаций для слоёв карты.
   * Ключи — идентификаторы сущностей, чтобы слой мог решить, анимировать ли себя.
   */
  const demoAnimation = useMemo(() => {
    if (!isActive || !currentCue) return EMPTY_ANIMATION;

    const effects = {};
    currentCue.steps.forEach((step) => {
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
  }, [animationRunId, currentCue, isActive]);

  const totalMs = cues.length ? cues[cues.length - 1].endMs : 0;
  const cueProgress = currentCue?.durationMs
    ? Math.min(1, cueElapsedMs / currentCue.durationMs)
    : 0;
  const scenarioProgress = totalMs
    ? Math.min(1, ((currentCue?.startMs || 0) + cueElapsedMs) / totalMs)
    : 0;

  const playback = useMemo(() => ({
    status,
    isActive,
    isPlaying: status === DEMO_STATUS.PLAYING,
    scenarioTitle: scenario?.title || '',
    cueIndex,
    cueCount: cues.length,
    cueProgress,
    scenarioProgress,
    stepTitle: currentCue?.steps?.[0]?.title || '',
    stepTools: currentCue?.steps?.map((step) => step.tool) || [],
    loop: Boolean(scenario?.loop),
  }), [
    cueIndex,
    cueProgress,
    cues.length,
    currentCue,
    isActive,
    scenario,
    scenarioProgress,
    status,
  ]);

  return {
    playback,
    demoAnimation,
    isActive,
    start,
    stop,
    pause,
    resume,
    toggle,
    next,
    prev,
    goToCue,
    previewStep,
  };
}
