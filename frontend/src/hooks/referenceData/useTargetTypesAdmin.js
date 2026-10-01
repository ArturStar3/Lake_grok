import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../config/axios';
import axios from 'axios';
import { invalidateReferenceDataCache } from '../useReferenceData';

const TARGET_TYPES_URL = `/target-types/`;
const COUNTRIES_URL = `/countries/`;

export const EMPTY_TARGET_TYPE_FORM = {
  title: '',
  parent_id: '',
  order: 1,
  country_ids: [],
};

export function targetTypeToForm(item) {
  if (!item) return { ...EMPTY_TARGET_TYPE_FORM, country_ids: [] };
  return {
    title: item.title || '',
    parent_id: item.parent != null ? String(item.parent) : '',
    order: item.order ?? 1,
    country_ids: (item.countries || []).map(String),
  };
}

export function useTargetTypesAdmin(enabled) {
  const [items, setItems] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const [typesRes, countriesRes] = await Promise.all([
        apiClient.get(TARGET_TYPES_URL, { signal }),
        apiClient.get(COUNTRIES_URL, { signal }),
      ]);
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(typesRes.data) ? typesRes.data : []);
      setCountries(Array.isArray(countriesRes.data) ? countriesRes.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки типов объектов', err);
      setError('Не удалось загрузить типы объектов');
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
      country_ids: (payload.country_ids || []).map((cid) => parseInt(cid, 10)),
    };
    if (id) {
      const res = await apiClient.put(`${TARGET_TYPES_URL}/${id}/`, body);
      return res.data;
    }
    const res = await apiClient.post(`${TARGET_TYPES_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await apiClient.delete(`${TARGET_TYPES_URL}/${id}/`);
  }, []);

  const notifyChanged = useCallback(() => {
    invalidateReferenceDataCache();
  }, []);

  return {
    items,
    countries,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
    notifyChanged,
  };
}
