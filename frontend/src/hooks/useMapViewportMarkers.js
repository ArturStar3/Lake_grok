import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';

const DEFAULT_PAD = 0.15;
const DEBOUNCE_MS = 80;

function isSameVisibleList(prev, next) {
  if (prev === next) return true;
  if (!prev || !next || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function buildItemsKey(list) {
  if (!list?.length) return '';
  return list.map((item) => item.id ?? `${item.lat},${item.lng}`).join('|');
}

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
  const itemsKey = buildItemsKey(items);

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

  const setVisibleIfChanged = useCallback((next) => {
    setVisible((prev) => (isSameVisibleList(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setVisibleIfChanged(itemsRef.current ?? []);
      return undefined;
    }

    let timeoutId = null;

    const scheduleUpdate = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setVisibleIfChanged(filterByBounds());
      }, DEBOUNCE_MS);
    };

    setVisibleIfChanged(filterByBounds());
    map.on('moveend', scheduleUpdate);
    map.on('zoomend', scheduleUpdate);

    return () => {
      map.off('moveend', scheduleUpdate);
      map.off('zoomend', scheduleUpdate);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [map, enabled, filterByBounds, setVisibleIfChanged]);

  useEffect(() => {
    if (enabled) {
      setVisibleIfChanged(filterByBounds());
    } else {
      setVisibleIfChanged(items ?? []);
    }
  }, [itemsKey, enabled, filterByBounds, setVisibleIfChanged, items]);

  return visible;
}
