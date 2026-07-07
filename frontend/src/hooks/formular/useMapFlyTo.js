import { useCallback } from 'react';
import { getSituationBounds, getSituationCenter } from '../../utils/situationUtils';

const FLY_TO_OPTIONS = { duration: 1.0, easeLinearity: 0.3 };

const SITUATION_FLY_BOUNDS_OPTIONS = {
  padding: [72, 72],
  maxZoom: 7,
  duration: FLY_TO_OPTIONS.duration,
  easeLinearity: FLY_TO_OPTIONS.easeLinearity,
};

const SITUATION_FALLBACK_ZOOM = 6;

/** Отложенный flyTo на карте (не блокирует обработку клика). */
export function useMapFlyTo(mapRef, zoom = 8) {
  const flyTo = useCallback(
    (lat, lng, customZoom = zoom) => {
      if (lat == null || lng == null || !mapRef.current) return;
      requestAnimationFrame(() => {
        mapRef.current?.flyTo([lat, lng], customZoom, FLY_TO_OPTIONS);
      });
    },
    [mapRef, zoom],
  );

  const flyToBounds = useCallback(
    (bounds, options = {}) => {
      if (!bounds || !mapRef.current) return;
      requestAnimationFrame(() => {
        const map = mapRef.current;
        const flyOptions = {
          ...SITUATION_FLY_BOUNDS_OPTIONS,
          ...options,
        };
        if (typeof map.flyToBounds === 'function') {
          map.flyToBounds(bounds, flyOptions);
          return;
        }
        map.fitBounds(bounds, { ...flyOptions, animate: true });
      });
    },
    [mapRef],
  );

  const flyToSituation = useCallback(
    (situationOrRevision) => {
      const bounds = getSituationBounds(situationOrRevision);
      if (bounds) {
        flyToBounds(bounds);
        return;
      }
      const center = getSituationCenter(situationOrRevision);
      if (center) flyTo(center[0], center[1], SITUATION_FALLBACK_ZOOM);
    },
    [flyTo, flyToBounds],
  );

  return { flyTo, flyToBounds, flyToSituation };
}
