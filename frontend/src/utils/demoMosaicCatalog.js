import { filterRevisionsForSituations } from './situationUtils';

const CACHE_LIMIT = 24;
const sliceCache = new Map();

const EMPTY_SLICE = {
  objects: [],
  zoneObjects: [],
  events: [],
  situations: [],
  situationRevisions: [],
  actionTypes: [],
  countriesList: [],
};

function addAll(set, values) {
  (values || []).forEach((value) => {
    if (value == null || value === '') return;
    set.add(String(value));
  });
}

/**
 * Все сущности, которые этап может показать на любом такте
 * (включая содержимое, которое позже сбрасывается hold_previous).
 */
export function collectStageEntityIds(stage) {
  const ids = {
    target_ids: new Set(),
    event_ids: new Set(),
    situation_ids: new Set(),
    country_isos: new Set(),
    zone_countries: new Set(),
    action_type_ids: new Set(),
    overlay_layer_ids: new Set(),
  };
  if (!stage) return ids;

  (stage.steps || []).forEach((step) => {
    const selection = step.selection || {};
    addAll(ids.target_ids, selection.target_ids);
    addAll(ids.event_ids, selection.event_ids);
    addAll(ids.situation_ids, selection.situation_ids);
    addAll(ids.overlay_layer_ids, selection.overlay_layer_ids);
    addAll(
      ids.country_isos,
      (selection.country_isos || []).map((iso) => String(iso).trim().toUpperCase()),
    );
    (selection.zone_leaves || []).forEach((leaf) => {
      if (leaf?.country) ids.zone_countries.add(String(leaf.country));
      if (leaf?.action_type_id != null) ids.action_type_ids.add(String(leaf.action_type_id));
    });
  });

  return ids;
}

function filterById(list, wanted) {
  if (!wanted.size || !list?.length) return [];
  return list.filter((item) => wanted.has(String(item.id)));
}

function cacheKey(stage, catalogs) {
  return [
    stage?.id ?? '',
    catalogs.objects?.length ?? 0,
    catalogs.events?.length ?? 0,
    catalogs.situations?.length ?? 0,
    catalogs.situationRevisions?.length ?? 0,
    catalogs.actionTypes?.length ?? 0,
    catalogs.countriesList?.length ?? 0,
  ].join(':');
}

function remember(key, value) {
  if (sliceCache.has(key)) sliceCache.delete(key);
  sliceCache.set(key, value);
  if (sliceCache.size > CACHE_LIMIT) {
    const oldest = sliceCache.keys().next().value;
    sliceCache.delete(oldest);
  }
  return value;
}

export function clearMosaicCatalogCache() {
  sliceCache.clear();
}

/**
 * Каталоги, достаточные, чтобы плитка проиграла этап: маркеры, зоны, события,
 * обстановки. Остальное отсекается.
 */
export function sliceCatalogsForStage(stage, catalogs = {}) {
  if (!stage) return EMPTY_SLICE;
  const key = cacheKey(stage, catalogs);
  const cached = sliceCache.get(key);
  if (cached) return cached;

  const ids = collectStageEntityIds(stage);
  const objects = catalogs.objects || [];
  const events = catalogs.events || [];
  const situations = catalogs.situations || [];
  const situationRevisions = catalogs.situationRevisions || [];
  const actionTypes = catalogs.actionTypes || [];
  const countriesList = catalogs.countriesList || [];

  const slicedObjects = filterById(objects, ids.target_ids);
  const zoneObjects = ids.zone_countries.size
    ? objects.filter((obj) => {
      if (ids.target_ids.has(String(obj.id))) return true;
      const title = obj.country?.title;
      return Boolean(title && ids.zone_countries.has(String(title)));
    })
    : slicedObjects;

  [...slicedObjects, ...zoneObjects].forEach((obj) => {
    const iso = String(obj.country?.iso_code || '').trim().toUpperCase();
    if (iso) ids.country_isos.add(iso);
  });

  const slicedCountries = countriesList.filter((country) => {
    const iso = String(country.iso_code || '').trim().toUpperCase();
    const title = country.title;
    return (iso && ids.country_isos.has(iso))
      || (title && ids.zone_countries.has(String(title)));
  });

  const slicedTypes = ids.action_type_ids.size
    ? actionTypes.filter((item) => ids.action_type_ids.has(String(item.id)))
    : [];

  return remember(key, {
    objects: slicedObjects,
    zoneObjects,
    events: filterById(events, ids.event_ids),
    situations: filterById(situations, ids.situation_ids),
    situationRevisions: filterRevisionsForSituations(situationRevisions, [...ids.situation_ids]),
    actionTypes: slicedTypes,
    countriesList: slicedCountries,
  });
}
