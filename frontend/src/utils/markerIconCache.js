/**
 * Глобальный кэш L.DivIcon для маркеров карты.
 * Снижает стоимость enrichSvg + new L.DivIcon при пересчёте кластеров.
 */

const iconCache = new Map();

/**
 * @param {string} key
 * @param {() => import('leaflet').DivIcon} factory
 * @returns {import('leaflet').DivIcon}
 */
export function getOrCreateDivIcon(key, factory) {
  if (iconCache.has(key)) {
    return iconCache.get(key);
  }
  const icon = factory();
  iconCache.set(key, icon);
  return icon;
}

/** Сброс при смене набора объектов (objectsDataKey). */
export function clearMarkerIconCache() {
  iconCache.clear();
}

export function buildIconCacheKey(parts) {
  return parts.filter((p) => p != null && p !== '').join('|');
}
