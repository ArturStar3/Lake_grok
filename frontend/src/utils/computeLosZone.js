import axios from 'axios';
import { API_URL } from '../config/api';
import {
  getZonePolygonPositions,
  isInundationZoneType,
  isPolygonZoneMode,
  ZONE_GEOMETRY_LOS_RADAR,
} from './inundationZone';

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

export async function computeEquipmentLosZone(targetId, equipmentId, parameterId, antennaHeightM = null) {
  const body = {};
  if (antennaHeightM != null && !Number.isNaN(Number(antennaHeightM))) {
    body.antenna_height_m = Number(antennaHeightM);
  }
  const { data } = await axios.post(
    `${API_URL}/api/v1/targets/${targetId}/deployed-equipment/${equipmentId}/parameters/${parameterId}/compute-los-zone/`,
    body,
  );
  return data;
}

/**
 * Рассчитать LOS-полигон для видимой зоны (ручное действие или зона из ТТХ).
 */
export async function computeZoneLos(zone, antennaHeightM = null) {
  if (zone.isEquipmentZone) {
    if (!zone.equipmentDeploymentId || !zone.parameterId) {
      throw new Error('Нет данных техники для расчёта зоны');
    }
    return computeEquipmentLosZone(
      zone.obj.id,
      zone.equipmentDeploymentId,
      zone.parameterId,
      antennaHeightM,
    );
  }
  if (!zone.actionId) {
    throw new Error('Нет идентификатора действия для расчёта зоны');
  }
  return computeLosZone(zone.obj.id, zone.actionId, antennaHeightM);
}

export { getZonePolygonPositions };

export function isLosRadarZoneMode(zoneMode) {
  return zoneMode === ZONE_GEOMETRY_LOS_RADAR;
}

export function isTerrainZoneEnabled(zone, considerTerrain) {
  if (!considerTerrain) return false;
  const zoneMode = zone?.zoneMode ?? zone?.action?.action_type?.zone_mode;
  if (isPolygonZoneMode(zoneMode)) return false;
  return isLosRadarZoneMode(zoneMode);
}

export function isInundationZone(zone) {
  if (zone?.isInundationZone != null) return zone.isInundationZone;
  return isInundationZoneType(zone?.action?.action_type);
}

export function isPolygonZone(zone) {
  if (zone?.isPolygonZone != null) return zone.isPolygonZone;
  return isPolygonZoneMode(zone?.zoneMode ?? zone?.action?.action_type?.zone_mode);
}
