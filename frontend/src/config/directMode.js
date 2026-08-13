/**
 * Режим без nginx: браузер ходит на frontend:5173, API:8000, tiles:8080.
 *
 * Включение:
 * 1) window.__INFOLAKE_CONFIG__.directMode === true (runtime-config.js от entrypoint direct-prod)
 * 2) VITE_DIRECT_MODE=true (сборка / Docker Vite)
 * 3) только в DEV: порт UI 5173/4173 (локальный npm run dev / vite preview)
 */

const DIRECT_FRONTEND_PORTS = new Set(
  String(import.meta.env.VITE_DIRECT_FRONTEND_PORTS || '5173,4173')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
);

function getRuntimeConfig() {
  if (typeof window === 'undefined') return {};
  return window.__INFOLAKE_CONFIG__ && typeof window.__INFOLAKE_CONFIG__ === 'object'
    ? window.__INFOLAKE_CONFIG__
    : {};
}

function getWindowLocation() {
  if (typeof window === 'undefined' || !window.location) {
    return { protocol: 'http:', hostname: 'localhost', port: '' };
  }
  return window.location;
}

export function isDirectMode() {
  const runtime = getRuntimeConfig();
  if (runtime.directMode === true) return true;
  if (import.meta.env.VITE_DIRECT_MODE === 'true') return true;
  // Эвристика по порту — только локальная разработка (не production-бандл).
  if (import.meta.env.DEV) {
    const { port } = getWindowLocation();
    return DIRECT_FRONTEND_PORTS.has(port);
  }
  return false;
}

function resolveServicePort(runtimeKey, envKey, fallback) {
  const runtime = getRuntimeConfig();
  const fromRuntime = runtime[runtimeKey];
  if (fromRuntime !== undefined && fromRuntime !== null && String(fromRuntime).trim() !== '') {
    return String(fromRuntime).trim();
  }
  const fromEnv = import.meta.env[envKey];
  if (fromEnv !== undefined && fromEnv !== '') {
    return String(fromEnv);
  }
  return fallback;
}

export function getDirectBackendOrigin() {
  const { protocol, hostname } = getWindowLocation();
  const port = resolveServicePort('backendPort', 'VITE_BACKEND_PORT', '8000');
  return `${protocol}//${hostname}:${port}`;
}

export function getDirectTileserverOrigin() {
  const { protocol, hostname } = getWindowLocation();
  const port = resolveServicePort('tileserverPort', 'VITE_TILESERVER_PORT', '8080');
  return `${protocol}//${hostname}:${port}`;
}
