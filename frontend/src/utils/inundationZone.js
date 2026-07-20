export const ZONE_GEOMETRY_POLYGON = 'polygon';
export const ZONE_GEOMETRY_LOS_RADAR = 'los_radar';
export const ZONE_GEOMETRY_FLAT = 'flat';
export const INUNDATION_FILTER_LABEL = 'Зоны затопления';

/** @deprecated use ZONE_GEOMETRY_POLYGON */
export const ZONE_GEOMETRY_INUNDATION = ZONE_GEOMETRY_POLYGON;

export function isPolygonZoneMode(zoneMode) {
  return zoneMode === ZONE_GEOMETRY_POLYGON;
}

export function isInundationZoneMode(zoneMode) {
  return isPolygonZoneMode(zoneMode);
}

export function isInundationZoneType(actionType) {
  return Boolean(actionType?.is_inundation_zone);
}

/** @deprecated use isInundationZoneType */
export function isInundationActionType(actionType) {
  return isInundationZoneType(actionType);
}

export function isHydroTargetType(targetType, allTypes = null) {
  if (!targetType) return false;
  if (targetType.title === 'Гидротехнические сооружения') return true;
  if (!allTypes?.length || targetType.parent == null) return false;
  const parent = allTypes.find((type) => String(type.id) === String(targetType.parent));
  return isHydroTargetType(parent, allTypes);
}

export function resolveActionType(action, actionTypes = []) {
  if (action?.action_type_id != null && action.action_type_id !== '') {
    const fromList = actionTypes.find((type) => String(type.id) === String(action.action_type_id));
    if (fromList) return fromList;
  }
  return action?.action_type || null;
}

export function isPolygonAction(action, actionTypes = []) {
  if (action?.zone_geometry) return true;
  const actionType = resolveActionType(action, actionTypes);
  return isPolygonZoneMode(actionType?.zone_mode);
}

export function isInundationAction(action, actionTypes = []) {
  if (action?.inundation_scenario) return true;
  const actionType = resolveActionType(action, actionTypes);
  if (isInundationZoneType(actionType)) return true;
  if (action?.zone_metadata != null && isPolygonAction(action, actionTypes)) return true;
  return false;
}

export const ZONE_LEAF_MANUAL = 'manual';

export function makeParamLeaf(parameterId) {
  return `param:${parameterId}`;
}

export function isParamLeaf(leaf) {
  return typeof leaf === 'string' && leaf.startsWith('param:');
}

export function getActionFilterDimensions(action) {
  const actionType = action?.action_type;
  const actionTypeId = actionType?.id;
  if (!actionTypeId) return null;

  if (action?._equipmentZone) {
    const parameterId = action._parameterId;
    if (!parameterId) return null;
    return {
      actionTypeId: String(actionTypeId),
      leaf: makeParamLeaf(parameterId),
    };
  }

  return {
    actionTypeId: String(actionTypeId),
    leaf: ZONE_LEAF_MANUAL,
  };
}

/** @deprecated Используйте getActionFilterDimensions для фильтров зон */
export function getActionFilterKey(action) {
  const dims = getActionFilterDimensions(action);
  if (!dims) {
    const actionType = action?.action_type;
    if (actionType?.is_inundation_zone) return INUNDATION_FILTER_LABEL;
    return actionType?.title || 'Зона действия';
  }
  if (dims.leaf === ZONE_LEAF_MANUAL) {
    return action?.action_type?.title || 'Зона действия';
  }
  return dims.leaf;
}

export function mapTargetActionToForm(action) {
  const actionType = action?.action_type || null;
  const inundation = isInundationZoneType(actionType);
  const polygon = isPolygonZoneMode(actionType?.zone_mode) || Boolean(action?.zone_geometry);
  return {
    action_type_id: actionType?.id || '',
    action_type: actionType,
    radius: action?.radius ?? '',
    zone_geometry: action?.zone_geometry || null,
    inundation_scenario: inundation,
    zone_metadata: inundation
      ? (action?.zone_metadata || {
        water_level_m: '',
        seasonality: '',
        scenario_label: '',
        notes: '',
      })
      : (action?.zone_metadata ?? null),
    polygon_scenario: polygon && !inundation,
  };
}

export function getZonePolygonPositions(zoneGeometry) {
  const list = getZonePolygonPositionsList(zoneGeometry);
  if (!list.length) return null;
  return list[0];
}

/** Все внешние кольца Polygon / MultiPolygon в формате Leaflet [[lat,lng], ...]. */
export function getZonePolygonPositionsList(zoneGeometry) {
  if (!zoneGeometry) return [];

  if (zoneGeometry.type === 'Polygon') {
    const ring = zoneGeometry.coordinates?.[0];
    if (!ring?.length) return [];
    return [ring.map(([lng, lat]) => [lat, lng])];
  }

  if (zoneGeometry.type === 'MultiPolygon') {
    return (zoneGeometry.coordinates || [])
      .map((poly) => {
        const ring = poly?.[0];
        if (!ring?.length) return null;
        return ring.map(([lng, lat]) => [lat, lng]);
      })
      .filter(Boolean);
  }

  return [];
}

function positionsRingToDrawPoints(positions) {
  if (!positions?.length) return [];
  const points = positions.map(([lat, lng]) => ({ lat, lng }));
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) {
      return points.slice(0, -1);
    }
  }
  return points;
}

/** GeoJSON → массив контуров для рисования/редактирования. */
export function geoJsonToDrawPolygons(zoneGeometry) {
  return getZonePolygonPositionsList(zoneGeometry)
    .map((positions) => positionsRingToDrawPoints(positions))
    .filter((points) => points.length >= 3);
}

/** N контуров → GeoJSON Polygon (1) или MultiPolygon (2+). */
export function drawPolygonsToGeoJson(polygons) {
  if (!polygons?.length) return null;
  const normalized = polygons.filter((points) => points?.length >= 3);
  if (!normalized.length) return null;
  if (normalized.length === 1) {
    return pointsToGeoJsonPolygon(normalized[0]);
  }
  const coordinates = normalized.map((points) => {
    const ring = points.map((point) => [point.lng, point.lat]);
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }
    return [ring];
  });
  return {
    type: 'MultiPolygon',
    coordinates,
  };
}

export function getPolygonBounds(positions) {
  if (!positions?.length) return null;
  let minLat = positions[0][0];
  let maxLat = positions[0][0];
  let minLng = positions[0][1];
  let maxLng = positions[0][1];

  positions.forEach(([lat, lng]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });

  return { minLat, maxLat, minLng, maxLng };
}

export function getPolygonCentroid(positions) {
  if (!positions?.length) return null;
  let latSum = 0;
  let lngSum = 0;
  const count = positions.length;
  positions.forEach(([lat, lng]) => {
    latSum += lat;
    lngSum += lng;
  });
  return { lat: latSum / count, lng: lngSum / count };
}

export function isPointInPolygon(lat, lng, positions) {
  if (!positions?.length) return false;
  let inside = false;
  for (let i = 0, j = positions.length - 1; i < positions.length; j = i, i += 1) {
    const [yi, xi] = positions[i];
    const [yj, xj] = positions[j];
    const intersects = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointsToGeoJsonPolygon(points) {
  if (!points?.length) return null;
  const ring = points.map((point) => [point.lng, point.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

export function geoJsonPolygonToDrawPoints(zoneGeometry) {
  const polygons = geoJsonToDrawPolygons(zoneGeometry);
  return polygons[0] || [];
}

export function formatInundationLevel(zoneMetadata) {
  if (!zoneMetadata) return '';
  const parts = [];
  if (zoneMetadata.scenario_label) parts.push(zoneMetadata.scenario_label);
  if (zoneMetadata.seasonality) parts.push(zoneMetadata.seasonality);
  if (zoneMetadata.water_level_m != null && zoneMetadata.water_level_m !== '') {
    parts.push(`${zoneMetadata.water_level_m} м`);
  }
  return parts.join(' · ');
}
