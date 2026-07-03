#!/usr/bin/env node
/**
 * Собирает infolake-unified.json из borders-labels + overlay-* стилей.
 * Генерирует маппинг frontend layer id → maplibre layer ids для переключения visibility.
 *
 * Usage: node scripts/build-unified-style.js
 */

const fs = require('fs');
const path = require('path');

const STYLES_DIR = path.join(__dirname, '..', 'styles');
const BASE_STYLE = 'borders-labels.json';
const OUTPUT_STYLE = path.join(STYLES_DIR, 'infolake-unified.json');
const OUTPUT_MAPPING = path.join(
  __dirname,
  '..',
  '..',
  'frontend',
  'src',
  'config',
  'unifiedLayerMapping.json',
);

/** Имя overlay-стиля (без .json) → id слоя во frontend (tiles.js) */
const OVERLAY_TO_FRONTEND_ID = {
  'overlay-water': 'water',
  'overlay-hydro-labels': 'hydroLabels',
  'overlay-railways': 'railways',
  'overlay-ferry': 'ferry',
  'overlay-road-labels': 'roadLabels',
  'overlay-aeroway': 'aeroway',
  'overlay-mountain-peaks': 'mountainPeaks',
  'overlay-districts': 'districts',
  'overlay-house-numbers': 'houseNumbers',
  'overlay-poi-infrastructure': 'poiInfrastructure',
  'overlay-poi-transport': 'poiTransport',
  'overlay-poi-services': 'poiServices',
};

/** Слои, видимые по умолчанию (совпадает с defaultOn в tiles.js) */
const DEFAULT_VISIBLE_FRONTEND_IDS = new Set(['railways']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listOverlayStyles() {
  return fs
    .readdirSync(STYLES_DIR)
    .filter((name) => name.startsWith('overlay-') && name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

function prefixLayerId(overlayKey, layerId) {
  return `ovl-${overlayKey}-${layerId}`;
}

function mergeOverlayLayers(overlayKey, overlayStyle, layerMapping, frontendId) {
  const defaultVisible = DEFAULT_VISIBLE_FRONTEND_IDS.has(frontendId);
  const merged = [];

  overlayStyle.layers.forEach((layer) => {
    if (layer.type === 'background') return;

    const newId = prefixLayerId(overlayKey, layer.id);
    const next = {
      ...layer,
      id: newId,
      layout: {
        ...(layer.layout || {}),
        visibility: defaultVisible ? 'visible' : 'none',
      },
      metadata: {
        ...(layer.metadata || {}),
        'infolake:overlay': overlayKey,
        'infolake:frontendLayerId': frontendId,
      },
    };

    merged.push(next);
    if (!layerMapping[frontendId]) {
      layerMapping[frontendId] = [];
    }
    layerMapping[frontendId].push(newId);
  });

  return merged;
}

function build() {
  const basePath = path.join(STYLES_DIR, BASE_STYLE);
  const base = readJson(basePath);
  const layerMapping = {};
  const overlayKeys = listOverlayStyles();

  const unified = {
    version: base.version,
    name: 'InfoLake Unified',
    metadata: {
      ...base.metadata,
      'openmaptiles:version': base.metadata?.['openmaptiles:version'] || '3.x',
      'infolake:unified': true,
      'infolake:layerMapping': layerMapping,
      'infolake:generatedAt': new Date().toISOString(),
      'infolake:sourceStyles': [BASE_STYLE, ...overlayKeys.map((k) => `${k}.json`)],
    },
    sources: base.sources,
    glyphs: base.glyphs,
    sprite: 'basic/sprite',
    layers: [...base.layers],
  };

  overlayKeys.forEach((overlayKey) => {
    const frontendId = OVERLAY_TO_FRONTEND_ID[overlayKey];
    if (!frontendId) {
      console.warn(`Пропуск ${overlayKey}: нет маппинга на frontend id`);
      return;
    }

    const overlayPath = path.join(STYLES_DIR, `${overlayKey}.json`);
    const overlayStyle = readJson(overlayPath);
    const overlayLayers = mergeOverlayLayers(
      overlayKey,
      overlayStyle,
      layerMapping,
      frontendId,
    );
    unified.layers.push(...overlayLayers);
    console.log(`+ ${overlayKey}: ${overlayLayers.length} слоёв → ${frontendId}`);
  });

  fs.writeFileSync(OUTPUT_STYLE, `${JSON.stringify(unified, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    OUTPUT_MAPPING,
    `${JSON.stringify({ layerMapping, defaultVisible: [...DEFAULT_VISIBLE_FRONTEND_IDS] }, null, 2)}\n`,
    'utf8',
  );

  console.log(`\nЗаписано: ${OUTPUT_STYLE}`);
  console.log(`Маппинг: ${OUTPUT_MAPPING}`);
  console.log(`Всего слоёв: ${unified.layers.length}`);
}

build();
