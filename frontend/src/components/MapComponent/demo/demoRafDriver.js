/**
 * Общий rAF-цикл для анимаций режима демонстрации.
 *
 * Один кадр обслуживает все зарегистрированные анимации: это дешевле, чем
 * отдельный requestAnimationFrame на каждую зону/полигон, которых на карте
 * может быть несколько сотен.
 *
 * Каждая запись получает своё время старта, поэтому анимации, добавленные
 * в разные моменты, считают прогресс независимо.
 */

const entries = new Map();
let frameId = null;
let mapInstance = null;

function tick(now) {
  frameId = requestAnimationFrame(tick);

  // Не тратим CPU/GPU, когда вкладка скрыта.
  if (document.hidden) return;

  const bounds = mapInstance ? mapInstance.getBounds().pad(0.05) : null;

  entries.forEach((entry) => {
    if (bounds && entry.center && !bounds.contains(entry.center)) return;
    try {
      entry.update(now - entry.startedAt, now);
    } catch (err) {
      console.warn('Ошибка анимации демонстрации', err);
    }
  });
}

function ensureRunning() {
  if (frameId != null || entries.size === 0) return;
  frameId = requestAnimationFrame(tick);
}

function stopIfIdle() {
  if (entries.size > 0 || frameId == null) return;
  cancelAnimationFrame(frameId);
  frameId = null;
}

/** Карта нужна только для отсечения анимаций вне вьюпорта. */
export function setDemoAnimationMap(map) {
  mapInstance = map || null;
}

/**
 * @param {string} key уникальный ключ анимации
 * @param {{ update: (elapsedMs: number, now: number) => void, center?: import('leaflet').LatLng }} entry
 */
export function registerDemoAnimation(key, entry) {
  if (!key || typeof entry?.update !== 'function') return;
  entries.set(key, {
    update: entry.update,
    center: entry.center || null,
    startedAt: performance.now(),
  });
  ensureRunning();
}

export function unregisterDemoAnimation(key) {
  if (!key) return;
  entries.delete(key);
  stopIfIdle();
}

/** Сбрасывает время старта — используется при перезапуске шага демонстрации. */
export function restartDemoAnimation(key) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.startedAt = performance.now();
}

export function clearDemoAnimations() {
  entries.clear();
  stopIfIdle();
}
