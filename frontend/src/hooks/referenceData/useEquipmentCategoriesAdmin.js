import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const CATEGORIES_URL = `${API_URL}/api/v1/equipment-categories`;

export const EMPTY_CATEGORY_FORM = {
  title: '',
  parent_id: '',
  order: 1,
};

export function categoryToForm(item) {
  if (!item) return { ...EMPTY_CATEGORY_FORM };
  return {
    title: item.title || '',
    parent_id: item.parent != null ? String(item.parent) : '',
    order: item.order ?? 1,
  };
}

export function useEquipmentCategoriesAdmin(enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(CATEGORIES_URL, { signal });
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки категорий техники', err);
      setError('Не удалось загрузить категории техники');
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
      parent_id: payload.parent_id ? parseInt(payload.parent_id, 10) : null,
      order: parseInt(payload.order, 10) || 1,
    };
    if (id) {
      const res = await axios.put(`${CATEGORIES_URL}/${id}/`, body);
      return res.data;
    }
    const res = await axios.post(`${CATEGORIES_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await axios.delete(`${CATEGORIES_URL}/${id}/`);
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
