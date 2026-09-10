# Frontend instructions

## Stack and organization

- This is a JavaScript/JSX React SPA built by Vite; do not convert files to TypeScript. Routing uses React Router, requests use Axios, mapping combines React-Leaflet/Leaflet with MapLibre GL, and state is handled with component hooks plus `AuthContext` and `ThemeContext` rather than a separate store.
- Routes and providers start in `src/App.jsx`. Feature UI is under `src/components/`, reusable behavior under `src/hooks/` and `src/utils/`, API wrappers under `src/api/`, and deployment/runtime URL logic under `src/config/` and `public/runtime-config.js`.
- Keep component CSS beside its component where that pattern exists and preserve the repository's existing JSX/style conventions; avoid mass formatting.

## API and authentication

- Use `src/config/axios.js` and its `apiClient`/auth interceptors for API work. Base API requests at `/api/v1` through `getApiUrl()` so same-origin, direct dev, and direct production modes all continue to work.
- JWT access, refresh, and user state are stored in `sessionStorage`. Preserve the single-refresh/retry behavior and the public-auth endpoint exceptions when changing authentication.
- Keep route protection consistent with `ProtectedRoute` and backend module permissions. UI hiding is not authorization; backend permission behavior remains authoritative.
- Resolve media URLs through the existing `src/utils/mediaUrl.js` behavior rather than embedding a backend host.

## Mapping and runtime modes

- `src/config/directMode.js`, `api.js`, and `tiles.js` are the URL source of truth. Never expose `backend:8000` or `tileserver:8080` to browser code and do not hard-code a developer LAN address.
- The default map is the generated `infolake-unified` vector style rendered by MapLibre inside Leaflet. `VITE_MAP_VECTOR=false` selects the legacy raster fallback. Preserve both unless the task explicitly removes one.
- Overlay toggles depend on exact MapLibre IDs in `src/config/unifiedLayerMapping.json`. If source overlay styles change, regenerate through `npm run build:map-style` and review the generated style and mapping together.
- Offline runtime assets must stay local. Attribution links are metadata, but code, tiles, glyphs, sprites, fonts, and images needed to render the app may not depend on an external host.

## Verification

- From `frontend/`, run `npm run lint` for JavaScript/JSX changes and `npm run build` for changes affecting the bundle or runtime configuration.
- There is no `npm test` script or frontend test framework. Do not claim frontend tests ran; add a new testing tool only when explicitly in scope.
- For routing or direct-mode changes, verify both same-origin Nginx paths and direct-mode origin construction. For map changes, also verify vector style loading, overlay toggles, and the raster fallback as applicable.
- Production images use Node 20 for builds. Development uses `npm run dev`; production Nginx uses `Dockerfile.server`, while direct production uses `Dockerfile.direct` and generates `runtime-config.js` at container start.
