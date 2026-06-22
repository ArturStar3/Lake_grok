/**
 * Копирует офлайн-ассеты из node_modules в public/ (Leaflet marker icons).
 * Запуск: node scripts/copy-vendor-assets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leafletSrc = path.join(root, "frontend/node_modules/leaflet/dist/images");
const leafletDst = path.join(root, "frontend/public/leaflet");

if (!fs.existsSync(leafletSrc)) {
  console.error("Leaflet not found. Run: cd frontend && npm ci");
  process.exit(1);
}

fs.mkdirSync(leafletDst, { recursive: true });

for (const file of fs.readdirSync(leafletSrc)) {
  fs.copyFileSync(path.join(leafletSrc, file), path.join(leafletDst, file));
}

console.log(`Copied Leaflet images → frontend/public/leaflet (${fs.readdirSync(leafletDst).length} files)`);
