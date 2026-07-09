import {
  getActionTypeColor,
  getActionTypeLineType,
} from './actionZoneStyle';
import {
  formatInundationLevel,
  getActionFilterDimensions,
  getPolygonCentroid,
  getPolygonBounds,
  getZonePolygonPositions,
  INUNDATION_FILTER_LABEL,
  isInundationZoneType,
  isPolygonZoneMode,
  makeParamLeaf,
  ZONE_LEAF_MANUAL,
} from './inundationZone';

export const ZONE_GEOMETRY_LOS_RADAR = 'los_radar';
export const ZONE_GEOMETRY_POLYGON = 'polygon';

/** @deprecated */
export const ZONE_GEOMETRY_INUNDATION = ZONE_GEOMETRY_POLYGON;

export { ZONE_LEAF_MANUAL, makeParamLeaf };

export function buildZoneKey(objId, action, actionIndex) {
  const deploymentId = action._deploymentId ?? 'm';
  const parameterId = action._parameterId ?? 'm';
  const actionTypeId = action.action_type?.id ?? actionIndex;
  return `${objId}-${deploymentId}-${parameterId}-${actionTypeId}-${actionIndex}`;
}

export function resolveZoneStyle(action) {
  if (action?._equipmentZone) {
    return {
      color: action._effectiveColor ?? getActionTypeColor(action.action_type),
      lineType: action._effectiveLineType ?? getActionTypeLineType(action.action_type),
    };
  }
  return {
    color: getActionTypeColor(action.action_type),
    lineType: getActionTypeLineType(action.action_type),
  };
}

export function isActionVisible(obj, action, actionZoneFilters) {
  const cTitle = obj.country?.title || 'Неизвестно';
  const countryFilters = actionZoneFilters[cTitle];
  if (!countryFilters) return false;

  const dims = getActionFilterDimensions(action);
  if (!dims) return false;

  const typeSet = countryFilters[dims.actionTypeId];
  if (!typeSet) return false;
  return typeSet.has(dims.leaf);
}

export function hasEnabledZoneFilters(actionZoneFilters) {
  return Object.values(actionZoneFilters).some((countryFilters) =>
    countryFilters && Object.values(countryFilters).some((leafSet) => leafSet && leafSet.size > 0),
  );
}

function collectEquipmentZoneActions(obj) {
  const actions = [];
  if (!obj.deployed_equipment?.length) return actions;

  obj.deployed_equipment.forEach((deployment) => {
    deployment.zones?.forEach((zone) => {
      if (!zone.radius_km || zone.radius_km <= 0) return;
      if (!zone.action_type) return;
      const zoneMode = zone.action_type.zone_mode || 'flat';
      if (isPolygonZoneMode(zoneMode)) return;
      if (!zone.parameter_id) return;

      actions.push({
        action_type: zone.action_type,
        radius: zone.radius_km,
        _equipmentZone: true,
        _deploymentId: deployment.equipment?.id,
        _parameterId: zone.parameter_id,
        _parameterTitle: zone.parameter_title || '',
        _effectiveColor: zone.zone_color,
        _effectiveLineType: zone.zone_line_type,
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

function ensureCatalogActionType(catalog, actionTypeId, actionType) {
  const key = String(actionTypeId);
  if (!catalog[key]) {
    catalog[key] = {
      actionTypeId: actionType.id,
      actionTypeTitle: actionType.title || 'Зона действия',
      color: getActionTypeColor(actionType),
      lineType: getActionTypeLineType(actionType),
      hasManual: false,
      ttxParameters: new Map(),
    };
  }
  return catalog[key];
}

function addCatalogLeaf(catalog, action) {
  const actionType = action?.action_type;
  if (!actionType?.id) return;

  const group = ensureCatalogActionType(catalog, actionType.id, actionType);

  if (action._equipmentZone) {
    const parameterId = action._parameterId;
    if (!parameterId) return;
    const style = resolveZoneStyle(action);
    group.ttxParameters.set(parameterId, {
      parameterId,
      title: action._parameterTitle || `Параметр #${parameterId}`,
      color: style.color,
      lineType: style.lineType,
    });
    return;
  }

  group.hasManual = true;
}

/**
 * Каталог зон по странам для панели фильтров.
 * @returns {Record<string, Array<{ actionTypeId, actionTypeTitle, color, lineType, hasManual, ttxParameters }>>}
 */
export function buildActionZoneCatalog(objects) {
  const byCountry = {};

  objects.forEach((obj) => {
    const zoneActions = getObjectZoneActions(obj);
    if (!zoneActions.length) return;
    const c = obj.country?.title || 'Неизвестно';
    if (!byCountry[c]) byCountry[c] = {};

    zoneActions.forEach((action) => {
      addCatalogLeaf(byCountry[c], action);
    });
  });

  const result = {};
  Object.entries(byCountry).forEach(([country, catalogMap]) => {
    result[country] = Object.values(catalogMap)
      .map((group) => ({
        ...group,
        ttxParameters: Array.from(group.ttxParameters.values())
          .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
      }))
      .sort((a, b) => a.actionTypeTitle.localeCompare(b.actionTypeTitle, 'ru'));
  });
  return result;
}

export function getAllLeavesForActionType(group) {
  const leaves = [];
  if (group.hasManual) leaves.push(ZONE_LEAF_MANUAL);
  group.ttxParameters.forEach((param) => {
    leaves.push(makeParamLeaf(param.parameterId));
  });
  return leaves;
}

export function getAllLeavesForCountry(countryGroups) {
  const leaves = [];
  countryGroups.forEach((group) => {
    leaves.push(...getAllLeavesForActionType(group));
  });
  return leaves;
}

/**
 * Объекты с действиями, прошедшие фильтр зон (страна + тип действия + лист).
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
      const isPolygon = isPolygonZoneMode(zoneMode);
      const isInundation = isInundationZoneType(action.action_type);
      const zoneGeometry = action.zone_geometry || null;
      const polygonPositions = isPolygon ? getZonePolygonPositions(zoneGeometry) : null;

      if (isPolygon) {
        if (!polygonPositions?.length) return;
      } else if (!action.radius || action.radius <= 0) {
        return;
      }

      const centroid = polygonPositions
        ? getPolygonCentroid(polygonPositions)
        : { lat: centerLat, lng: centerLng };

      const { color, lineType } = resolveZoneStyle(action);
      const zoneKey = buildZoneKey(obj.id, action, actionIndex);

      zones.push({
        obj,
        action,
        actionId: action.id ?? null,
        actionIndex,
        actionTitle: action.action_type?.title || 'Зона действия',
        zoneMode,
        zoneGeometry,
        zoneMetadata: action.zone_metadata || null,
        centerLat: centroid.lat,
        centerLng: centroid.lng,
        radiusMeters: isPolygon ? 0 : action.radius * 1000,
        polygonPositions,
        polygonBounds: polygonPositions ? getPolygonBounds(polygonPositions) : null,
        isInundationZone: isInundation,
        isPolygonZone: isPolygon,
        color,
        lineType,
        actionTypeId: action.action_type?.id,
        equipmentDeploymentId: action._deploymentId ?? null,
        parameterId: action._parameterId ?? null,
        isEquipmentZone: Boolean(action._equipmentZone),
        parameterTitle: action._parameterTitle || '',
        countryTitle: obj.country?.title || 'Неизвестно',
        zoneKey,
      });
    });
  });
  return zones;
}

/** Строка для панели зон. */
export function formatZoneListLine(zone) {
  const country = (zone.countryTitle || zone.obj?.country?.title || 'Неизвестно').trim();
  const actionTitle = zone.isInundationZone
    ? INUNDATION_FILTER_LABEL
    : (zone.actionTitle || 'Зона действия');
  const inundationLevel = zone.isInundationZone
    ? formatInundationLevel(zone.zoneMetadata)
    : '';

  let label = '';
  if (zone.isEquipmentZone && zone.parameterTitle?.trim()) {
    label = zone.parameterTitle.trim();
  } else if (zone.isEquipmentZone) {
    label = 'Техника';
  } else {
    label = (zone.obj?.label || zone.obj?.title || '—').trim() || '—';
  }

  const levelSuffix = inundationLevel ? ` (${inundationLevel})` : '';
  return `${label} · ${actionTitle}${levelSuffix} · ${country}`;
}
