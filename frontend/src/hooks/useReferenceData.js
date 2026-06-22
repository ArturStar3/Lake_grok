import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedData = null;
let cachedAt = 0;
let inflightPromise = null;

async function loadMarkerSvgs(markers, signal) {
  const entries = await Promise.all(
    (markers || [])
      .filter((m) => m.path)
      .map(async (marker) => {
        try {
          const res = await axios.get(marker.path, { responseType: 'text', signal });
          return [marker.id, res.data];
        } catch (err) {
          if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') throw err;
          console.warn('Не удалось загрузить SVG маркера:', marker.path, err);
          return [marker.id, ''];
        }
      })
  );
  const map = new Map();
  entries.forEach(([id, svg]) => map.set(id, svg));
  return map;
}

/**
 * Загрузка справочников с модульным кэшем (countries, markers, action-types, target-types).
 */
export async function fetchReferenceData({ signal, includeMarkerSvgs = true } = {}) {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) {
    return cachedData;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    const [countriesRes, markersRes, actionTypesRes, targetTypesRes] = await Promise.all([
      axios.get(`${API_URL}/api/v1/countries`, { signal }),
      axios.get(`${API_URL}/api/v1/markers`, { signal }),
      axios.get(`${API_URL}/api/v1/action-types`, { signal }),
      axios.get(`${API_URL}/api/v1/target-types`, { signal }),
    ]);

    const markers = markersRes.data || [];
    const markerSvgs = includeMarkerSvgs
      ? await loadMarkerSvgs(markers, signal)
      : (cachedData?.markerSvgs ?? new Map());

    const data = {
      countries: countriesRes.data || [],
      markers,
      actionTypes: actionTypesRes.data || [],
      targetTypes: targetTypesRes.data || [],
      markerSvgs,
    };

    cachedData = data;
    cachedAt = Date.now();
    return data;
  })();

  try {
    return await inflightPromise;
  } finally {
    inflightPromise = null;
  }
}

/** Сброс кэша после CRUD справочников (при необходимости). */
export function invalidateReferenceDataCache() {
  cachedData = null;
  cachedAt = 0;
}

/**
 * Хук: справочники для модальных окон с кэшем и отменой запросов.
 */
export function useReferenceData(enabled) {
  const [data, setData] = useState(cachedData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchReferenceData({ signal: controller.signal });
        if (!cancelled) setData(result);
      } catch (err) {
        if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
        if (!cancelled) {
          console.error('Ошибка загрузки справочников:', err);
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]);

  return {
    countries: data?.countries ?? [],
    markers: data?.markers ?? [],
    actionTypes: data?.actionTypes ?? [],
    targetTypes: data?.targetTypes ?? [],
    markerSvgs: data?.markerSvgs ?? new Map(),
    loading,
    error,
  };
}
