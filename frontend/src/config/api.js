// Единая точка для задания базового URL API.
// Пустая строка = same-origin через nginx.
// Direct-режим (без nginx): http://<hostname>:8000 — см. docker-compose.direct.yml.
// Значения валидны на lifetime вкладки; смена IP без F5 не поддерживается — используйте getApiUrl().
import { getDirectBackendOrigin, isDirectMode } from './directMode';

export function getApiUrl() {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv !== undefined && fromEnv !== '') {
    return String(fromEnv).replace(/\/$/, '');
  }
  if (isDirectMode()) {
    return getDirectBackendOrigin();
  }
  return '';
}

/** Snapshot на момент импорта модуля (удобно для шаблонных строк). Предпочтительно getApiUrl(). */
export const API_URL = getApiUrl();
