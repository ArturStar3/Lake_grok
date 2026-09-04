import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  DEMO_CAMERA_MODE,
  DEMO_EFFECT,
  DEMO_TOOL,
  buildStageBeats,
  zoneLeavesToFilters,
} from '../../utils/demoScenario';
import { getCachedComposeStateForStage } from '../../utils/demoMosaicCatalog';
import { getEventCenter } from '../../utils/eventGeometry';
import { getSituationBounds } from '../../utils/situationUtils';
import {
  acquireMosaicPlayback,
  getMosaicPlayback,
  mosaicPlaybackKey,
  releaseMosaicPlayback,
  setMosaicPlaybackPaused,
  subscribeMosaicPlayback,
} from './mosaicStagePlayback';

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
 * Биты шарит с другими слотами того же stage_id через mosaicStagePlayback + clock.
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
  const cameraTimersRef = useRef([]);
  const dataRef = useRef({ objects, events, situations, countriesList });
  dataRef.current = { objects, events, situations, countriesList };
  const lastCameraRunRef = useRef(-1);
  const [, setPlaybackVersion] = useState(0);

  const playback = useMemo(() => buildStageBeats(stage?.steps || []), [stage]);
  const beats = useMemo(() => playback.beats || [], [playback]);
  const stageId = stage?.id != null ? String(stage.id) : null;
  const key = (enabled && stageId && beats.length)
    ? mosaicPlaybackKey(stageId, { loop, startDelayMs })
    : null;

  const getBeatDuration = useCallback((index) => (
    Math.max(16, beats[index]?.durationMs || 0)
  ), [beats]);

  useLayoutEffect(() => {
    if (!key) return undefined;
    acquireMosaicPlayback(key, {
      beatCount: beats.length,
      getBeatDuration,
      loop,
      startDelayMs,
    });
    const unsub = subscribeMosaicPlayback(key, () => {
      setPlaybackVersion((version) => version + 1);
    });
    return () => {
      unsub();
      releaseMosaicPlayback(key);
    };
  }, [beats.length, getBeatDuration, key, loop, startDelayMs]);

  useEffect(() => {
    if (!key) return undefined;
    setMosaicPlaybackPaused(key, paused);
    return undefined;
  }, [key, paused]);

  const shared = key ? getMosaicPlayback(key) : null;
  const clockReady = Boolean(shared?.clockReady);
  const boundedBeat = shared
    ? Math.max(0, Math.min(Math.max(beats.length - 1, 0), shared.beatIndex))
    : 0;
  const frozen = Boolean(shared?.frozen);
  const animationRunId = shared?.animationRunId || 0;
  const currentBeat = beats[boundedBeat] || null;

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

  // Камера на каждом слоте своя (размер контейнера), при смене бита / runId.
  useEffect(() => {
    if (!enabled || !stage || !clockReady) return undefined;
    if (lastCameraRunRef.current === animationRunId) return undefined;
    lastCameraRunRef.current = animationRunId;
    const state = getCachedComposeStateForStage(stage, boundedBeat);
    requestCamera(state?.cameraStep, animationRunId <= 1);
    return undefined;
  }, [animationRunId, boundedBeat, clockReady, enabled, requestCamera, stage]);

  useEffect(() => () => {
    clearCameraTimers();
  }, [clearCameraTimers]);

  const composed = useMemo(
    () => (stage && clockReady ? getCachedComposeStateForStage(stage, boundedBeat) : null),
    [clockReady, stage, boundedBeat],
  );

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
