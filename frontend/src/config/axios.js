import axios from 'axios';
import { API_URL } from './api';

const ACCESS_KEY = 'infolake_access_token';
const REFRESH_KEY = 'infolake_refresh_token';
const USER_KEY = 'infolake_user';
const REQUEST_TIMEOUT_MS = 15000;

/** Клиент без interceptors — для refresh, чтобы не было deadlock при 401 */
const plainClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
});

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
});

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuth({ access, refresh, user }) {
  if (access) sessionStorage.setItem(ACCESS_KEY, access);
  if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function attachAuthHeader(config) {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

apiClient.interceptors.request.use(attachAuthHeader);
axios.interceptors.request.use(attachAuthHeader);

let refreshPromise = null;

const AUTH_NO_RETRY_PATHS = ['/auth/refresh/', '/auth/login/', '/auth/register/'];

function shouldSkipAuthRetry(config) {
  const url = config?.url || '';
  return AUTH_NO_RETRY_PATHS.some((path) => url.includes(path));
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const { data } = await plainClient.post('/auth/refresh/', { refresh });
    if (data?.access) {
      sessionStorage.setItem(ACCESS_KEY, data.access);
      if (data.refresh) sessionStorage.setItem(REFRESH_KEY, data.refresh);
      return data.access;
    }
  } catch {
    // invalid or expired refresh token
  }
  return null;
}

function setupResponseInterceptor(onUnauthorized) {
  const handler = async (error) => {
    const original = error.config;
    if (
      error.response?.status !== 401
      || original?._retry
      || shouldSkipAuthRetry(original)
    ) {
      return Promise.reject(error);
    }
    original._retry = true;
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (!newToken) {
      clearAuth();
      onUnauthorized?.();
      return Promise.reject(error);
    }
    original.headers = original.headers || {};
    original.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(original);
  };

  apiClient.interceptors.response.use((r) => r, handler);
}

export function initAxiosAuth(onUnauthorized) {
  setupResponseInterceptor(onUnauthorized);
}

export { API_URL };
