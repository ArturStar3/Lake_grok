import { DEMO_EFFECT } from '../../../utils/demoScenario';
import { cachedBucketData, idSet } from './demoEffectCache';

const OBJECT_DEMO_CLASS_PREFIX = 'demo-obj-';

const EFFECT_CLASS_BY_ID = {
  [DEMO_EFFECT.FADE_IN]: 'demo-obj-fade-in',
  [DEMO_EFFECT.BLINK]: 'demo-obj-blink',
  [DEMO_EFFECT.FLICKER]: 'demo-obj-flicker',
  [DEMO_EFFECT.GLOW]: 'demo-obj-glow',
  [DEMO_EFFECT.COLOR_SHIFT]: 'demo-obj-color-shift',
  [DEMO_EFFECT.SWAY]: 'demo-obj-sway',
};

const ALL_OBJECT_DEMO_CLASSES = [
  ...Object.values(EFFECT_CLASS_BY_ID),
  'demo-anim--continuous',
  'demo-anim--once',
];

function loopClass(continuous) {
  return continuous ? 'demo-anim--continuous' : 'demo-anim--once';
}

/**
 * Эффект демонстрации для маркера объекта.
 * Пустой `targetIds` означает «все показанные объекты шага».
 *
 * Все маркеры шага получают одну и ту же ссылку на эффект — так рендер карты
 * не перезапускает уже идущую анимацию (см. demoEffectCache).
 */
export function resolveObjectDemoEffect(obj, demoAnimation) {
  if (!demoAnimation?.active) return null;
  const bucket = demoAnimation.effects?.objects;
  if (!bucket || !bucket.effect || bucket.effect === DEMO_EFFECT.NONE) return null;

  const objectId = obj?.isGroupIcon ? obj.groupId : obj?.id;
  if (objectId == null) return null;

  const cached = cachedBucketData(bucket, () => ({
    wanted: idSet(bucket.targetIds),
    effect: {
      effect: bucket.effect,
      durationMs: bucket.durationMs,
      delayMs: bucket.delayMs,
      continuous: Boolean(bucket.continuous),
      runId: demoAnimation.runId,
    },
  }));

  if (cached.wanted && !cached.wanted.has(String(objectId))) return null;
  return cached.effect;
}

/** CSS-классы на корневом `.leaflet-marker-icon` для эффекта объекта. */
export function objectDemoEffectClassName(demoEffect) {
  if (!demoEffect) return '';
  const effectClass = EFFECT_CLASS_BY_ID[demoEffect.effect];
  if (!effectClass) return '';
  return `${effectClass} ${loopClass(demoEffect.continuous)}`;
}

function clearObjectDemoClasses(el) {
  if (!el?.classList) return;
  ALL_OBJECT_DEMO_CLASSES.forEach((cls) => el.classList.remove(cls));
}

/**
 * Вешает классы и CSS-переменные на DOM-узел Leaflet-маркера.
 * @param {L.Marker | null | undefined} marker
 */
export function applyObjectDemoEffect(marker, demoEffect) {
  const el = marker?.getElement?.() || marker?._icon;
  if (!el) return;

  clearObjectDemoClasses(el);

  if (!demoEffect) {
    el.style.removeProperty('--demo-fade-duration');
    el.style.removeProperty('--demo-fade-delay');
    el.style.removeProperty('--demo-blink-duration');
    el.style.removeProperty('--demo-effect-duration');
    el.style.removeProperty('--demo-effect-delay');
    return;
  }

  const duration = Math.max(200, Number(demoEffect.durationMs) || 900);
  const delay = Math.max(0, Number(demoEffect.delayMs) || 0);
  el.style.setProperty('--demo-fade-duration', `${duration}ms`);
  el.style.setProperty('--demo-fade-delay', `${delay}ms`);
  el.style.setProperty('--demo-blink-duration', `${duration}ms`);
  el.style.setProperty('--demo-effect-duration', `${duration}ms`);
  el.style.setProperty('--demo-effect-delay', `${delay}ms`);

  const className = objectDemoEffectClassName(demoEffect);
  className.split(/\s+/).filter(Boolean).forEach((cls) => el.classList.add(cls));
}

export function objectDemoMarkerKeySuffix(demoEffect) {
  if (!demoEffect?.effect || demoEffect.effect === DEMO_EFFECT.NONE) return '';
  return `-demo-${demoEffect.runId || 0}-${demoEffect.effect}`;
}

export { OBJECT_DEMO_CLASS_PREFIX };
