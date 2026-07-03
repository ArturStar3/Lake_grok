import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'infolake.terrainZoneTypeIds';
const LEGACY_KEY = 'infolake.rlsDisplayMode';

function defaultEnabledIds(actionTypes) {
  return actionTypes
    .filter((t) => t.zone_mode === 'los_radar')
    .map((t) => Number(t.id));
}

function loadEnabledIds(actionTypes) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((id) => Number(id)).filter((id) => !Number.isNaN(id)));
      }
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'circle') {
      return new Set();
    }
    if (legacy === 'terrain' && actionTypes.length > 0) {
      return new Set(defaultEnabledIds(actionTypes));
    }
  } catch {
    /* ignore */
  }

  if (actionTypes.length > 0) {
    return new Set(defaultEnabledIds(actionTypes));
  }
  return new Set();
}

function persistEnabledIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * Набор id типов зон действия, для которых включён учёт рельефа (полигон по DEM).
 * @param {Array<{ id: number, zone_mode?: string, title?: string }>} actionTypes
 */
export function useTerrainZoneTypes(actionTypes = []) {
  const [enabledIds, setEnabledIds] = useState(() => new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !actionTypes?.length) return;
    initializedRef.current = true;
    setEnabledIds(loadEnabledIds(actionTypes));
  }, [actionTypes]);

  const isTerrainEnabled = useCallback(
    (typeId) => {
      if (typeId == null) return false;
      return enabledIds.has(Number(typeId));
    },
    [enabledIds],
  );

  const toggleTerrainType = useCallback((typeId) => {
    const id = Number(typeId);
    if (Number.isNaN(id)) return;
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistEnabledIds(next);
      return next;
    });
  }, []);

  const setTerrainTypeEnabled = useCallback((typeId, enabled) => {
    const id = Number(typeId);
    if (Number.isNaN(id)) return;
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      persistEnabledIds(next);
      return next;
    });
  }, []);

  const setAllTerrainTypes = useCallback((enabled, types = actionTypes) => {
    setEnabledIds(() => {
      const next = enabled
        ? new Set(types.map((t) => Number(t.id)).filter((id) => !Number.isNaN(id)))
        : new Set();
      persistEnabledIds(next);
      return next;
    });
  }, [actionTypes]);

  return {
    terrainTypeIds: enabledIds,
    isTerrainEnabled,
    toggleTerrainType,
    setTerrainTypeEnabled,
    setAllTerrainTypes,
  };
}
