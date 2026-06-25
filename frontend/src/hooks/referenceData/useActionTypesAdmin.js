import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { invalidateReferenceDataCache } from '../useReferenceData';
import { normalizeHexColor } from '../../utils/actionZoneStyle';

const ACTION_TYPES_URL = `${API_URL}/api/v1/action-types`;

export const EMPTY_ACTION_TYPE_FORM = {
  title: '',
  color: '#3388ff',
  line_type: 'solid',
};

export function actionTypeToForm(item) {
  if (!item) return { ...EMPTY_ACTION_TYPE_FORM };
  return {
    title: item.title || '',
    color: item.color || '#3388ff',
    line_type: item.line_type || 'solid',
  };
}

export function useActionTypesAdmin(enabled) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(ACTION_TYPES_URL, { signal });
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки типов зон действия', err);
      setError('Не удалось загрузить типы зон действия');
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
      color: normalizeHexColor(payload.color),
      line_type: payload.line_type || 'solid',
    };
    if (id) {
      const res = await axios.put(`${ACTION_TYPES_URL}/${id}/`, body);
      return res.data;
    }
    const res = await axios.post(`${ACTION_TYPES_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await axios.delete(`${ACTION_TYPES_URL}/${id}/`);
  }, []);

  const notifyChanged = useCallback(() => {
    invalidateReferenceDataCache();
  }, []);

  return {
    items,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
    notifyChanged,
  };
}
