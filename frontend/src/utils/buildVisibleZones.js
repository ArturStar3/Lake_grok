import { getActionTypeColor } from './actionZoneStyle';
import { formatZoneEquipmentShortName } from './equipmentCatalogUtils';
import {
  formatInundationLevel,
  getPolygonCentroid,
  getPolygonBounds,
  getZonePolygonPositions,
  isInundationActionType,
} from './inundationZone';

export const ZONE_GEOMETRY_LOS_RADAR = 'los_radar';
export const ZONE_GEOMETRY_INUNDATION = 'inundation';

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

      const zoneMode = action.action_type?.zone_mode || 'flat';
      const isInundation = isInundationActionType(action.action_type);
      const zoneGeometry = action.zone_geometry || null;
      const polygonPositions = isInundation ? getZonePolygonPositions(zoneGeometry) : null;

      if (isInundation) {
        if (!polygonPositions?.length) return;
      } else if (!action.radius || action.radius <= 0) {
        return;
      }

      const centroid = polygonPositions
        ? getPolygonCentroid(polygonPositions)
        : { lat: centerLat, lng: centerLng };

      zones.push({
        obj,
        action,
        actionId: action.id,
        actionIndex,
        actionTitle: action.action_type?.title || 'Зона действия',
        zoneMode,
        zoneGeometry,
        zoneMetadata: action.zone_metadata || null,
        centerLat: centroid.lat,
        centerLng: centroid.lng,
        radiusMeters: isInundation ? 0 : action.radius * 1000,
        polygonPositions,
        polygonBounds: polygonPositions ? getPolygonBounds(polygonPositions) : null,
        isInundationZone: isInundation,
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
  const inundationLevel = zone.isInundationZone
    ? formatInundationLevel(zone.zoneMetadata)
    : '';
  let equipmentName = '';
  if (zone.isEquipmentZone && zone.equipmentLabel?.trim()) {
    equipmentName = zone.equipmentLabel.trim();
  } else {
    equipmentName = (zone.obj?.label || zone.obj?.title || '—').trim() || '—';
  }
  const levelSuffix = inundationLevel ? ` (${inundationLevel})` : '';
  return `${equipmentName} · ${actionTitle}${levelSuffix} · ${country}`;
}
