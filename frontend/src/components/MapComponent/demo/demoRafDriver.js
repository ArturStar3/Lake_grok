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
let hiddenAt = null;

/**
 * Границы вьюпорта считаем раз в кадр и только если есть привязанные к точке
 * анимации: `getBounds()` каждый раз создаёт новые объекты Leaflet.
 */
function viewportBoundsFor(map) {
  if (!map) return null;
  try {
    return map.getBounds().pad(0.05);
  } catch {
    return null;
  }
}

function tick(now) {
  frameId = requestAnimationFrame(tick);

  let globalBounds;
  const boundsByMap = new Map();

  entries.forEach((entry, key) => {
    if (entry.center) {
      const map = entry.map || mapInstance;
      if (map) {
        let bounds;
        if (map === mapInstance) {
          if (globalBounds === undefined) globalBounds = viewportBoundsFor(mapInstance);
          bounds = globalBounds;
        } else {
          bounds = boundsByMap.get(map);
          if (bounds === undefined) {
            bounds = viewportBoundsFor(map);
            boundsByMap.set(map, bounds);
          }
        }
        if (bounds && !bounds.contains(entry.center)) return;
      }
    }
    try {
      entry.update(now - entry.startedAt, now);
    } catch (err) {
      // Ошибка внутри кадра повторилась бы 60 раз в секунду и сама по себе
      // уронила бы производительность показа — снимаем анимацию с цикла.
      entries.delete(key);
      console.warn('Ошибка анимации демонстрации, анимация остановлена', err);
    }
  });

  stopIfIdle();
}

function ensureRunning() {
  if (frameId != null || entries.size === 0 || document.hidden) return;
  frameId = requestAnimationFrame(tick);
}

function stopIfIdle() {
  if (entries.size > 0 || frameId == null) return;
  cancelAnimationFrame(frameId);
  frameId = null;
}

/**
 * На скрытой вкладке цикл полностью останавливаем, а при возврате сдвигаем
 * время старта на длительность паузы: иначе все анимации «прыгнут» в конец.
 */
function handleVisibilityChange() {
  if (document.hidden) {
    hiddenAt = performance.now();
    if (frameId != null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    return;
  }
  if (hiddenAt != null) {
    const pause = performance.now() - hiddenAt;
    hiddenAt = null;
    entries.forEach((entry) => {
      entry.startedAt += pause;
    });
  }
  ensureRunning();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/** Карта нужна только для отсечения анимаций вне вьюпорта. */
export function setDemoAnimationMap(map) {
  mapInstance = map || null;
}

/**
 * @param {string} key уникальный ключ анимации
 * @param {{ update: (elapsedMs: number, now: number) => void, center?: import('leaflet').LatLng, map?: import('leaflet').Map }} entry
 */
export function registerDemoAnimation(key, entry) {
  if (!key || typeof entry?.update !== 'function') return;
  const mapId = entry.map?._leaflet_id;
  const storedKey = mapId != null ? `${mapId}:${key}` : key;
  entries.set(storedKey, {
    update: entry.update,
    center: entry.center || null,
    map: entry.map || null,
    startedAt: performance.now(),
    sourceKey: key,
  });
  ensureRunning();
}

export function unregisterDemoAnimation(key, map) {
  if (!key) return;
  const mapId = map?._leaflet_id;
  if (mapId != null) entries.delete(`${mapId}:${key}`);
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
