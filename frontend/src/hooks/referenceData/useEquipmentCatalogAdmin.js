import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../config/axios';
import axios from 'axios';

const EQUIPMENT_URL = `/equipment`;
const EQUIPMENT_IMAGES_URL = `/equipment-images/`;
const CATEGORIES_URL = `/equipment-categories`;
const PARAMETERS_URL = `/equipment-parameters`;
const COUNTRIES_URL = `/countries/`;

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

export function useEquipmentCatalogAdmin(enabled, schemaVersion = 0) {
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
        apiClient.get(EQUIPMENT_URL, { signal }),
        apiClient.get(CATEGORIES_URL, { signal }),
        apiClient.get(PARAMETERS_URL, { signal }),
        apiClient.get(COUNTRIES_URL, { signal }),
      ]);
      if (seq !== loadSeqRef.current) return;
      setItems(Array.isArray(equipmentRes.data) ? equipmentRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setParameters(Array.isArray(parametersRes.data) ? parametersRes.data : []);
      setCountries(Array.isArray(countriesRes.data) ? countriesRes.data : []);
      return Array.isArray(equipmentRes.data) ? equipmentRes.data : [];
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== loadSeqRef.current) return;
      console.error('Ошибка загрузки каталога техники', err);
      setError('Не удалось загрузить каталог техники');
      return [];
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
      const res = await apiClient.put(`${EQUIPMENT_URL}/${id}/`, body);
      return res.data;
    }
    const res = await apiClient.post(`${EQUIPMENT_URL}/`, body);
    return res.data;
  }, []);

  const deleteItem = useCallback(async (id) => {
    await apiClient.delete(`${EQUIPMENT_URL}/${id}/`);
  }, []);

  const uploadImages = useCallback(async (equipmentId, files) => {
    const uploaded = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('equipment', equipmentId);
      formData.append('title', file.name);
      formData.append('image', file);
      const res = await apiClient.post(EQUIPMENT_IMAGES_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      uploaded.push(res.data);
    }
    return uploaded;
  }, []);

  const deleteImage = useCallback(async (imageId) => {
    await apiClient.delete(`${EQUIPMENT_IMAGES_URL}${imageId}/`);
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
    uploadImages,
    deleteImage,
  };
}
