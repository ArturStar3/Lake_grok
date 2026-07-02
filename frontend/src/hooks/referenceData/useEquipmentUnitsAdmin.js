import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const UNITS_URL = `${API_URL}/api/v1/equipment-units`;

export const EMPTY_UNIT_FORM = {
  title: '',
  symbol: '',
};

export function unitToForm(item) {
  if (!item) return { ...EMPTY_UNIT_FORM };
  return {
    title: item.title || '',
    symbol: item.symbol || '',
  };
}

export function useEquipmentUnitsAdmin(enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(UNITS_URL, { signal });
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки единиц измерения', err);
      setError('Не удалось загрузить единицы измерения');
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
      symbol: payload.symbol.trim(),
    };
    if (id) {
      const res = await axios.put(`${UNITS_URL}/${id}/`, body);
      return res.data;
    }
    const res = await axios.post(`${UNITS_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await axios.delete(`${UNITS_URL}/${id}/`);
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
