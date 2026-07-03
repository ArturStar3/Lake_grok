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
 * Применяет видимость оверлей-слоёв в едином MapLibre-стиле.
 */
export function applyOverlayVisibility(maplibreMap, enabledById) {
  if (!maplibreMap || !enabledById) return;

  const apply = () => {
    MAP_OVERLAY_LAYERS.forEach((layer) => {
      const visibility = enabledById[layer.id] ? 'visible' : 'none';
      (layer.maplibreLayerIds || []).forEach((layerId) => {
        if (maplibreMap.getLayer(layerId)) {
          maplibreMap.setLayoutProperty(layerId, 'visibility', visibility);
        }
      });
    });
  };

  if (maplibreMap.isStyleLoaded()) {
    apply();
  } else {
    maplibreMap.once('load', apply);
  }
}

/**
 * Состояние переключаемых слоёв карты с сохранением в localStorage.
 * @param {import('react').MutableRefObject<import('maplibre-gl').Map|null>} maplibreMapRef
 */
export function useMapOverlayLayers(maplibreMapRef = null, maplibreReady = false) {
  const [enabledById, setEnabledById] = useState(readInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledById));
    } catch {
      // localStorage недоступен — молча пропускаем
    }
  }, [enabledById]);

  useEffect(() => {
    const map = maplibreMapRef?.current;
    if (map && maplibreReady) {
      applyOverlayVisibility(map, enabledById);
    }
  }, [enabledById, maplibreMapRef, maplibreReady]);

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
