export const ZONE_GEOMETRY_INUNDATION = 'inundation';
export const HYDRO_TARGET_TYPE_TITLE = 'Гидротехнические сооружения';

export function isInundationZoneMode(zoneMode) {
  return zoneMode === ZONE_GEOMETRY_INUNDATION;
}

export function isInundationActionType(actionType) {
  return isInundationZoneMode(actionType?.zone_mode);
}

export function isHydroTargetType(targetType) {
  return targetType?.title === HYDRO_TARGET_TYPE_TITLE;
}

export function getZonePolygonPositions(zoneGeometry) {
  if (!zoneGeometry) return null;

  if (zoneGeometry.type === 'Polygon') {
    const ring = zoneGeometry.coordinates?.[0];
    if (!ring?.length) return null;
    return ring.map(([lng, lat]) => [lat, lng]);
  }

  if (zoneGeometry.type === 'MultiPolygon') {
    const first = zoneGeometry.coordinates?.[0]?.[0];
    if (!first?.length) return null;
    return first.map(([lng, lat]) => [lat, lng]);
  }

  return null;
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
  const positions = getZonePolygonPositions(zoneGeometry);
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

export function formatInundationLevel(zoneMetadata) {
  if (!zoneMetadata) return '';
  const parts = [];
  if (zoneMetadata.scenario_label) parts.push(zoneMetadata.scenario_label);
  if (zoneMetadata.water_level_m != null && zoneMetadata.water_level_m !== '') {
    parts.push(`${zoneMetadata.water_level_m} м`);
  }
  return parts.join(' · ');
}
