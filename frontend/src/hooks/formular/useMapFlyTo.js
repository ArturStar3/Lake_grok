import { useCallback } from 'react';

const FLY_TO_OPTIONS = { duration: 1.0, easeLinearity: 0.3 };

/** Отложенный flyTo на карте (не блокирует обработку клика). */
export function useMapFlyTo(mapRef, zoom = 8) {
  return useCallback(
    (lat, lng) => {
      if (lat == null || lng == null || !mapRef.current) return;
      requestAnimationFrame(() => {
        mapRef.current?.flyTo([lat, lng], zoom, FLY_TO_OPTIONS);
      });
    },
    [mapRef, zoom],
  );
}
