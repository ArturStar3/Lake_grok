import { API_URL } from '../config/api';

function rewriteMediaOrigin(url) {
  if (typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith('/media/') || parsed.pathname.startsWith('/static/')) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`;
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

/** Превью: локальный File или URL с сервера. */
export function resolveImagePreviewUrl(url, file) {
  if (file instanceof File) {
    return URL.createObjectURL(file);
  }
  return resolveMediaUrl(url);
}
