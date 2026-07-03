import { getActionTypeColor } from './actionZoneStyle';
import { formatZoneEquipmentShortName } from './equipmentCatalogUtils';

export const ZONE_GEOMETRY_LOS_RADAR = 'los_radar';

export function buildZoneKey(objId, action, actionIndex) {
  const deploymentId = action._deploymentId ?? 'm';
  const actionTypeId = action.action_type?.id ?? actionIndex;
  return `${objId}-${deploymentId}-${actionTypeId}-${actionIndex}`;
}

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
        _equipmentLabel: formatZoneEquipmentShortName(deployment.equipment),
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
        actionId: action.id,
        actionIndex,
        actionTitle: action.action_type?.title || 'Зона действия',
        zoneMode: action.action_type?.zone_mode || 'flat',
        zoneGeometry: action.zone_geometry || null,
        centerLat,
        centerLng,
        radiusMeters: action.radius * 1000,
        color: getActionTypeColor(action.action_type),
        lineType: action.action_type?.line_type || 'solid',
        actionTypeId: action.action_type?.id,
        equipmentDeploymentId: action._deploymentId,
        isEquipmentZone: Boolean(action._equipmentZone),
        equipmentLabel: action._equipmentLabel || '',
        countryTitle: obj.country?.title || 'Неизвестно',
        zoneKey: buildZoneKey(obj.id, action, actionIndex),
      });
    });
  });
  return zones;
}

/** Строка для панели зон: «Су-34 · Поражение · Азербайджан». */
export function formatZoneListLine(zone) {
  const country = (zone.countryTitle || zone.obj?.country?.title || 'Неизвестно').trim();
  const actionTitle = zone.actionTitle || 'Зона действия';
  let equipmentName = '';
  if (zone.isEquipmentZone && zone.equipmentLabel?.trim()) {
    equipmentName = zone.equipmentLabel.trim();
  } else {
    equipmentName = (zone.obj?.label || zone.obj?.title || '—').trim() || '—';
  }
  return `${equipmentName} · ${actionTitle} · ${country}`;
}
