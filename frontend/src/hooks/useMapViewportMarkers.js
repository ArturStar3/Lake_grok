import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';

const DEFAULT_PAD = 0.15;
const DEBOUNCE_MS = 80;

/**
 * Фильтрует маркеры по видимой области карты (с буфером).
 * Пересчёт на moveend/zoomend, не во время drag.
 *
 * @param {Array} items — объекты с lat/lng
 * @param {{ pad?: number, enabled?: boolean }} [options]
 */
export function useMapViewportMarkers(items, options = {}) {
  const map = useMap();
  const { pad = DEFAULT_PAD, enabled = true } = options;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const filterByBounds = useCallback(() => {
    const list = itemsRef.current;
    if (!enabled || !map || !list?.length) return list ?? [];

    const bounds = map.getBounds().pad(pad);
    return list.filter((item) => {
      if (item.lat == null || item.lng == null) return false;
      return bounds.contains([item.lat, item.lng]);
    });
  }, [map, pad, enabled]);

  const [visible, setVisible] = useState(() => filterByBounds());

  useEffect(() => {
    if (!enabled) {
      setVisible(itemsRef.current ?? []);
      return undefined;
    }

    let timeoutId = null;

    const scheduleUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setVisible(filterByBounds());
      }, DEBOUNCE_MS);
    };

    setVisible(filterByBounds());
    map.on('moveend', scheduleUpdate);
    map.on('zoomend', scheduleUpdate);

    return () => {
      map.off('moveend', scheduleUpdate);
      map.off('zoomend', scheduleUpdate);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [map, enabled, filterByBounds]);

  useEffect(() => {
    if (enabled) {
      setVisible(filterByBounds());
    } else {
      setVisible(items ?? []);
    }
  }, [items, enabled, filterByBounds]);

  return visible;
}
