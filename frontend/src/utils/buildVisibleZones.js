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

function collectEquipmentZoneActions(obj) {
  const actions = [];
  if (!obj.deployed_equipment?.length) return actions;

  obj.deployed_equipment.forEach((deployment) => {
    deployment.zones?.forEach((zone) => {
      if (!zone.radius_km || zone.radius_km <= 0) return;
      if (!zone.action_type) return;
      actions.push({
        action_type: zone.action_type,
        radius: zone.radius_km,
        _equipmentZone: true,
        _deploymentId: deployment.equipment?.id,
        _equipmentTitle: deployment.equipment?.designation || deployment.equipment?.title,
      });
    });
  });
  return actions;
}

export function getObjectZoneActions(obj) {
  const manual = obj.actions || [];
  const fromEquipment = collectEquipmentZoneActions(obj);
  if (!fromEquipment.length) return manual;
  if (!manual.length) return fromEquipment;
  return [...manual, ...fromEquipment];
}

/**
 * Объекты с действиями, прошедшие фильтр зон (страна + тип действия).
 * Не зависит от чекбоксов таблицы объектов и filterCountry.
 */
export function filterObjectsForZones(objects, actionZoneFilters) {
  return objects
    .map((obj) => {
      const zoneActions = getObjectZoneActions(obj);
      if (!zoneActions.length) return null;
      const filteredActions = zoneActions.filter((action) =>
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
    const zoneActions = getObjectZoneActions(obj);
    if (!zoneActions.length) return;
    const c = obj.country?.title || 'Неизвестно';
    if (!byCountry[c]) byCountry[c] = new Set();
    zoneActions.forEach((action) => {
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
    const zoneActions = getObjectZoneActions(obj);
    if (!zoneActions.length) return;
    const centerLat = obj.lat;
    const centerLng = obj.lng;
    zoneActions.forEach((action, actionIndex) => {
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
        equipmentDeploymentId: action._deploymentId,
      });
    });
  });
  return zones;
}
