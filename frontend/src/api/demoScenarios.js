import { apiClient } from '../config/axios';

const BASE = '/demo-scenarios/';

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
