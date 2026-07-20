import { useEffect, useState } from 'react';
import { apiClient } from '../../config/axios';
import {
  DEFAULT_MAP_DISPLAY_ZOOM_RULES,
  normalizeMapDisplayZoomRules,
} from '../../utils/mapDisplaySettings';

export function useMapDisplaySettings() {
  const [zoomRules, setZoomRules] = useState(DEFAULT_MAP_DISPLAY_ZOOM_RULES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/map-display-settings/');
        if (!cancelled) {
          setZoomRules(normalizeMapDisplayZoomRules(data?.zoom_rules));
        }
      } catch (err) {
        console.warn('Не удалось загрузить настройки карты:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { zoomRules, loaded };
}
