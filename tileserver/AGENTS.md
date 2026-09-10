# TileServer and map-resource instructions

## Architecture

- `config.json` serves `data/map.mbtiles` as the `openmaptiles` source and exposes local styles, fonts, and sprites. Compose mounts this directory at `/data` in the `tileserver` service (`maptiler/tileserver-gl`) on container port 8080.
- Browsers normally reach it through Nginx `/tiles/`, which strips that prefix. Direct mode uses the browser hostname and the exposed TileServer host port. Do not put the Docker service name in styles or frontend-visible URLs.
- `styles/infolake-unified.json` is generated from `styles/borders-labels.json` plus all `styles/overlay-*.json` files by `scripts/build-unified-style.js`. The same build generates `../frontend/src/config/unifiedLayerMapping.json`.

## Map invariants

- Preserve offline operation: operational styles must use local `mbtiles://{openmaptiles}`, local glyphs, and local sprites. Do not replace them with Mapbox, OSM tile servers, CDNs, or other network services.
- Treat style IDs, frontend overlay IDs, source name `openmaptiles`, and source-layer names as contracts. Current styles depend on OpenMapTiles layers including `landcover`, `landuse`, `park`, `water`, `waterway`, `transportation`, `building`, `boundary`, `place`, `aeroway`, `aerodrome_label`, `housenumber`, `water_name`, `mountain_peak`, `poi`, and `transportation_name`.
- Edit source styles/scripts rather than hand-editing only the generated unified style. Regenerate from `frontend/` with `npm run build:map-style`, then review both generated files. The build stamps `generatedAt`, so avoid running it for unrelated work.
- Keep the configured `map.mbtiles` filename aligned with volume contents. Never commit, rewrite, or copy large `*.mbtiles` files unless explicitly requested.
- Retain local font ranges and sprite JSON/PNG pairs when changing labels or icons. Check source-layer availability and zoom ranges against the actual MBTiles before adding a layer.

## Scripts and verification

- `scripts/download-data.ps1`, `download-dem.py`, and equipment/data download helpers are online preparation tools, not offline runtime dependencies. Make that boundary explicit in new tooling.
- `scripts/apply-name-overrides.ps1` applies `data/name-overrides.json`; inspect its affected styles before running it.
- Validate changed JSON by parsing it, ensure every style registered in `config.json` exists, run `npm run build:map-style` when its inputs change, and verify the generated mapping IDs exist in the unified style.
- If TileServer is running, verify `/styles/infolake-unified/style.json` and `/data/openmaptiles.json` through the browser-facing mode being changed. Report missing local MBTiles rather than downloading replacements automatically.
