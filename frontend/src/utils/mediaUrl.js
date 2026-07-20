import { API_URL } from '../config/api';

/** Абсолютный URL для media с API (относительные пути с Vite иначе бьются в :5173). */
export function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const base = API_URL.replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}
