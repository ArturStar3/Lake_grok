import { getActionTypeColor } from './actionZoneStyle';

export function isActionVisible(obj, action, actionZoneFilters) {
  const cTitle = obj.country?.title || 'Неизвестно';
  const aTitle = action.action_type?.title || 'Зона действия';
  const enabledSet = actionZoneFilters[cTitle];
  if (!enabledSet) return false;
  return enabledSet.has(aTitle);
}

export function hasEnabledZoneFilters(actionZoneFilters) {
  return Object.values(actionZoneFilters).some((set) => set && set.size > 0);
}

/**
 * Объекты с действиями, прошедшие фильтр зон (страна + тип действия).
 * Не зависит от чекбоксов таблицы объектов и filterCountry.
 */
export function filterObjectsForZones(objects, actionZoneFilters) {
  return objects
    .map((obj) => {
      if (!obj.actions?.length) return null;
      const filteredActions = obj.actions.filter((action) =>
        isActionVisible(obj, action, actionZoneFilters),
      );
      if (!filteredActions.length) return null;
      return { ...obj, actions: filteredActions };
    })
    .filter(Boolean);
}

/**
 * Каталог стран и типов зон по полному списку объектов (для панели фильтров).
 */
export function buildActionZoneCatalog(objects) {
  const byCountry = {};
  objects.forEach((obj) => {
    if (!obj.actions?.length) return;
    const c = obj.country?.title || 'Неизвестно';
    if (!byCountry[c]) byCountry[c] = new Set();
    obj.actions.forEach((action) => {
      const t = action.action_type?.title || 'Зона действия';
      byCountry[c].add(t);
    });
  });
  return byCountry;
}

/**
 * Список видимых зон действия. Фильтрация только через actionZoneFilters.
 */
export function buildVisibleZones(objects, actionZoneFilters) {
  const zones = [];
  objects.forEach((obj) => {
    if (!obj.actions?.length) return;
    const centerLat = obj.lat;
    const centerLng = obj.lng;
    obj.actions.forEach((action, actionIndex) => {
      if (!isActionVisible(obj, action, actionZoneFilters)) return;
      if (!action.radius || action.radius <= 0) return;
      zones.push({
        obj,
        action,
        actionIndex,
        actionTitle: action.action_type?.title || 'Зона действия',
        centerLat,
        centerLng,
        radiusMeters: action.radius * 1000,
        color: getActionTypeColor(action.action_type),
        lineType: action.action_type?.line_type || 'solid',
        actionTypeId: action.action_type?.id,
      });
    });
  });
  return zones;
}
