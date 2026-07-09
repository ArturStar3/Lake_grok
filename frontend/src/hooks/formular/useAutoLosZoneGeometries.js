import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeZoneLos } from '../../utils/computeLosZone';

const LOS_DEBOUNCE_MS = 350;
const LOS_BATCH_FLUSH_MS = 80;
const LOS_CONCURRENCY = 2;
const MAX_LOS_ZONES_PER_BATCH = 40;

function buildComputeKey(zone) {
  const antenna = zone.obj?.antenna_height_m ?? 10;
  return [
    zone.zoneKey,
    zone.centerLat?.toFixed(6),
    zone.centerLng?.toFixed(6),
    zone.radiusMeters,
    antenna,
  ].join('|');
}

function canComputeLosZone(zone) {
  if (zone.isEquipmentZone) {
    return Boolean(zone.equipmentDeploymentId && zone.parameterId);
  }
  return Boolean(zone.actionId);
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
 * Запрашивает полигоны зон с учётом рельефа (батчами, с debounce).
 */
export function useAutoLosZoneGeometries({
  terrainZones = [],
  considerTerrain,
  enabled,
}) {
  const [geometryByZoneKey, setGeometryByZoneKey] = useState({});
  const [computingCount, setComputingCount] = useState(0);
  const [errorsByZoneKey, setErrorsByZoneKey] = useState({});
  const cacheRef = useRef(new Map());
  const requestGenRef = useRef(0);
  const pendingGeometriesRef = useRef({});
  const flushTimerRef = useRef(null);

  const terrainZonesKey = useMemo(
    () => terrainZones.map((z) => buildComputeKey(z)).sort().join('|'),
    [terrainZones],
  );

  const [debouncedZonesKey, setDebouncedZonesKey] = useState(terrainZonesKey);

  useEffect(() => {
    if (!enabled || !considerTerrain) {
      setDebouncedZonesKey(terrainZonesKey);
      return undefined;
    }
    const timer = setTimeout(() => setDebouncedZonesKey(terrainZonesKey), LOS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, considerTerrain, terrainZonesKey]);

  const flushPendingGeometries = useCallback(() => {
    const batch = pendingGeometriesRef.current;
    if (!Object.keys(batch).length) return;
    pendingGeometriesRef.current = {};
    setGeometryByZoneKey((prev) => ({ ...prev, ...batch }));
  }, []);

  const queueGeometry = useCallback((zoneKey, geometry) => {
    pendingGeometriesRef.current[zoneKey] = geometry;
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushPendingGeometries();
    }, LOS_BATCH_FLUSH_MS);
  }, [flushPendingGeometries]);

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

  useEffect(() => {
    if (!enabled || !considerTerrain || terrainZones.length === 0) {
      setComputingCount(0);
      return undefined;
    }

    if (debouncedZonesKey !== terrainZonesKey) {
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
        seedFromApi[zone.zoneKey] = zone.zoneGeometry;
      }
    });
    if (Object.keys(seedFromApi).length > 0) {
      setGeometryByZoneKey((prev) => ({ ...prev, ...seedFromApi }));
    }

    const allPending = terrainZones.filter((zone) => {
      if (!canComputeLosZone(zone)) return false;
      const key = buildComputeKey(zone);
      return !cacheRef.current.has(key);
    });

    if (allPending.length === 0) {
      setComputingCount(0);
      return undefined;
    }

    setComputingCount(allPending.length);

    (async () => {
      const newErrors = {};
      let processed = 0;

      for (let offset = 0; offset < allPending.length; offset += MAX_LOS_ZONES_PER_BATCH) {
        if (cancelled || requestGenRef.current !== generation) break;
        const batch = allPending.slice(offset, offset + MAX_LOS_ZONES_PER_BATCH);

        await mapWithConcurrency(batch, LOS_CONCURRENCY, async (zone) => {
          if (cancelled || requestGenRef.current !== generation) return;
          const key = buildComputeKey(zone);
          try {
            const data = await computeZoneLos(
              zone,
              zone.obj.antenna_height_m,
            );
            if (cancelled || requestGenRef.current !== generation) return;
            const geometry = data.zone_geometry;
            cacheRef.current.set(key, geometry);
            queueGeometry(zone.zoneKey, geometry);
            setErrorsByZoneKey((prev) => {
              if (!prev[zone.zoneKey]) return prev;
              const next = { ...prev };
              delete next[zone.zoneKey];
              return next;
            });
          } catch (err) {
            if (cancelled || requestGenRef.current !== generation) return;
            const message = err?.response?.data?.detail || err?.message || 'Ошибка расчёта';
            newErrors[zone.zoneKey] = message;
          } finally {
            processed += 1;
            if (!cancelled && requestGenRef.current === generation) {
              setComputingCount(Math.max(0, allPending.length - processed));
            }
          }
        });
      }

      if (!cancelled && requestGenRef.current === generation) {
        flushPendingGeometries();
        setComputingCount(0);
        if (Object.keys(newErrors).length > 0) {
          setErrorsByZoneKey((prev) => ({ ...prev, ...newErrors }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    considerTerrain,
    debouncedZonesKey,
    terrainZonesKey,
    terrainZones,
    queueGeometry,
    flushPendingGeometries,
  ]);

  return {
    geometryByZoneKey,
    computingCount,
    errorsByZoneKey,
    losZonesCount: terrainZones.length,
  };
}
