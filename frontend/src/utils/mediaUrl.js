import { API_URL } from '../config/api';

function mediaOrigin() {
  if (API_URL) return API_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

function rewriteMediaOrigin(url) {
  const origin = mediaOrigin();
  if (!origin) return url;
  try {
    const parsed = new URL(url, origin);
    if (parsed.pathname.startsWith('/media/') || parsed.pathname.startsWith('/static/')) {
      return `${origin}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // fall through
  }
  return url;
}

/**
 * Абсолютный URL для media (относительные пути с Vite иначе бьются в :5173).
 * Абсолютные /media/ URL с устаревшим origin (localhost:8000, другой IP) → текущий origin.
 */
export function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('blob:')) return url;

  if (url.startsWith('//')) {
    return rewriteMediaOrigin(`${window.location.protocol}${url}`);
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return rewriteMediaOrigin(url);
  }

  const base = (API_URL || '').replace(/\/$/, '');
  if (url.startsWith('/')) {
    return base ? `${base}${url}` : url;
  }
  return base ? `${base}/${url}` : `/${url}`;
}

/** Превью: локальный File или URL с сервера.
 * Если передан File — создаётся ObjectURL БЕЗ revoke.
 * Для React UI предпочитайте useObjectUrl(file) + resolveMediaUrl(url).
 */
export function resolveImagePreviewUrl(url, file) {
  if (file instanceof File) {
    return URL.createObjectURL(file);
  }
  return resolveMediaUrl(url);
}
