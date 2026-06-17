#!/usr/bin/env node
/**
 * Пакетная генерация PNG-тайлов из запущенного TileServer GL.
 *
 * Требования:
 *   - docker compose up -d (сервер на http://localhost:8080)
 *   - data/map.mbtiles и стили borders-labels настроены
 *
 * Примеры:
 *   node scripts/pre-render-png.js --bounds "71.2,40.8,87.4,55.6" --min-zoom 1 --max-zoom 8
 *   node scripts/pre-render-png.js --bounds "71.2,40.8,87.4,55.6" --min-zoom 5 --max-zoom 10 --style borders-labels
 *
 * Результат: output/{z}/{x}/{y}.png  (стандарт XYZ)
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://localhost:8080',
    style: 'borders-labels',
    minZoom: 1,
    maxZoom: 6,
    bounds: null,
    output: path.join(__dirname, '..', 'output', 'png-tiles'),
    tileSize: 256,
    concurrency: 4,
  };

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    switch (key) {
      case '--base-url': args.baseUrl = val.replace(/\/$/, ''); i++; break;
      case '--style': args.style = val; i++; break;
      case '--bounds': args.bounds = val.split(',').map(Number); i++; break;
      case '--min-zoom': args.minZoom = Number(val); i++; break;
      case '--max-zoom': args.maxZoom = Number(val); i++; break;
      case '--output': args.output = val; i++; break;
      case '--tile-size': args.tileSize = Number(val); i++; break;
      case '--concurrency': args.concurrency = Number(val); i++; break;
      case '--help':
        console.log(`
Usage: node scripts/pre-render-png.js [options]

Options:
  --bounds "minLng,minLat,maxLng,maxLat"   Область (обязательно)
  --min-zoom N                             Мин. zoom (default: 1)
  --max-zoom N                             Макс. zoom (default: 6)
  --style NAME                             Стиль (default: borders-labels)
  --base-url URL                           TileServer (default: http://localhost:8080)
  --output DIR                             Папка вывода (default: output/png-tiles)
  --tile-size 256|512                      Размер тайла (default: 256)
  --concurrency N                          Параллельных запросов (default: 4)

Пример (Казахстан, zoom 1-8):
  node scripts/pre-render-png.js --bounds "71.2,40.8,87.4,55.6" --min-zoom 1 --max-zoom 8
`);
        process.exit(0);
    }
  }

  if (!args.bounds || args.bounds.length !== 4 || args.bounds.some(Number.isNaN)) {
    console.error('Ошибка: укажите --bounds "minLng,minLat,maxLng,maxLat"');
    process.exit(1);
  }

  return args;
}

function lngLatToTile(lng, lat, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function getTileRange(bounds, zoom) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const topLeft = lngLatToTile(minLng, maxLat, zoom);
  const bottomRight = lngLatToTile(maxLng, minLat, zoom);
  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, bottomRight.y),
  };
}

function tileUrl(baseUrl, style, tileSize, z, x, y) {
  if (tileSize === 512) {
    return `${baseUrl}/styles/${style}/512/${z}/${x}/${y}.png`;
  }
  return `${baseUrl}/styles/${style}/${z}/${x}/${y}.png`;
}

async function renderTile(url, filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(filePath)) return 'skip';

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return 'ok';
}

async function runPool(items, worker, concurrency) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
}

async function main() {
  const args = parseArgs(process.argv);
  const jobs = [];

  for (let z = args.minZoom; z <= args.maxZoom; z++) {
    const range = getTileRange(args.bounds, z);
    for (let x = range.minX; x <= range.maxX; x++) {
      for (let y = range.minY; y <= range.maxY; y++) {
        jobs.push({ z, x, y });
      }
    }
  }

  console.log(`Стиль: ${args.style}`);
  console.log(`Область: ${args.bounds.join(', ')}`);
  console.log(`Zoom: ${args.minZoom}-${args.maxZoom}`);
  console.log(`Тайлов к генерации: ${jobs.length}`);
  console.log(`Вывод: ${args.output}`);

  let done = 0;
  let skipped = 0;
  let errors = 0;

  await runPool(
    jobs,
    async ({ z, x, y }) => {
      const url = tileUrl(args.baseUrl, args.style, args.tileSize, z, x, y);
      const filePath = path.join(args.output, String(z), String(x), `${y}.png`);
      try {
        const status = await renderTile(url, filePath);
        if (status === 'skip') skipped++;
        else done++;
        if ((done + skipped + errors) % 50 === 0) {
          process.stdout.write(`\r${done + skipped + errors}/${jobs.length}`);
        }
      } catch (err) {
        errors++;
        console.error(`\nОшибка ${z}/${x}/${y}: ${err.message}`);
      }
    },
    args.concurrency
  );

  console.log(`\nГотово: ${done} новых, ${skipped} пропущено, ${errors} ошибок`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});