import axios from 'axios';
import { API_URL } from '../config/api';

/**
 * Рассчитать полигон зоны с учётом рельефа на бэкенде (viewshed по GLO-90 DEM).
 */
export async function computeLosZone(targetId, actionId, antennaHeightM = null) {
  const body = {};
  if (antennaHeightM != null && !Number.isNaN(Number(antennaHeightM))) {
    body.antenna_height_m = Number(antennaHeightM);
  }
  const { data } = await axios.post(
    `${API_URL}/api/v1/targets/${targetId}/actions/${actionId}/compute-los-zone/`,
    body,
  );
  return data;
}

import { getZonePolygonPositions, isInundationZoneMode } from './inundationZone';

export { getZonePolygonPositions };

export function isTerrainZoneEnabled(zone, terrainTypeIds) {
  if (isInundationZoneMode(zone?.zoneMode)) return false;
  const typeId = zone?.actionTypeId ?? zone?.action?.action_type?.id;
  if (typeId == null || !terrainTypeIds?.size) return false;
  return terrainTypeIds.has(Number(typeId));
}

export function isInundationZone(zone) {
  return isInundationZoneMode(zone?.zoneMode ?? zone?.action?.action_type?.zone_mode);
}
