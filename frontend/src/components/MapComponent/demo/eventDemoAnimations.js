import { DEMO_EFFECT } from '../../../utils/demoScenario';
import { cachedBucketData, idSet } from './demoEffectCache';

function loopClass(continuous) {
  return continuous ? 'demo-anim--continuous' : 'demo-anim--once';
}

/**
 * Эффект демонстрации для конкретного события.
 * Пустой список `eventIds` в шаге означает «все показанные события».
 *
 * Ссылка на эффект общая для всех событий шага — см. demoEffectCache.
 */
export function resolveEventDemoEffect(eventItem, demoAnimation) {
  if (!demoAnimation?.active) return null;
  const bucket = demoAnimation.effects?.events;
  if (!bucket || !bucket.effect || bucket.effect === DEMO_EFFECT.NONE) return null;

  const cached = cachedBucketData(bucket, () => ({
    wanted: idSet(bucket.eventIds),
    effect: {
      effect: bucket.effect,
      durationMs: bucket.durationMs,
      delayMs: bucket.delayMs,
      continuous: Boolean(bucket.continuous),
      runId: demoAnimation.runId,
    },
  }));

  if (cached.wanted && !cached.wanted.has(String(eventItem?.id))) return null;
  return cached.effect;
}

/**
 * Эффект демонстрации для обстановки: зацикленная смена состояний.
 * @returns {null | { effect: string, perStateMs: number, crossFadeMs: number, order: string, runId: number, continuous: boolean, durationMs: number }}
 */
export function resolveSituationDemoEffect(situationId, demoAnimation) {
  if (!demoAnimation?.active) return null;
  const bucket = demoAnimation.effects?.situations;
  if (!bucket || !bucket.effect || bucket.effect === DEMO_EFFECT.NONE) return null;

  const cached = cachedBucketData(bucket, () => {
    const cycle = bucket.stateCycle || {};
    return {
      wanted: idSet(bucket.situationIds),
      effect: {
        effect: bucket.effect,
        perStateMs: cycle.per_state_ms ?? 1800,
        crossFadeMs: cycle.cross_fade_ms ?? 600,
        order: cycle.order ?? 'old_to_new',
        durationMs: bucket.durationMs,
        continuous: Boolean(bucket.continuous),
        runId: demoAnimation.runId,
      },
    };
  });

  if (cached.wanted && !cached.wanted.has(String(situationId))) return null;
  return cached.effect;
}

/** Класс CSS для фигуры/маркера события по активному эффекту. */
export function demoEffectClassName(demoEffect) {
  if (!demoEffect) return '';
  const loop = loopClass(demoEffect.continuous);
  if (demoEffect.effect === DEMO_EFFECT.BLINK) return `demo-blink ${loop}`;
  if (demoEffect.effect === DEMO_EFFECT.FADE_IN) return `demo-fade-in ${loop}`;
  return '';
}

/** Маркер события: отдельный класс мигания на корне divIcon. */
export function demoMarkerIconClass(demoEffect) {
  if (!demoEffect) return '';
  const loop = loopClass(demoEffect.continuous);
  if (demoEffect.effect === DEMO_EFFECT.BLINK) return ` event-marker-icon--demo-blink ${loop}`;
  if (demoEffect.effect === DEMO_EFFECT.FADE_IN) return ` demo-fade-in ${loop}`;
  return '';
}

/** CSS-переменные длительности на Leaflet-слое (path или icon). */
export function applyDemoEffectCssVars(layer, demoEffect) {
  const el = layer?._path || layer?._icon;
  if (!el || !demoEffect) return;
  const duration = Math.max(200, Number(demoEffect.durationMs) || 900);
  el.style.setProperty('--demo-fade-duration', `${duration}ms`);
  el.style.setProperty('--demo-blink-duration', `${duration}ms`);
}

export function demoEffectCssVars(demoEffect) {
  const duration = Math.max(200, Number(demoEffect?.durationMs) || 900);
  return `--demo-fade-duration:${duration}ms;--demo-blink-duration:${duration}ms`;
}
