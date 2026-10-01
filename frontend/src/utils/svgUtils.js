/**
 * Получает размеры (width, height) из viewBox SVG-строки
 * @param {string} svgString - SVG код
 * @returns {{width: number, height: number} | null}
 */
export function getViewBoxSize(svgString) {
  if (!svgString) return null;
  const match = svgString.match(/viewBox\s*=\s*['"]([\d.\s]+)['"]/i);
  if (!match) return null;
  const parts = match[1].trim().split(/\s+/);
  if (parts.length !== 4) return null;
  const width = parseFloat(parts[2]);
  const height = parseFloat(parts[3]);
  if (isNaN(width) || isNaN(height)) return null;
  return { width, height };
}
/**
 * Утилиты для работы с SVG
 */

import { buildMarkerPaletteStyle, markerPaletteCacheKey } from './markerPalette';
import { parseSafeSvg } from './safeSvg';

const enrichSvgCache = new Map();
const ENRICH_SVG_CACHE_MAX = 2000;
const ENRICH_SVG_CACHE_MAX_BYTES = 32 * 1024 * 1024;
let enrichSvgCacheBytes = 0;

function enrichSvgCacheKey(rawSvg, width, height, markerId, paletteKey) {
  return `${markerId}|${paletteKey}|${width}|${height}|${rawSvg}`;
}

/** Сброс при смене набора объектов на карте. */
export function clearEnrichSvgCache() {
  enrichSvgCache.clear();
  enrichSvgCacheBytes = 0;
}

/**
 * Обогащает SVG: уникальные id в defs, цветовые классы, размеры.
 * Все id переименовываются с суффиксом markerId — иначе url(#id) в inline-SVG
 * разрешается по всему HTML-документу и маркеры с order>6 (radialGradient, clipPath)
 * «крадут» градиенты друг у друга.
 */
export const enrichSvg = (rawSvg, w, h, markerId, palette) => {
  if (!rawSvg) {
    return "";
  }

  const width = Number(typeof w === 'string' ? w.replace(/px$/i, '') : w);
  const height = Number(typeof h === 'string' ? h.replace(/px$/i, '') : h);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return '';
  const suffix = String(markerId ?? 'marker');
  const paletteKey = markerPaletteCacheKey(palette);

  const cacheKey = enrichSvgCacheKey(rawSvg, width, height, suffix, paletteKey);
  if (enrichSvgCache.has(cacheKey)) {
    return enrichSvgCache.get(cacheKey);
  }

  try {
    const doc = parseSafeSvg(rawSvg);

    if (!doc) {
      console.warn(`enrichSvg: DOMParser error for markerId=${markerId}`);
      return "";
    }

    const idMap = new Map();
    doc.querySelectorAll('[id]').forEach((el) => {
      const oldId = el.getAttribute('id');
      if (!oldId) return;
      if (!idMap.has(oldId)) idMap.set(oldId, `${oldId}-${suffix}`);
      el.setAttribute('id', idMap.get(oldId));
    });

    // Mutate parsed attributes; serialization escapes IDs instead of interpolating HTML.
    doc.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        let value = attr.value.replace(/url\s*\(\s*['"]?#([\w.-]+)['"]?\s*\)/gi,
          (match, id) => idMap.has(id) ? `url(#${idMap.get(id)})` : match);
        if (attr.localName === 'href' && value.startsWith('#') && idMap.has(value.slice(1))) {
          value = `#${idMap.get(value.slice(1))}`;
        }
        attr.value = value;
      });
    });

    const svgEl = doc.querySelector('svg');
    if (svgEl) {
      svgEl.classList.forEach((className) => {
        if (className.startsWith('icon__')) {
          svgEl.classList.remove(className);
        }
      });
      svgEl.classList.add('marker-themed');
      svgEl.setAttribute('width', String(width));
      svgEl.setAttribute('height', String(height));
    }

    const result = new XMLSerializer().serializeToString(doc);

    const entryBytes = 2 * (cacheKey.length + result.length);
    if (enrichSvgCache.size >= ENRICH_SVG_CACHE_MAX || enrichSvgCacheBytes + entryBytes > ENRICH_SVG_CACHE_MAX_BYTES) {
      clearEnrichSvgCache();
    }
    if (entryBytes <= ENRICH_SVG_CACHE_MAX_BYTES) {
      enrichSvgCache.set(cacheKey, result);
      enrichSvgCacheBytes += entryBytes;
    }
    return result;
  } catch (e) {
    console.warn(`enrichSvg: Error processing SVG for markerId=${markerId}:`, e);
    return "";
  }
};

/**
 * Оборачивает SVG маркера в контейнер с CSS-переменными палитры.
 */
export function wrapMarkerSvg(innerHtml, palette) {
  if (!innerHtml) return '';
  return `<div class="marker-palette" style="${buildMarkerPaletteStyle(palette)}">${innerHtml}</div>`;
}

/** Превью маркера в модалках (SVG + палитра страны). */
export function markerPreviewHtml(svgString, palette) {
  const inner = addColorClassToSvg(svgString || '');
  return wrapMarkerSvg(inner, palette);
}

/**
 * @deprecated Используйте wrapMarkerSvg + enrichSvg с палитрой.
 */
export const addColorClassToSvg = (svgString, _color = 'blue') => {
  const doc = parseSafeSvg(svgString);
  if (!doc) return '';
  const svgElement = doc.querySelector('svg');

  if (svgElement) {
    svgElement.classList.forEach((className) => {
      if (className.startsWith('icon__')) {
        svgElement.classList.remove(className);
      }
    });
    svgElement.classList.add('marker-themed');
  }

  return new XMLSerializer().serializeToString(doc);
};
