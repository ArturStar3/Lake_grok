import { useCallback, useState } from 'react';

const STORAGE_KEY = 'infolake.considerTerrain';

function loadConsiderTerrain() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function persistConsiderTerrain(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/** Глобальный переключатель учёта рельефа для типов с режимом los_radar. */
export function useConsiderTerrain() {
  const [considerTerrain, setConsiderTerrainState] = useState(loadConsiderTerrain);

  const setConsiderTerrain = useCallback((value) => {
    const next = Boolean(value);
    setConsiderTerrainState(next);
    persistConsiderTerrain(next);
  }, []);

  return { considerTerrain, setConsiderTerrain };
}
