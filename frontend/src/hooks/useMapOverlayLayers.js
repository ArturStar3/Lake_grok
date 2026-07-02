import { useCallback, useEffect, useMemo, useState } from 'react';
import { MAP_OVERLAY_LAYERS } from '../config/tiles';

const STORAGE_KEY = 'infolake.mapLayers.v1';

function readInitialState() {
  const defaults = {};
  MAP_OVERLAY_LAYERS.forEach((layer) => {
    defaults[layer.id] = layer.defaultOn;
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    MAP_OVERLAY_LAYERS.forEach((layer) => {
      if (typeof saved[layer.id] === 'boolean') {
        defaults[layer.id] = saved[layer.id];
      }
    });
  } catch {
    // некорректный JSON в localStorage — используем значения по умолчанию
  }
  return defaults;
}

/**
 * Состояние переключаемых слоёв карты с сохранением в localStorage.
 */
export function useMapOverlayLayers() {
  const [enabledById, setEnabledById] = useState(readInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledById));
    } catch {
      // localStorage недоступен — молча пропускаем
    }
  }, [enabledById]);

  const toggleLayer = useCallback((layerId) => {
    setEnabledById((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  const setAllLayers = useCallback((value) => {
    setEnabledById(() => {
      const next = {};
      MAP_OVERLAY_LAYERS.forEach((layer) => {
        next[layer.id] = Boolean(value);
      });
      return next;
    });
  }, []);

  const activeLayers = useMemo(
    () => MAP_OVERLAY_LAYERS.filter((layer) => enabledById[layer.id]),
    [enabledById],
  );

  return { enabledById, toggleLayer, setAllLayers, activeLayers };
}
