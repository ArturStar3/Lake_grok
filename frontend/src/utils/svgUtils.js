/**
 * Получает размеры (width, height) из viewBox SVG-строки
 * @param {string} svgString - SVG код
 * @returns {{width: number, height: number} | null}
 */
export function getViewBoxSize(svgString) {
  if (!svgString) return null;
  const match = svgString.match(/viewBox\s*=\s*['\"]([\d.\s]+)['\"]/i);
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const enrichSvgCache = new Map();
const ENRICH_SVG_CACHE_MAX = 2000;

function enrichSvgCacheKey(rawSvg, width, height, markerId, color) {
  return `${markerId}|${color}|${width}|${height}|${rawSvg.length}|${rawSvg.slice(0, 64)}`;
}

/** Сброс при смене набора объектов на карте. */
export function clearEnrichSvgCache() {
  enrichSvgCache.clear();
}

/**
 * Обогащает SVG: уникальные id в defs, цветовые классы, размеры.
 * Все id переименовываются с суффиксом markerId — иначе url(#id) в inline-SVG
 * разрешается по всему HTML-документу и маркеры с order>6 (radialGradient, clipPath)
 * «крадут» градиенты друг у друга.
 */
export const enrichSvg = (rawSvg, w, h, markerId, color) => {
  if (!rawSvg) {
    return "";
  }

  const width = typeof w === "string" ? w.replace(/px$/i, "") : w;
  const height = typeof h === "string" ? h.replace(/px$/i, "") : h;
  const suffix = String(markerId ?? 'marker');

  const cacheKey = enrichSvgCacheKey(rawSvg, width, height, suffix, color);
  if (enrichSvgCache.has(cacheKey)) {
    return enrichSvgCache.get(cacheKey);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSvg, "image/svg+xml");

    if (doc.documentElement.nodeName === "parsererror") {
      console.warn(`enrichSvg: DOMParser error for markerId=${markerId}`);
      return "";
    }

    const idMap = {};
    doc.querySelectorAll('[id]').forEach((el) => {
      const oldId = el.getAttribute('id');
      if (!oldId) return;
      if (!idMap[oldId]) {
        idMap[oldId] = `${oldId}-${suffix}`;
      }
      el.setAttribute('id', idMap[oldId]);
    });

    doc.querySelector('svg')?.classList.add(`icon__${color || 'blue'}`);

    let svgString = new XMLSerializer().serializeToString(doc);

    Object.entries(idMap)
      .sort((a, b) => b[0].length - a[0].length)
      .forEach(([oldId, newId]) => {
        const escaped = escapeRegExp(oldId);
        svgString = svgString
          .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${newId})`)
          .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${newId}"`)
          .replace(new RegExp(`xlink:href="#${escaped}"`, 'g'), `xlink:href="#${newId}"`);
      });

    svgString = svgString.replace(/<svg\s/, '<svg xmlns="http://www.w3.org/2000/svg" ');

    const match = svgString.match(/<svg([\s\S]*?)>/i);
    if (!match) {
      console.warn(`enrichSvg: No SVG tag found for markerId=${markerId}`);
      return svgString;
    }

    const originalAttrs = match[1];
    const cleanedAttrs = originalAttrs
      .replace(/\swidth\s*=\s*["'][^"']*["']/i, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/i, "")
      .trim();

    const newAttrs = `${cleanedAttrs} width="${width}" height="${height}"`.trim();
    const result = svgString.replace(/<svg([\s\S]*?)>/i, `<svg ${newAttrs}>`);

    if (enrichSvgCache.size >= ENRICH_SVG_CACHE_MAX) {
      enrichSvgCache.clear();
    }
    enrichSvgCache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.warn(`enrichSvg: Error processing SVG for markerId=${markerId}:`, e);
    return "";
  }
};

/**
 * Добавляет или заменяет цветовой класс в SVG
 * @param {string} svgString - SVG код
 * @param {string} color - Цвет для класса (по умолчанию 'blue')
 * @returns {string} SVG с обновленным классом цвета
 */
export const addColorClassToSvg = (svgString, color = 'blue') => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');
  
  if (svgElement) {
    // Удаляем все существующие классы icon__*
    svgElement.classList.forEach(className => {
      if (className.startsWith('icon__')) {
        svgElement.classList.remove(className);
      }
    });
    // Добавляем новый класс
    svgElement.classList.add(`icon__${color}`);
  }
  
  return new XMLSerializer().serializeToString(doc);
};
