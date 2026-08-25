import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { ZONE_LEAF_MANUAL, makeParamLeaf } from '../../../utils/inundationZone';
import { applyEasing, DEMO_EFFECT } from '../../../utils/demoScenario';
import { registerDemoAnimation, unregisterDemoAnimation } from './demoRafDriver';
import { applyDemoEffectCssVars } from './eventDemoAnimations';

const MIN_REVEAL_RADIUS_M = 1;

export { MIN_REVEAL_RADIUS_M };

function zoneLeafKey(zone) {
  return zone.isEquipmentZone && zone.parameterId != null
    ? makeParamLeaf(zone.parameterId)
    : ZONE_LEAF_MANUAL;
}

function matchesZoneLeaves(zone, zoneLeaves) {
  if (!zoneLeaves?.length) return false;
  const leaf = zoneLeafKey(zone);
  const actionTypeId = String(zone.actionTypeId ?? '');
  const country = String(zone.countryTitle ?? '');
  return zoneLeaves.some((item) => (
    String(item.country) === country
    && String(item.action_type_id) === actionTypeId
    && String(item.leaf) === leaf
  ));
}

/**
 * Какой эффект демонстрации применяется к конкретной зоне.
 * Зоны затопления берут настройки из шага «Зоны затопления», остальные — из «Зоны действия».
 * @returns {null | { effect: string, durationMs: number, delayMs: number, easing: string, direction: string, runId: number, continuous: boolean }}
 */
export function resolveZoneDemoEffect(zone, demoAnimation) {
  if (!demoAnimation?.active) return null;
  const bucket = zone.isInundationZone
    ? demoAnimation.effects?.inundation
    : demoAnimation.effects?.zones;
  if (!bucket) return null;
  if (!matchesZoneLeaves(zone, bucket.zoneLeaves)) return null;
  return {
    effect: bucket.effect,
    durationMs: bucket.durationMs,
    delayMs: bucket.delayMs,
    easing: bucket.easing,
    direction: bucket.direction,
    continuous: Boolean(bucket.continuous),
    runId: demoAnimation.runId,
  };
}

export function demoFadeClassName(baseClass, demoEffect) {
  if (demoEffect?.effect !== DEMO_EFFECT.FADE_IN) return baseClass;
  const loop = demoEffect.continuous ? 'demo-anim--continuous' : 'demo-anim--once';
  return `${baseClass} demo-fade-in ${loop}`.trim();
}

export function useDemoEffectCssVars(layerRef, demoEffect) {
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !demoEffect) return undefined;
    const apply = () => applyDemoEffectCssVars(layer, demoEffect);
    if (layer._path || layer._icon) {
      apply();
      return undefined;
    }
    const id = window.setTimeout(apply, 50);
    return () => window.clearTimeout(id);
  }, [layerRef, demoEffect, demoEffect?.durationMs, demoEffect?.runId, demoEffect?.effect]);
}

function timedProgress(elapsed, delayMs, durationMs, continuous) {
  const t = elapsed - delayMs;
  if (t <= 0) return { waiting: true, progress: 0, done: false };
  if (!durationMs) return { waiting: false, progress: 1, done: !continuous };
  if (continuous) {
    return { waiting: false, progress: (t % durationMs) / durationMs, done: false };
  }
  if (t >= durationMs) return { waiting: false, progress: 1, done: true };
  return { waiting: false, progress: t / durationMs, done: false };
}

function positionsSignature(positions) {
  if (!positions?.length) return 'empty';
  const first = positions[0];
  const last = positions[positions.length - 1];
  const a = Array.isArray(first) ? first : [first?.lat, first?.lng];
  const b = Array.isArray(last) ? last : [last?.lat, last?.lng];
  return `${positions.length}:${a[0]}:${a[1]}:${b[0]}:${b[1]}`;
}

/**
 * Раскрытие круговой зоны от центра: радиус растёт от нуля до заданного.
 * Cleanup не возвращает полный радиус — иначе Strict Mode и смена deps
 * дают кадр «полной» зоны (мигание) перед новым стартом.
 */
export function useCircleRevealAnimation(circleRef, {
  enabled,
  runId,
  radiusMeters,
  durationMs,
  delayMs = 0,
  easing = 'ease_out',
  continuous = false,
  animationKey,
}) {
  useEffect(() => {
    const layer = circleRef.current;
    if (!layer) return undefined;

    if (!enabled || !durationMs || !radiusMeters) {
      if (radiusMeters) layer.setRadius(radiusMeters);
      return undefined;
    }

    const key = `circle-reveal:${animationKey}:${runId}`;
    layer.setRadius(MIN_REVEAL_RADIUS_M);

    let finished = false;
    registerDemoAnimation(key, {
      center: layer.getLatLng(),
      update: (elapsed) => {
        if (finished) return;
        const { waiting, progress, done } = timedProgress(elapsed, delayMs, durationMs, continuous);
        if (waiting) return;
        if (done) {
          finished = true;
          layer.setRadius(radiusMeters);
          unregisterDemoAnimation(key);
          return;
        }
        const eased = applyEasing(easing, progress);
        layer.setRadius(Math.max(MIN_REVEAL_RADIUS_M, radiusMeters * eased));
      },
    });

    return () => {
      unregisterDemoAnimation(key);
    };
  }, [circleRef, enabled, runId, radiusMeters, durationMs, delayMs, easing, continuous, animationKey]);
}

function scalePositionsFromCentroid(positions, centroid, factor) {
  return positions.map(([lat, lng]) => [
    centroid.lat + (lat - centroid.lat) * factor,
    centroid.lng + (lng - centroid.lng) * factor,
  ]);
}

export function collapsePositionsToCentroid(positions, centroid, factor = 0.001) {
  if (!positions?.length || !centroid) return positions;
  return scalePositionsFromCentroid(positions, centroid, factor);
}

/**
 * Раскрытие полигональной зоны от центроида: точки контура «разъезжаются» из центра.
 */
export function usePolygonRevealAnimation(polygonRef, {
  enabled,
  runId,
  positions,
  centroid,
  durationMs,
  delayMs = 0,
  easing = 'ease_out',
  continuous = false,
  animationKey,
}) {
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const signature = positionsSignature(positions);

  useEffect(() => {
    const layer = polygonRef.current;
    const pts = positionsRef.current;
    if (!layer || !pts?.length || !centroid) return undefined;

    if (!enabled || !durationMs) {
      layer.setLatLngs(pts);
      return undefined;
    }

    const key = `polygon-reveal:${animationKey}:${runId}`;
    const collapsed = scalePositionsFromCentroid(pts, centroid, 0.001);
    layer.setLatLngs(collapsed);

    let finished = false;
    registerDemoAnimation(key, {
      center: { lat: centroid.lat, lng: centroid.lng },
      update: (elapsed) => {
        if (finished) return;
        const current = positionsRef.current;
        if (!current?.length) return;
        const { waiting, progress, done } = timedProgress(elapsed, delayMs, durationMs, continuous);
        if (waiting) return;
        if (done) {
          finished = true;
          layer.setLatLngs(current);
          unregisterDemoAnimation(key);
          return;
        }
        const eased = Math.max(0.001, applyEasing(easing, progress));
        layer.setLatLngs(scalePositionsFromCentroid(current, centroid, eased));
      },
    });

    return () => {
      unregisterDemoAnimation(key);
    };
  }, [polygonRef, enabled, runId, signature, centroid, durationMs, delayMs, easing, continuous, animationKey]);
}

const WIPE_ID_PREFIX = 'demo-wipe-';
let wipeSeq = 0;

/**
 * Направленное появление полигона (слева/справа/сверху/снизу).
 *
 * Реализовано через SVG clipPath в overlay-пейне Leaflet: прямоугольник
 * задаётся в координатах SVG (getBBox), поэтому пересчитывается при зуме/пане.
 */
export function useDirectionalWipeAnimation(polygonRef, {
  enabled,
  runId,
  positions,
  direction = 'left',
  durationMs,
  delayMs = 0,
  easing = 'ease_out',
  continuous = false,
  animationKey,
}) {
  const map = useMap();
  const signature = positionsSignature(positions);

  useEffect(() => {
    if (!enabled || !durationMs) return undefined;

    let cancelled = false;
    let started = false;
    let retryId = 0;
    let retries = 0;
    const layerAtStart = polygonRef.current;
    const pathAtStart = layerAtStart?._path;
    if (pathAtStart) pathAtStart.style.visibility = 'hidden';

    const cleanupFns = [];

    const tryStart = () => {
      if (cancelled || started) return;
      const layer = polygonRef.current;
      const path = layer?._path;
      const svg = path?.ownerSVGElement;
      if (!path || !svg) {
        if (retries < 12) {
          retries += 1;
          retryId = window.setTimeout(tryStart, 50);
        }
        return;
      }
      started = true;

      wipeSeq += 1;
      const clipId = `${WIPE_ID_PREFIX}${wipeSeq}`;

      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }
      const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clipPath.setAttribute('id', clipId);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      clipPath.appendChild(rect);
      defs.appendChild(clipPath);

      const measure = () => {
        const hadClip = path.getAttribute('clip-path');
        if (hadClip) path.removeAttribute('clip-path');
        let nextBox;
        try {
          nextBox = path.getBBox();
        } catch {
          nextBox = { x: 0, y: 0, width: 0, height: 0 };
        }
        if (hadClip) path.setAttribute('clip-path', hadClip);
        const pad = 4;
        return {
          minX: nextBox.x - pad,
          minY: nextBox.y - pad,
          width: nextBox.width + pad * 2,
          height: nextBox.height + pad * 2,
        };
      };

      let box = measure();
      let progress = 0;
      let finished = false;

      const paint = () => {
        const revealedW = box.width * progress;
        const revealedH = box.height * progress;
        switch (direction) {
          case 'right':
            rect.setAttribute('x', String(box.minX + box.width - revealedW));
            rect.setAttribute('y', String(box.minY));
            rect.setAttribute('width', String(revealedW));
            rect.setAttribute('height', String(box.height));
            break;
          case 'top':
            rect.setAttribute('x', String(box.minX));
            rect.setAttribute('y', String(box.minY));
            rect.setAttribute('width', String(box.width));
            rect.setAttribute('height', String(revealedH));
            break;
          case 'bottom':
            rect.setAttribute('x', String(box.minX));
            rect.setAttribute('y', String(box.minY + box.height - revealedH));
            rect.setAttribute('width', String(box.width));
            rect.setAttribute('height', String(revealedH));
            break;
          case 'left':
          default:
            rect.setAttribute('x', String(box.minX));
            rect.setAttribute('y', String(box.minY));
            rect.setAttribute('width', String(revealedW));
            rect.setAttribute('height', String(box.height));
            break;
        }
      };

      path.setAttribute('clip-path', `url(#${clipId})`);
      paint();
      path.style.visibility = '';

      const handleViewReset = () => {
        box = measure();
        paint();
      };
      map.on('zoomend', handleViewReset);
      map.on('moveend', handleViewReset);

      const key = `polygon-wipe:${animationKey}:${runId}`;
      registerDemoAnimation(key, {
        update: (elapsed) => {
          if (finished) return;
          const { waiting, progress: raw, done } = timedProgress(elapsed, delayMs, durationMs, continuous);
          if (waiting) return;
          if (done) {
            finished = true;
            progress = 1;
            paint();
            unregisterDemoAnimation(key);
            return;
          }
          progress = applyEasing(easing, raw);
          paint();
        },
      });

      cleanupFns.push(() => {
        unregisterDemoAnimation(key);
        map.off('zoomend', handleViewReset);
        map.off('moveend', handleViewReset);
        path.removeAttribute('clip-path');
        path.style.visibility = '';
        clipPath.remove();
      });
    };

    tryStart();

    return () => {
      cancelled = true;
      if (retryId) window.clearTimeout(retryId);
      cleanupFns.forEach((fn) => fn());
    };
  }, [polygonRef, map, enabled, runId, signature, direction, durationMs, delayMs, easing, continuous, animationKey]);
}
