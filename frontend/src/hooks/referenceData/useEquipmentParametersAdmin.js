import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const PARAMETERS_URL = `${API_URL}/api/v1/equipment-parameters`;
const UNITS_URL = `${API_URL}/api/v1/equipment-units`;
const CATEGORIES_URL = `${API_URL}/api/v1/equipment-categories`;
const ACTION_TYPES_URL = `${API_URL}/api/v1/action-types`;

export const EMPTY_PARAMETER_FORM = {
  title: '',
  code: '',
  help_text: '',
  unit_id: '',
  action_type_id: '',
  category_ids: [],
};

export function parameterToForm(item) {
  if (!item) return { ...EMPTY_PARAMETER_FORM, category_ids: [] };
  const categoryIds = item.category_ids
    || (item.categories || []).map((c) => c.id);
  return {
    title: item.title || '',
    code: item.code || '',
    help_text: item.help_text || '',
    unit_id: item.unit?.id ? String(item.unit.id) : '',
    action_type_id: item.action_type?.id ? String(item.action_type.id) : '',
    category_ids: categoryIds.map(String),
  };
}

export function useEquipmentParametersAdmin(enabled, schemaVersion = 0) {
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const [parametersRes, unitsRes, categoriesRes, actionTypesRes] = await Promise.all([
        axios.get(PARAMETERS_URL, { signal }),
        axios.get(UNITS_URL, { signal }),
        axios.get(CATEGORIES_URL, { signal }),
        axios.get(ACTION_TYPES_URL, { signal }),
      ]);
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(parametersRes.data) ? parametersRes.data : []);
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setActionTypes(Array.isArray(actionTypesRes.data) ? actionTypesRes.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки параметров ТТХ', err);
      setError('Не удалось загрузить параметры ТТХ');
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
  }, [enabled, reload, schemaVersion]);

  const saveItem = useCallback(async (id, payload) => {
    const body = {
      title: payload.title.trim(),
      code: payload.code.trim(),
      help_text: payload.help_text.trim(),
      unit_id: payload.unit_id ? parseInt(payload.unit_id, 10) : null,
      action_type_id: payload.action_type_id ? parseInt(payload.action_type_id, 10) : null,
      category_ids: (payload.category_ids || []).map((cid) => parseInt(cid, 10)),
    };
    if (id) {
      const res = await axios.put(`${PARAMETERS_URL}/${id}/`, body);
      return res.data;
    }
    const res = await axios.post(`${PARAMETERS_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await axios.delete(`${PARAMETERS_URL}/${id}/`);
  }, []);

  return {
    items,
    units,
    categories,
    actionTypes,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
  };
}
