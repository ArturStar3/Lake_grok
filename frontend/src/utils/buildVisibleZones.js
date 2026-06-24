import { getActionTypeColor } from './actionZoneStyle';

export function isActionVisible(obj, action, actionZoneFilters) {
  const cTitle = obj.country?.title || 'Неизвестно';
  const aTitle = action.action_type?.title || 'Зона действия';
  const enabledSet = actionZoneFilters[cTitle];
  if (enabledSet !== undefined) {
    return enabledSet.has(aTitle);
  }
  return true;
}

/**
 * Список видимых зон действия для выбранных объектов.
 */
export function buildVisibleZones(objects, selectedSet, actionZoneFilters) {
  const zones = [];
  objects.forEach((obj) => {
    if (!selectedSet.has(obj.id) || !obj.actions?.length) return;
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
