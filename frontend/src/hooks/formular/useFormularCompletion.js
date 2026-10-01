import { useEffect, useState } from 'react';
import { apiClient } from '../../config/axios';

/**
 * Загрузка заполненности формуляров по объектам страны.
 */
export function useFormularCompletion(countryId) {
  const [sections, setSections] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!countryId) {
      setSections([]);
      setTargets([]);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.get(`/targets/formular-completion/`, {
          params: { country: countryId },
        });
        if (cancelled) return;
        setSections(Array.isArray(data?.sections) ? data.sections : []);
        setTargets(Array.isArray(data?.targets) ? data.targets : []);
      } catch (err) {
        if (cancelled) return;
        setSections([]);
        setTargets([]);
        setError(err?.response?.data?.detail || err?.message || 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  return { sections, targets, loading, error };
}
