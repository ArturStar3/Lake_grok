#!/usr/bin/env node
/**
 * Генерация PNG-тайлов для всего мира (стиль borders-labels).
 * Результат: output/world-tiles/{z}/{x}/{y}.png — совместимо с Leaflet XYZ.
 *
 * Требования:
 *   - docker compose up -d
 *   - data/map.mbtiles (planet или крупный регион)
 *   - Node.js 18+
 *
 * Примеры:
 *   node scripts/generate-world-tiles.js --dry-run
 *   node scripts/generate-world-tiles.js --max-zoom 8 --yes
 *   node scripts/generate-world-tiles.js --max-zoom 10 --concurrency 8 --write-leaflet-demo
 */

const fs = require('fs');
const path = require('path');

const WORLD_BOUNDS = [-180, -85.05112878, 180, 85.05112878];
const WEB_MERCATOR_MAX_LAT = 85.05112878;

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://localhost:8080',
    style: 'borders-labels',
    minZoom: 0,
    maxZoom: 8,
    output: path.join(__dirname, '..', 'output', 'world-tiles'),
    tileSize: 256,
    concurrency: 4,
    retries: 3,
    dryRun: false,
    yes: false,
    writeLeafletDemo: false,
    minTileBytes: 100,
  };

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    switch (key) {
      case '--base-url': args.baseUrl = val.replace(/\/$/, ''); i++; break;
      case '--style': args.style = val; i++; break;
      case '--min-zoom': args.minZoom = Number(val); i++; break;
      case '--max-zoom': args.maxZoom = Number(val); i++; break;
      case '--output': args.output = val; i++; break;
      case '--tile-size': args.tileSize = Number(val); i++; break;
      case '--concurrency': args.concurrency = Number(val); i++; break;
      case '--retries': args.retries = Number(val); i++; break;
      case '--dry-run': args.dryRun = true; break;
      case '--yes': args.yes = true; break;
      case '--write-leaflet-demo': args.writeLeafletDemo = true; break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Неизвестный параметр: ${key}`);
        printHelp();
        process.exit(1);
    }
  }

  if (args.minZoom < 0 || args.maxZoom > 14 || args.minZoom > args.maxZoom) {
    console.error('Ошибка: zoom должен быть в диапазоне 0–14, min-zoom <= max-zoom');
    process.exit(1);
  }

  return args;
}

function printHelp() {
  console.log(`
Генерация PNG-тайлов всего мира для Leaflet (стиль borders-labels).

Usage: node scripts/generate-world-tiles.js [options]

Options:
  --min-zoom N          Минимальный zoom (default: 0)
  --max-zoom N          Максимальный zoom (default: 8)
  --style NAME          Стиль TileServer (default: borders-labels)
  --base-url URL        TileServer (default: http://localhost:8080)
  --output DIR          Папка вывода (default: output/world-tiles)
  --tile-size 256|512   Размер тайла (default: 256)
  --concurrency N       Параллельных запросов (default: 4)
  --retries N           Повторов при ошибке (default: 3)
  --dry-run             Только оценка объёма, без скачивания
  --yes                 Не спрашивать подтверждение
  --write-leaflet-demo  Создать leaflet-demo.html в папке вывода

Оценка количества тайлов (весь мир, zoom 0–N):
  zoom 0–6  →    5 461
  zoom 0–7  →   21 845
  zoom 0–8  →   87 381   ← default
  zoom 0–9  →  349 525
  zoom 0–10 → 1 398 101
  zoom 0–12 → ~22 млн (дни/недели рендера, сотни ГБ)

Примеры:
  node scripts/generate-world-tiles.js --dry-run
  node scripts/generate-world-tiles.js --max-zoom 8 --yes
  node scripts/generate-world-tiles.js --max-zoom 10 --concurrency 8 --write-leaflet-demo
`);
}

function countTiles(minZoom, maxZoom) {
  let total = 0;
  const perZoom = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const n = 4 ** z;
    perZoom.push({ z, count: n });
    total += n;
  }
  return { total, perZoom };
}

function formatNumber(n) {
  return n.toLocaleString('ru-RU');
}

function estimateSizeBytes(tileCount, tileSize) {
  const avgBytes = tileSize === 512 ? 80_000 : 25_000;
  return tileCount * avgBytes;
}

function formatSize(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(1)} ГБ`;
  return `${(bytes / 1024 ** 4).toFixed(1)} ТБ`;
}

function tileUrl(baseUrl, style, tileSize, z, x, y) {
  if (tileSize === 512) {
    return `${baseUrl}/styles/${style}/512/${z}/${x}/${y}.png`;
  }
  return `${baseUrl}/styles/${style}/${z}/${x}/${y}.png`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServer(baseUrl, style) {
  const styleUrl = `${baseUrl}/styles/${style}/style.json`;
  const res = await fetch(styleUrl);
  if (!res.ok) {
    throw new Error(
      `TileServer недоступен или стиль "${style}" не найден (${res.status}).\n` +
      `Запустите: docker compose up -d\n` +
      `Проверьте: ${baseUrl}`
    );
  }
}

async function fetchTile(url, retries) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

async function renderTile(url, filePath, minTileBytes, retries) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(filePath)) return 'skip';

  const buf = await fetchTile(url, retries);
  if (buf.length < minTileBytes) {
    throw new Error(`подозрительно малый файл (${buf.length} байт)`);
  }

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
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

function buildJobs(minZoom, maxZoom) {
  const jobs = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const n = 2 ** z;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        jobs.push({ z, x, y });
      }
    }
  }
  return jobs;
}

function writeMetadata(output, args) {
  const meta = {
    name: 'World Borders & Labels',
    description: 'PNG-тайлы всего мира: границы государств, названия стран и населённых пунктов',
    version: '1.0.0',
    scheme: 'xyz',
    format: 'png',
    tileSize: args.tileSize,
    minzoom: args.minZoom,
    maxzoom: args.maxZoom,
    bounds: WORLD_BOUNDS,
    center: [0, 20, 2],
    attribution: '© OpenMapTiles © OpenStreetMap contributors',
    tileUrl: '{z}/{x}/{y}.png',
    style: args.style,
    generatedAt: new Date().toISOString(),
    leaflet: {
      url: '{z}/{x}/{y}.png',
      options: {
        minZoom: args.minZoom,
        maxZoom: args.maxZoom,
        maxNativeZoom: args.maxZoom,
        noWrap: true,
        attribution: '© OpenMapTiles © OpenStreetMap contributors',
      },
    },
  };

  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, 'tileset.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );
}

function writeLeafletDemo(output, args) {
  const demoPath = path.join(output, 'leaflet-demo.html');
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>World Tiles — Leaflet Demo</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', {
      minZoom: ${args.minZoom},
      maxZoom: ${args.maxZoom},
      worldCopyJump: false
    }).setView([20, 0], 2);

    L.tileLayer('{z}/{x}/{y}.png', {
      minZoom: ${args.minZoom},
      maxZoom: ${args.maxZoom},
      maxNativeZoom: ${args.maxZoom},
      noWrap: true,
      attribution: '© OpenMapTiles © OpenStreetMap contributors'
    }).addTo(map);
  </script>
</body>
</html>
`;
  fs.writeFileSync(demoPath, html, 'utf8');
  return demoPath;
}

async function confirmProceed(total, estBytes) {
  if (process.stdin.isTTY) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question(
        `Будет сгенерировано ${formatNumber(total)} тайлов (~${formatSize(estBytes)}). Продолжить? [y/N] `,
        resolve
      );
    });
    rl.close();
    return /^y(es)?$/i.test(answer.trim());
  }
  console.log('Неинтерактивный режим: добавьте --yes для запуска.');
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const { total, perZoom } = countTiles(args.minZoom, args.maxZoom);
  const estBytes = estimateSizeBytes(total, args.tileSize);

  console.log('=== Генерация мировых PNG-тайлов ===');
  console.log(`Стиль:      ${args.style}`);
  console.log(`TileServer: ${args.baseUrl}`);
  console.log(`Zoom:       ${args.minZoom}–${args.maxZoom}`);
  console.log(`Тайлов:     ${formatNumber(total)}`);
  console.log(`Оценка:     ~${formatSize(estBytes)}`);
  console.log(`Вывод:      ${args.output}`);
  console.log('');
  console.log('Тайлов по уровням:');
  for (const { z, count } of perZoom) {
    console.log(`  z${z}: ${formatNumber(count)}`);
  }
  console.log('');

  if (args.dryRun) {
    console.log('Dry-run: скачивание не выполнялось.');
    return;
  }

  if (total > 100_000 && !args.yes) {
    const ok = await confirmProceed(total, estBytes);
    if (!ok) {
      console.log('Отменено.');
      process.exit(0);
    }
  }

  await checkServer(args.baseUrl, args.style);

  const jobs = buildJobs(args.minZoom, args.maxZoom);
  const startedAt = Date.now();

  let done = 0;
  let skipped = 0;
  let errors = 0;

  await runPool(
    jobs,
    async ({ z, x, y }) => {
      const url = tileUrl(args.baseUrl, args.style, args.tileSize, z, x, y);
      const filePath = path.join(args.output, String(z), String(x), `${y}.png`);
      try {
        const status = await renderTile(url, filePath, args.minTileBytes, args.retries);
        if (status === 'skip') skipped++;
        else done++;

        const processed = done + skipped + errors;
        if (processed % 100 === 0 || processed === jobs.length) {
          const elapsed = (Date.now() - startedAt) / 1000;
          const rate = processed / Math.max(elapsed, 0.1);
          const remaining = (jobs.length - processed) / rate;
          const eta = remaining > 60
            ? `${Math.ceil(remaining / 60)} мин`
            : `${Math.ceil(remaining)} сек`;
          process.stdout.write(
            `\r${formatNumber(processed)}/${formatNumber(jobs.length)} ` +
            `(новых: ${formatNumber(done)}, пропуск: ${formatNumber(skipped)}, ` +
            `ошибок: ${errors}, ~${eta})`
          );
        }
      } catch (err) {
        errors++;
        console.error(`\nОшибка ${z}/${x}/${y}: ${err.message}`);
      }
    },
    args.concurrency
  );

  writeMetadata(args.output, args);

  console.log(`\n\nГотово: ${formatNumber(done)} новых, ${formatNumber(skipped)} пропущено, ${errors} ошибок`);
  console.log(`Метаданные: ${path.join(args.output, 'tileset.json')}`);

  if (args.writeLeafletDemo) {
    const demo = writeLeafletDemo(args.output, args);
    console.log(`Leaflet demo: ${demo}`);
  }

  console.log('\nПодключение в Leaflet:');
  console.log(`
L.tileLayer('/path/to/world-tiles/{z}/{x}/{y}.png', {
  minZoom: ${args.minZoom},
  maxZoom: ${args.maxZoom},
  maxNativeZoom: ${args.maxZoom},
  noWrap: true,
  attribution: '© OpenMapTiles © OpenStreetMap contributors'
}).addTo(map);
`);

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});