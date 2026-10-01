import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../config/axios';
import axios from 'axios';

const RELATION_TYPES_URL = `/relation-types/`;

export const EMPTY_RELATION_TYPE_FORM = {
  title: '',
  reverse_title: '',
};

export function relationTypeToForm(item) {
  if (!item) return { ...EMPTY_RELATION_TYPE_FORM };
  return {
    title: item.title || '',
    reverse_title: item.reverse_title || '',
  };
}

export function useRelationTypesAdmin(enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(RELATION_TYPES_URL, { signal });
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки характеров связи', err);
      setError('Не удалось загрузить характеры связи');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    reload(controller.signal);
    return () => {
      controller.abort();
      loadSeqRef.current += 1;
    };
  }, [enabled, reload]);

  const saveItem = useCallback(async (id, payload) => {
    const body = {
      title: payload.title.trim(),
      reverse_title: (payload.reverse_title || '').trim(),
    };
    if (id) {
      const res = await apiClient.put(`${RELATION_TYPES_URL}${id}/`, body);
      return res.data;
    }
    const res = await apiClient.post(RELATION_TYPES_URL, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await apiClient.delete(`${RELATION_TYPES_URL}${id}/`);
  }, []);

  return {
    items,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
  };
}
