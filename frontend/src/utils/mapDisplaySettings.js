export const DEFAULT_MAP_DISPLAY_ZOOM_RULES = {
  flag_tiers: [
    { max_zoom: 5, max_order: 3 },
    { max_zoom: 7, max_order: 8 },
  ],
  non_flag_min_zoom: 6,
  cluster_distance_px: 38,
};

export function normalizeMapDisplayZoomRules(raw) {
  const base = {
    flag_tiers: [...DEFAULT_MAP_DISPLAY_ZOOM_RULES.flag_tiers.map((t) => ({ ...t }))],
    non_flag_min_zoom: DEFAULT_MAP_DISPLAY_ZOOM_RULES.non_flag_min_zoom,
    cluster_distance_px: DEFAULT_MAP_DISPLAY_ZOOM_RULES.cluster_distance_px,
  };
  if (!raw || typeof raw !== 'object') return base;

  if (Array.isArray(raw.flag_tiers) && raw.flag_tiers.length) {
    const tiers = raw.flag_tiers
      .map((item) => ({
        max_zoom: Number(item?.max_zoom),
        max_order: Number(item?.max_order),
      }))
      .filter((t) => Number.isFinite(t.max_zoom) && Number.isFinite(t.max_order))
      .sort((a, b) => a.max_zoom - b.max_zoom);
    if (tiers.length) base.flag_tiers = tiers;
  }

  const nonFlagMin = Number(raw.non_flag_min_zoom);
  if (Number.isFinite(nonFlagMin)) base.non_flag_min_zoom = nonFlagMin;

  const dist = Number(raw.cluster_distance_px);
  if (Number.isFinite(dist) && dist > 0) base.cluster_distance_px = dist;

  return base;
}

/** Максимальный order флага для текущего зума (Infinity = все). */
export function getMaxFlagOrderForZoom(zoom, flagTiers) {
  const tiers = [...(flagTiers || [])].sort((a, b) => a.max_zoom - b.max_zoom);
  if (!tiers.length) return Infinity;
  if (zoom > tiers[tiers.length - 1].max_zoom) return Infinity;
  const tier = tiers.find((t) => zoom <= t.max_zoom);
  return tier ? tier.max_order : Infinity;
}

export function filterFlagObjectsForZoom(objects, zoom, zoomRules) {
  const rules = normalizeMapDisplayZoomRules(zoomRules);
  const maxOrder = getMaxFlagOrderForZoom(zoom, rules.flag_tiers);
  if (!Number.isFinite(maxOrder) || maxOrder === Infinity) return objects;
  return objects.filter((obj) => {
    const ord = parseInt(obj.marker?.order ?? 999, 10);
    return ord <= maxOrder;
  });
}

export function shouldShowNonFlagMarkers(zoom, zoomRules) {
  const rules = normalizeMapDisplayZoomRules(zoomRules);
  return zoom >= rules.non_flag_min_zoom;
}

export const MAP_CLUSTER_MODE_STORAGE_KEY = 'mapClusterMode';

export function loadMapClusterMode() {
  try {
    const v = localStorage.getItem(MAP_CLUSTER_MODE_STORAGE_KEY);
    return v === 'bubble' ? 'bubble' : 'legacy';
  } catch {
    return 'legacy';
  }
}

export function saveMapClusterMode(mode) {
  try {
    localStorage.setItem(MAP_CLUSTER_MODE_STORAGE_KEY, mode === 'bubble' ? 'bubble' : 'legacy');
  } catch {
    /* ignore */
  }
}
