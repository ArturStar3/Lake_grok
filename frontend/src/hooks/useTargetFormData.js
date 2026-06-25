import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import { fetchReferenceData, subscribeReferenceDataInvalidation } from './useReferenceData';

/**
 * Справочники для форм объектов разведки.
 * @param {boolean} isOpen — модальное окно открыто
 * @param {Array|null} cachedTargets — кэш объектов из Formular (избегает лишнего GET /targets/)
 */
export const useTargetFormData = (isOpen, cachedTargets = null) => {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refData, setRefData] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const cachedTargetsRef = useRef(cachedTargets);
  const isOpenRef = useRef(isOpen);
  cachedTargetsRef.current = cachedTargets;
  isOpenRef.current = isOpen;

  useEffect(() => {
    return subscribeReferenceDataInvalidation(() => {
      if (isOpenRef.current) setReloadToken((token) => token + 1);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const refs = await fetchReferenceData({ signal: controller.signal });
        if (cancelled) return;
        setRefData(refs);

        const cachedParents = cachedTargetsRef.current;
        if (cachedParents && cachedParents.length > 0) {
          setTargets(
            cachedParents.map((t) => ({
              id: t.id,
              title: t.title,
              label: t.label,
            }))
          );
        } else {
          const targetsRes = await axios.get(`${API_URL}/api/v1/targets/parent-options/`, {
            signal: controller.signal,
          });
          if (!cancelled) setTargets(targetsRes.data || []);
        }
      } catch (err) {
        if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
        if (!cancelled) {
          console.error('Ошибка загрузки данных:', err);
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
  }, [isOpen, reloadToken]);

  return {
    countries: refData?.countries ?? [],
    markers: refData?.markers ?? [],
    actionTypes: refData?.actionTypes ?? [],
    targetTypes: refData?.targetTypes ?? [],
    targets,
    markerSvgs: refData?.markerSvgs ?? new Map(),
    loading,
    error,
  };
};
