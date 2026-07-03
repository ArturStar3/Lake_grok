import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVisibleZones } from '../../utils/buildVisibleZones';
import { computeLosZone } from '../../utils/computeLosZone';

function buildComputeKey(zone) {
  const antenna = zone.obj?.antenna_height_m ?? 10;
  return [
    zone.obj?.id,
    zone.actionId,
    zone.centerLat?.toFixed(6),
    zone.centerLng?.toFixed(6),
    zone.radiusMeters,
    antenna,
  ].join('|');
}

function geometryMatchesZone(zone, geometry) {
  if (!geometry?.coordinates?.length) return false;
  const props = geometry.properties || {};
  const radiusKm = zone.radiusMeters / 1000;
  const antenna = zone.obj?.antenna_height_m ?? 10;
  return (
    Math.abs((props.max_range_km ?? 0) - radiusKm) < 0.01
    && Math.abs((props.antenna_height_m ?? antenna) - antenna) < 0.01
  );
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

/**
 * Автоматически запрашивает полигоны зон с учётом рельефа для выбранных типов действия.
 */
export function useAutoLosZoneGeometries({
  zoneObjects,
  actionZoneFilters,
  terrainTypeIds,
  enabled,
}) {
  const [geometryByActionId, setGeometryByActionId] = useState({});
  const [computingCount, setComputingCount] = useState(0);
  const [errorsByActionId, setErrorsByActionId] = useState({});
  const cacheRef = useRef(new Map());
  const requestGenRef = useRef(0);

  const terrainZones = useMemo(() => {
    if (!enabled || !terrainTypeIds?.size) return [];
    return buildVisibleZones(zoneObjects, actionZoneFilters).filter(
      (zone) => zone.actionTypeId != null && terrainTypeIds.has(Number(zone.actionTypeId)),
    );
  }, [zoneObjects, actionZoneFilters, terrainTypeIds, enabled]);

  const terrainZonesKey = useMemo(
    () => terrainZones.map((z) => buildComputeKey(z)).sort().join('|'),
    [terrainZones],
  );

  useEffect(() => {
    if (!enabled || !terrainTypeIds?.size || terrainZones.length === 0) {
      setComputingCount(0);
      return undefined;
    }

    const generation = requestGenRef.current + 1;
    requestGenRef.current = generation;
    let cancelled = false;

    const seedFromApi = {};
    terrainZones.forEach((zone) => {
      const key = buildComputeKey(zone);
      if (geometryMatchesZone(zone, zone.zoneGeometry)) {
        cacheRef.current.set(key, zone.zoneGeometry);
        seedFromApi[zone.actionId] = zone.zoneGeometry;
      }
    });
    if (Object.keys(seedFromApi).length > 0) {
      setGeometryByActionId((prev) => ({ ...prev, ...seedFromApi }));
    }

    const pending = terrainZones.filter((zone) => {
      const key = buildComputeKey(zone);
      return !cacheRef.current.has(key);
    });

    if (pending.length === 0) {
      setComputingCount(0);
      return undefined;
    }

    setComputingCount(pending.length);

    (async () => {
      const newErrors = {};
      await mapWithConcurrency(pending, 3, async (zone) => {
        if (cancelled || requestGenRef.current !== generation) return;
        const key = buildComputeKey(zone);
        try {
          const data = await computeLosZone(
            zone.obj.id,
            zone.actionId,
            zone.obj.antenna_height_m,
          );
          if (cancelled || requestGenRef.current !== generation) return;
          const geometry = data.zone_geometry;
          cacheRef.current.set(key, geometry);
          setGeometryByActionId((prev) => ({
            ...prev,
            [zone.actionId]: geometry,
          }));
          setErrorsByActionId((prev) => {
            if (!prev[zone.actionId]) return prev;
            const next = { ...prev };
            delete next[zone.actionId];
            return next;
          });
        } catch (err) {
          if (cancelled || requestGenRef.current !== generation) return;
          const message = err?.response?.data?.detail || err?.message || 'Ошибка расчёта';
          newErrors[zone.actionId] = message;
        } finally {
          if (!cancelled && requestGenRef.current === generation) {
            setComputingCount((prev) => Math.max(0, prev - 1));
          }
        }
      });

      if (!cancelled && requestGenRef.current === generation && Object.keys(newErrors).length > 0) {
        setErrorsByActionId((prev) => ({ ...prev, ...newErrors }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, terrainTypeIds, terrainZonesKey, terrainZones]);

  return {
    geometryByActionId,
    computingCount,
    errorsByActionId,
    losZonesCount: terrainZones.length,
  };
}
