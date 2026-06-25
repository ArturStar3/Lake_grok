import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';

const EQUIPMENT_URL = `${API_URL}/api/v1/equipment`;
const CATEGORIES_URL = `${API_URL}/api/v1/equipment-categories`;
const PARAMETERS_URL = `${API_URL}/api/v1/equipment-parameters`;
const COUNTRIES_URL = `${API_URL}/api/v1/countries`;

export const EMPTY_EQUIPMENT_FORM = {
  title: '',
  designation: '',
  category_id: '',
  origin_country_id: '',
  description: '',
  parameter_values: [],
};

export function equipmentToForm(item) {
  if (!item) return { ...EMPTY_EQUIPMENT_FORM, parameter_values: [] };
  return {
    title: item.title || '',
    designation: item.designation || '',
    category_id: item.category?.id || '',
    origin_country_id: item.origin_country?.id || '',
    description: item.description || '',
    parameter_values: (item.parameter_values || []).map((pv) => ({
      parameter_id: pv.parameter?.id || pv.parameter_id || '',
      value: pv.value ?? '',
    })),
  };
}

export function useEquipmentCatalogAdmin(enabled) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async (signal) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const [equipmentRes, categoriesRes, parametersRes, countriesRes] = await Promise.all([
        axios.get(EQUIPMENT_URL, { signal }),
        axios.get(CATEGORIES_URL, { signal }),
        axios.get(PARAMETERS_URL, { signal }),
        axios.get(COUNTRIES_URL, { signal }),
      ]);
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(equipmentRes.data) ? equipmentRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setParameters(Array.isArray(parametersRes.data) ? parametersRes.data : []);
      setCountries(Array.isArray(countriesRes.data) ? countriesRes.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки каталога техники', err);
      setError('Не удалось загрузить каталог техники');
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
      designation: payload.designation.trim(),
      description: payload.description.trim(),
      category_id: payload.category_id || null,
      origin_country_id: payload.origin_country_id || null,
      parameter_values: (payload.parameter_values || [])
        .filter((row) => row.parameter_id && row.value !== '' && !Number.isNaN(parseFloat(row.value)))
        .map((row) => ({
          parameter_id: parseInt(row.parameter_id, 10),
          value: parseFloat(row.value),
        })),
    };
    if (id) {
      const res = await axios.put(`${EQUIPMENT_URL}/${id}/`, body);
      return res.data;
    }
    const res = await axios.post(`${EQUIPMENT_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await axios.delete(`${EQUIPMENT_URL}/${id}/`);
  }, []);

  return {
    items,
    categories,
    parameters,
    countries,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
  };
}
