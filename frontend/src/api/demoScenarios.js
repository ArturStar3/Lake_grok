import { apiClient } from '../config/axios';

const BASE = '/demo-scenarios/';

export async function importDemoScannerDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post(`${BASE}import-scanner-document/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listDemoScenarios() {
  const { data } = await apiClient.get(BASE);
  return Array.isArray(data) ? data : [];
}

export async function getDemoScenario(id) {
  const { data } = await apiClient.get(`${BASE}${id}/`);
  return data;
}

export async function createDemoScenario(payload) {
  const { data } = await apiClient.post(BASE, payload);
  return data;
}

export async function updateDemoScenario(id, payload) {
  const { data } = await apiClient.patch(`${BASE}${id}/`, payload);
  return data;
}

export async function deleteDemoScenario(id) {
  await apiClient.delete(`${BASE}${id}/`);
}

/** Загрузка картинки для блока художественного режима. */
export async function uploadDemoTableauMedia(file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await apiClient.post('/demo-tableau-media/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Загрузка видео для слота мультиэкрана. */
export async function uploadDemoMosaicMedia(file) {
  const form = new FormData();
  form.append('video', file);
  const { data } = await apiClient.post('/demo-mosaic-media/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  });
  return data;
}
