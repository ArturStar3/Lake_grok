import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  DEMO_CAMERA_MODE,
  DEMO_EFFECT,
  DEMO_TOOL,
  buildScenarioStages,
  composeStateAtStage,
} from '../../utils/demoScenario';
import { getEventCenter } from '../../utils/eventGeometry';
import { getSituationBounds } from '../../utils/situationUtils';

const PROGRESS_TICK_MS = 100;
/** Пауза после ручного взаимодействия с картой, прежде чем таймер пойдёт дальше. */
const INTERACTION_RESUME_DELAY_MS = 1500;

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

/** Тексты, которые останутся после текущего такта — если ключа нет, пора играть выход. */
function nextComposedTexts(stages, stageIndex, beatIndex, scenario) {
  const stage = stages[stageIndex];
  if (!stage) return [];
  if (beatIndex + 1 < stage.beats.length) {
    return composeStateAtStage(stages, stageIndex, beatIndex + 1).texts;
  }
  if (stageIndex + 1 < stages.length) {
    return composeStateAtStage(stages, stageIndex + 1, 0).texts;
  }
  if (scenario?.loop && stages.length) {
    return composeStateAtStage(stages, 0, 0).texts;
  }
  return [];
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
 * Сценарий раскладывается на **этапы** (точки ручного переключения докладчиком)
 * и **такты** внутри этапа (элементы, которые сменяют друг друга по таймеру или
 * идут параллельно). Плеер ничего не рисует сам: он применяет свёрнутое
 * состояние сценария через те же сеттеры, которыми пользуется оператор, и отдаёт
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

  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const dataRef = useRef(data);
  dataRef.current = data;

  const beatStartedAtRef = useRef(0);
  const pausedElapsedRef = useRef(0);
  const frameRef = useRef(null);
  const lastFrameAtRef = useRef(0);
  const lastProgressPushRef = useRef(0);
  const snapshotRef = useRef(null);
  const advanceRef = useRef(() => {});
  const lastContentKeyRef = useRef(null);
  const interactionHoldsRef = useRef(0);
  const interactionReleaseTimerRef = useRef(null);
  const applyTokenRef = useRef(0);

  const stages = useMemo(() => buildScenarioStages(scenario?.steps || []), [scenario]);
  const currentStage = stages[stageIndex] || null;
  const currentBeat = currentStage?.beats?.[beatIndex] || null;
  const isActive = status !== DEMO_STATUS.IDLE && Boolean(currentStage);

  /** Состояние карты, накопленное сценарием к концу текущего такта. */
  const composedState = useMemo(
    () => composeStateAtStage(stages, stageIndex, beatIndex),
    [stages, stageIndex, beatIndex],
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
   * Переход на такт `beat` этапа `stage`. Состояние всегда пересобирается с
   * начала сценария, поэтому направление перехода на результат не влияет.
   */
  const goTo = useCallback((nextStageIndex, {
    beat = 0,
    instant = false,
    autoplay = true,
    stageList = null,
  } = {}) => {
    const list = stageList || stages;
    if (!list.length) return;

    const boundedStage = Math.max(0, Math.min(list.length - 1, nextStageIndex));
    const stage = list[boundedStage];
    const boundedBeat = Math.max(0, Math.min(stage.beats.length - 1, beat));

    setStageIndex(boundedStage);
    setBeatIndex(boundedBeat);
    setBeatElapsedMs(0);
    setWaitingForPresenter(false);
    setHideFinishedTexts(false);
    pausedElapsedRef.current = 0;
    beatStartedAtRef.current = performance.now();
    lastFrameAtRef.current = performance.now();
    lastProgressPushRef.current = 0;
    lastContentKeyRef.current = null;

    // Догрузка данных асинхронна: если докладчик успел уйти дальше, применять
    // уже неактуальное состояние нельзя.
    applyTokenRef.current += 1;
    const token = applyTokenRef.current;
    const state = composeStateAtStage(list, boundedStage, boundedBeat);
    prefetchForStage(stage).then(() => {
      if (applyTokenRef.current !== token) return;
      applyState(state, { instant });
    });
    setAnimationRunId((prev) => prev + 1);
    if (autoplay) setStatus(DEMO_STATUS.PLAYING);
  }, [applyState, prefetchForStage, stages]);

  /** Автоматический переход по таймеру: следующий такт, следующий этап или ожидание докладчика. */
  const advance = useCallback(() => {
    const stage = stages[stageIndex];
    if (!stage) return;

    if (beatIndex + 1 < stage.beats.length) {
      goTo(stageIndex, { beat: beatIndex + 1 });
      return;
    }

    if (!scenario?.auto_advance) {
      stopFrameLoop();
      setHideFinishedTexts(true);
      setWaitingForPresenter(true);
      setBeatElapsedMs(stage.beats[beatIndex]?.durationMs || 0);
      pausedElapsedRef.current = stage.beats[beatIndex]?.durationMs || 0;
      return;
    }

    if (stageIndex + 1 < stages.length) {
      goTo(stageIndex + 1);
      return;
    }
    if (scenario?.loop && stages.length) {
      goTo(0);
      return;
    }

    stopFrameLoop();
    setHideFinishedTexts(true);
    setStatus(DEMO_STATUS.PAUSED);
    setWaitingForPresenter(true);
    setBeatElapsedMs(stage.beats[beatIndex]?.durationMs || 0);
    pausedElapsedRef.current = stage.beats[beatIndex]?.durationMs || 0;
  }, [beatIndex, goTo, scenario, stageIndex, stages, stopFrameLoop]);

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
      // Прогресс в state обновляем реже кадра — иначе Formular перерисовывается 60 раз в секунду.
      if (now - lastProgressPushRef.current >= PROGRESS_TICK_MS) {
        lastProgressPushRef.current = now;
        setBeatElapsedMs(elapsed);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    lastFrameAtRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);
    return stopFrameLoop;
  }, [status, currentBeat, waitingForPresenter, stopFrameLoop]);

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
    let index = 0;
    if (beatContentStep && currentBeat?.durationMs) {
      const slice = Math.max(500, Math.floor(currentBeat.durationMs / slots.length));
      index = Math.min(slots.length - 1, Math.floor(beatElapsedMs / slice));
    }

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
  }, [beatElapsedMs, composedState, currentBeat, isActive]);

  const start = useCallback((nextScenario, { startIndex = 0 } = {}) => {
    const steps = nextScenario?.steps || [];
    if (!steps.length) return false;
    if (!snapshotRef.current) captureSnapshot();
    setScenario(nextScenario);
    setBlackout(DEMO_BLACKOUT.NONE);
    goTo(startIndex, { stageList: buildScenarioStages(steps) });
    return true;
  }, [captureSnapshot, goTo]);

  const stop = useCallback(({ restore = true } = {}) => {
    stopFrameLoop();
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
    // Пока показ ждёт докладчика, таймер и так стоит — паузу ставить не от чего.
    if (status !== DEMO_STATUS.PLAYING || waitingForPresenter) return;
    pausedElapsedRef.current = performance.now() - beatStartedAtRef.current;
    setBeatElapsedMs(pausedElapsedRef.current);
    setStatus(DEMO_STATUS.PAUSED);
  }, [status, waitingForPresenter]);

  const resume = useCallback(() => {
    if (status !== DEMO_STATUS.PAUSED) return;
    if (currentBeat && pausedElapsedRef.current >= currentBeat.durationMs) {
      goTo(stageIndex, { beat: beatIndex });
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
   * досрочно показывает его целиком, следующее переводит на новый этап.
   */
  const next = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    const stage = stages[stageIndex];
    if (!stage) return;

    const stageIncomplete = !waitingForPresenter && beatIndex + 1 < stage.beats.length;
    if (stageIncomplete) {
      goTo(stageIndex, { beat: stage.beats.length - 1, instant: true });
      return;
    }

    if (stageIndex + 1 < stages.length) {
      goTo(stageIndex + 1);
      return;
    }
    if (scenario?.loop) goTo(0);
  }, [beatIndex, goTo, scenario, stageIndex, stages, status, waitingForPresenter]);

  const prev = useCallback(() => {
    if (status === DEMO_STATUS.IDLE) return;
    if (stageIndex > 0) {
      goTo(stageIndex - 1);
      return;
    }
    if (scenario?.loop && stages.length) goTo(stages.length - 1);
  }, [goTo, scenario, stageIndex, stages.length, status]);

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
    return start({
      title: step.title || 'Просмотр шага',
      loop: false,
      auto_advance: true,
      steps: [step],
    });
  }, [start]);

  useEffect(() => () => {
    stopFrameLoop();
    if (interactionReleaseTimerRef.current) clearTimeout(interactionReleaseTimerRef.current);
  }, [stopFrameLoop]);

  /**
   * Описание активных анимаций для слоёв карты. Берём только шаги текущего
   * такта: содержимое, показанное раньше, не должно проигрывать вход заново.
   */
  const demoAnimation = useMemo(() => {
    if (!isActive || !currentBeat) return EMPTY_ANIMATION;

    const effects = {};
    currentBeat.steps.forEach((step) => {
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
        nextComposedTexts(stages, stageIndex, beatIndex, scenario).map((item) => item.key),
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
    scenario,
    stageIndex,
    stages,
  ]);

  const totalMs = stages.length ? stages[stages.length - 1].endMs : 0;
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

  const stageSummaries = useMemo(() => stages.map((stage) => ({
    index: stage.index,
    title: stage.title,
    tools: stage.steps.map((step) => step.tool),
    durationMs: stage.durationMs,
    beatCount: stage.beats.length,
  })), [stages]);

  const playback = useMemo(() => ({
    status,
    isActive,
    isPlaying: status === DEMO_STATUS.PLAYING && !waitingForPresenter,
    waitingForPresenter,
    autoAdvance: Boolean(scenario?.auto_advance),
    blackout,
    scenarioTitle: scenario?.title || '',
    stageIndex,
    stageCount: stages.length,
    beatIndex,
    beatCount: currentStage?.beats?.length || 0,
    stageProgress,
    beatProgress,
    scenarioProgress,
    stageTitle: currentStage?.title || '',
    stepTitle: currentBeat?.steps?.[0]?.title || currentStage?.title || '',
    stepTools: currentBeat?.steps?.map((step) => step.tool) || [],
    stages: stageSummaries,
    loop: Boolean(scenario?.loop),
  }), [
    beatIndex,
    beatProgress,
    blackout,
    currentBeat,
    currentStage,
    isActive,
    scenario,
    scenarioProgress,
    stageIndex,
    stageProgress,
    stageSummaries,
    stages.length,
    status,
    waitingForPresenter,
  ]);

  return {
    playback,
    demoAnimation,
    demoTexts,
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
  };
}
