import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL as API_ROOT } from '../../config/api';

const TARGETS_API_URL = `${API_ROOT}/api/v1/targets`;

export function useTargetsList() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get(TARGETS_API_URL, { signal });
      const data = resp.data;
      setObjects(Array.isArray(data) ? data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      console.error('Не удалось загрузить данные по объектам', err);
      setError('Не удалось загрузить объекты. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  const deleteTarget = useCallback(async (targetId, targetTitle) => {
    const confirmed = window.confirm(`Вы уверены, что хотите удалить объект "${targetTitle}"?`);
    if (!confirmed) return false;

    try {
      await axios.delete(`${TARGETS_API_URL}/${targetId}/`);
      await fetchData();
      return true;
    } catch (err) {
      console.error('Ошибка при удалении объекта:', err);
      alert('Не удалось удалить объект. Попробуйте ещё раз.');
      return false;
    }
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  return {
    objects,
    loading,
    error,
    refresh,
    deleteTarget,
  };
}
