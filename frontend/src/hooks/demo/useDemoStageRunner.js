import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  DEMO_CAMERA_MODE,
  DEMO_EFFECT,
  DEMO_TOOL,
  buildStageBeats,
  composeStateForStage,
  zoneLeavesToFilters,
} from '../../utils/demoScenario';
import { getEventCenter } from '../../utils/eventGeometry';
import { getSituationBounds } from '../../utils/situationUtils';

const EMPTY_ANIMATION = {
  active: false,
  runId: 0,
  effects: {},
};

const EMPTY_TEXTS = [];

function boundsFromLatLngs(latLngs) {
  const valid = latLngs.filter(
    (point) => point && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  );
  if (!valid.length) return null;
  return L.latLngBounds(valid);
}

function resolveIds(collection, wantedIds, getId = (item) => item.id) {
  if (!wantedIds?.length || !collection?.length) return [];
  const wanted = new Set(wantedIds.map(String));
  return collection
    .filter((item) => wanted.has(String(getId(item))))
    .map((item) => getId(item));
}

function computeStepBounds(step, data) {
  const selection = step?.selection || {};

  if (
    (step.tool === DEMO_TOOL.OBJECTS || step.tool === DEMO_TOOL.FORMULAR)
    && selection.target_ids?.length
  ) {
    const wanted = new Set(selection.target_ids.map(String));
    return boundsFromLatLngs(
      (data.objects || [])
        .filter((obj) => wanted.has(String(obj.id)))
        .map((obj) => [obj.lat, obj.lng]),
    );
  }

  if (step.tool === DEMO_TOOL.EVENTS && selection.event_ids?.length) {
    const wanted = new Set(selection.event_ids.map(String));
    return boundsFromLatLngs(
      (data.events || [])
        .filter((item) => wanted.has(String(item.id)))
        .map((item) => getEventCenter(item))
        .filter(Boolean),
    );
  }

  if (step.tool === DEMO_TOOL.SITUATIONS && selection.situation_ids?.length) {
    const wanted = new Set(selection.situation_ids.map(String));
    let merged = null;
    (data.situations || [])
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
      (data.objects || [])
        .filter((obj) => countries.has(obj.country?.title))
        .map((obj) => [obj.lat, obj.lng]),
    );
  }

  if (step.tool === DEMO_TOOL.COUNTRY && selection.country_isos?.length) {
    const isos = new Set(selection.country_isos.map((iso) => String(iso).toUpperCase()));
    const titles = new Set(
      (data.countriesList || [])
        .filter((country) => isos.has(String(country.iso_code || '').toUpperCase()))
        .map((country) => country.title)
        .filter(Boolean),
    );
    return boundsFromLatLngs(
      (data.objects || [])
        .filter((obj) => {
          const iso = String(obj.country?.iso_code || '').toUpperCase();
          const title = obj.country?.title;
          return isos.has(iso) || (title && titles.has(title));
        })
        .map((obj) => [obj.lat, obj.lng]),
    );
  }

  return null;
}

function applyCameraToMap(map, step, data, { instant = false } = {}) {
  if (!map || !step) return;
  const camera = step.camera || {};
  const animation = instant
    ? { animate: false, duration: 0 }
    : {
      duration: Math.max(0.2, (camera.duration_ms || 800) / 1000),
      easeLinearity: camera.ease_linearity ?? 0.25,
    };

  if (camera.mode === DEMO_CAMERA_MODE.FLY_TO) {
    if (camera.lat == null || camera.lng == null) return;
    map.flyTo([camera.lat, camera.lng], camera.zoom || map.getZoom(), animation);
    return;
  }
  if (camera.mode === DEMO_CAMERA_MODE.FIT_SELECTION) {
    const bounds = computeStepBounds(step, data);
    if (!bounds) return;
    map.flyToBounds(bounds, {
      padding: [camera.padding || 24, camera.padding || 24],
      maxZoom: camera.zoom || 14,
      ...animation,
    });
  }
}

function buildAnimation(beat, runId) {
  if (!beat) return EMPTY_ANIMATION;
  const effects = {};
  (beat.steps || []).forEach((step) => {
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
  return { active: true, runId, effects };
}

/**
 * Локальный проигрыватель одного этапа для плитки мультиэкрана.
 * Не трогает глобальные фильтры Formular.
 */
export function useDemoStageRunner({
  stage = null,
  loop = false,
  enabled = true,
  paused = false,
  startDelayMs = 0,
  objects = [],
  events = [],
  situations = [],
  countriesList = [],
} = {}) {
  const mapRef = useRef(null);
  const beatStartedAtRef = useRef(0);
  const cameraTimersRef = useRef([]);
  const pausedAtRef = useRef(null);
  const dataRef = useRef({ objects, events, situations, countriesList });
  dataRef.current = { objects, events, situations, countriesList };

  const playback = useMemo(() => buildStageBeats(stage?.steps || []), [stage]);
  const beats = playback.beats || [];
  const [beatIndex, setBeatIndex] = useState(0);
  const [animationRunId, setAnimationRunId] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [clockReady, setClockReady] = useState(false);

  const clearCameraTimers = useCallback(() => {
    cameraTimersRef.current.forEach((id) => clearTimeout(id));
    cameraTimersRef.current = [];
  }, []);

  const requestCamera = useCallback((step, instant) => {
    clearCameraTimers();
    if (!step) return;
    const apply = () => {
      const map = mapRef.current;
      if (!map) return false;
      try {
        map.invalidateSize();
      } catch {
        // карта ещё без размеров — повтор ниже
      }
      applyCameraToMap(map, step, dataRef.current, { instant });
      return true;
    };
    if (apply()) return;
    [60, 200, 500].forEach((ms) => {
      cameraTimersRef.current.push(setTimeout(apply, ms));
    });
  }, [clearCameraTimers]);

  const boundedBeat = Math.max(0, Math.min(beats.length - 1, beatIndex));
  const currentBeat = beats[boundedBeat] || null;
  const composed = useMemo(
    () => (stage && clockReady ? composeStateForStage(stage, boundedBeat) : null),
    [clockReady, stage, boundedBeat],
  );

  const goToBeat = useCallback((nextIndex, { instant = false } = {}) => {
    if (!beats.length) return;
    const bounded = Math.max(0, Math.min(beats.length - 1, nextIndex));
    setBeatIndex(bounded);
    setFrozen(false);
    beatStartedAtRef.current = performance.now();
    pausedAtRef.current = null;
    setAnimationRunId((prev) => prev + 1);
    const state = composeStateForStage(stage, bounded);
    requestCamera(state?.cameraStep, instant);
  }, [beats.length, requestCamera, stage]);

  useEffect(() => {
    if (!enabled || !stage || !beats.length) {
      setClockReady(false);
      return undefined;
    }
    let startTimer = null;
    const begin = () => {
      goToBeat(0, { instant: true });
      setClockReady(true);
    };
    if (startDelayMs > 0) {
      startTimer = setTimeout(begin, startDelayMs);
    } else {
      begin();
    }
    return () => {
      if (startTimer) clearTimeout(startTimer);
    };
  }, [beats.length, enabled, goToBeat, stage, startDelayMs]);

  useEffect(() => {
    if (paused) {
      if (pausedAtRef.current == null) pausedAtRef.current = performance.now();
      return undefined;
    }
    if (pausedAtRef.current != null) {
      beatStartedAtRef.current += performance.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    return undefined;
  }, [paused]);

  useEffect(() => {
    if (!enabled || !stage || frozen || !currentBeat || !clockReady || paused) {
      return undefined;
    }

    const duration = Math.max(16, currentBeat.durationMs || 0);
    const remaining = Math.max(0, duration - (performance.now() - beatStartedAtRef.current));
    const timer = setTimeout(() => {
      if (boundedBeat + 1 < beats.length) {
        goToBeat(boundedBeat + 1);
        return;
      }
      if (loop) {
        goToBeat(0);
        return;
      }
      setFrozen(true);
    }, remaining);
    return () => clearTimeout(timer);
  }, [boundedBeat, beats.length, clockReady, currentBeat, enabled, frozen, goToBeat, loop, paused, stage]);

  useEffect(() => () => {
    clearCameraTimers();
  }, [clearCameraTimers]);

  const selectedObj = useMemo(
    () => resolveIds(objects, composed?.target_ids),
    [composed?.target_ids, objects],
  );
  const selectedEventIds = useMemo(
    () => resolveIds(events, composed?.event_ids),
    [composed?.event_ids, events],
  );
  const selectedSituationIds = useMemo(
    () => resolveIds(situations, composed?.situation_ids).slice(0, 1),
    [composed?.situation_ids, situations],
  );
  const actionZoneFilters = useMemo(
    () => zoneLeavesToFilters(composed?.zone_leaves),
    [composed?.zone_leaves],
  );
  const overlayKey = Array.isArray(composed?.overlay_layer_ids)
    ? composed.overlay_layer_ids.map(String).join(',')
    : '';
  const overlayLayerIds = useMemo(
    () => (overlayKey ? overlayKey.split(',') : []),
    [overlayKey],
  );

  const demoAnimation = useMemo(
    () => (enabled && clockReady && currentBeat
      ? buildAnimation(currentBeat, animationRunId)
      : EMPTY_ANIMATION),
    [animationRunId, clockReady, currentBeat, enabled],
  );

  const demoTexts = useMemo(() => {
    if (!enabled || !clockReady || !composed?.texts?.length) return EMPTY_TEXTS;
    const beatKeys = new Set();
    (currentBeat?.steps || []).forEach((step) => {
      if (step.tool === DEMO_TOOL.TEXT && step.text?.content) beatKeys.add(step.key);
    });
    return composed.texts.map((item) => ({
      ...item,
      enterToken: beatKeys.has(item.key) ? animationRunId : 0,
    }));
  }, [animationRunId, clockReady, composed, currentBeat, enabled]);

  const tilePlayback = useMemo(() => ({
    isActive: Boolean(enabled && stage),
    status: frozen ? 'paused' : 'playing',
  }), [enabled, frozen, stage]);

  return {
    mapRef,
    playback: tilePlayback,
    demoAnimation,
    demoTexts,
    selectedObj,
    selectedEventIds,
    selectedSituationIds,
    actionZoneFilters,
    overlayLayerIds,
    contentStep: composed?.contentStep || null,
    hasZones: Boolean(composed?.zone_leaves?.length),
  };
}
