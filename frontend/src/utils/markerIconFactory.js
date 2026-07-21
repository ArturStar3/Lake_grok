import L from 'leaflet';
import { enrichSvg, getViewBoxSize, wrapMarkerSvg } from './svgUtils';
import { getCountryMarkerPalette, markerPaletteCacheKey } from './markerPalette';
import { MAP_CONSTANTS } from '../constants/mapConstants';
import { getOrCreateDivIcon, buildIconCacheKey } from './markerIconCache';

const { ICON_WIDTH, ICON_HEIGHT } = MAP_CONSTANTS;

export function computeIconDimensions(svg, markerScale) {
  let iconWidth = ICON_WIDTH * markerScale;
  let iconHeight = ICON_HEIGHT * markerScale;
  const vb = getViewBoxSize(svg);
  if (vb && vb.width > 0) {
    iconHeight = iconWidth * (vb.height / vb.width);
  }
  return { iconWidth, iconHeight };
}

/**
 * @param {object} params
 * @param {string} params.html
 * @param {number} params.iconWidth
 * @param {number} params.iconHeight
 * @param {string} params.className
 * @param {[number, number]} [params.iconAnchor]
 * @param {[number, number]} [params.popupAnchor]
 */
export function createCachedDivIcon(cacheKey, params) {
  return getOrCreateDivIcon(cacheKey, () => new L.DivIcon({
    html: params.html,
    className: params.className,
    iconSize: [params.iconWidth, params.iconHeight],
    iconAnchor: params.iconAnchor ?? [params.iconWidth / 2, params.iconHeight / 2],
    popupAnchor: params.popupAnchor,
  }));
}

export function createNonFlagDivIcon(obj, svgCache) {
  const path = obj.marker?.path;
  if (path && !svgCache?.has(path)) {
    // SVG ещё грузится — не кэшируем placeholder-круг
    return null;
  }
  const svg = path ? svgCache.get(path) ?? '' : '';
  const markerScale = parseFloat(obj.marker?.scale) || 1;
  const palette = getCountryMarkerPalette(obj.country);
  const paletteKey = markerPaletteCacheKey(palette);
  const { iconWidth, iconHeight } = computeIconDimensions(svg, markerScale);

  const cacheKey = buildIconCacheKey([
    'nonflag',
    obj.id,
    path,
    paletteKey,
    markerScale,
    iconWidth,
    iconHeight,
    svg.length,
  ]);

  return getOrCreateDivIcon(cacheKey, () => {
    const enriched = enrichSvg(svg, iconWidth, iconHeight, obj.id, palette);
    const fallbackSvg = `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="${iconWidth}" height="${iconHeight}">
        <circle cx="25" cy="25" r="22" fill="${palette.color_first}" opacity="0.8" stroke="#FFFFFF" stroke-width="2"/>
      </svg>`;
    const inner = enriched || fallbackSvg;
    const html = `
    <div class="non-flag-marker" data-id="${obj.id}">
      ${wrapMarkerSvg(inner, palette)}
    </div>
  `;
    return new L.DivIcon({
      html,
      className: 'non-flag-div-icon',
      iconSize: [iconWidth, iconHeight],
      iconAnchor: [iconWidth / 2, iconHeight / 2],
    });
  });
}

export function createGroupCountDivIcon(groupId, groupSize) {
  const groupIconSize = 35;
  const cacheKey = buildIconCacheKey(['group', groupSize]);

  const html = `
    <div class="group-marker" data-group-id="${groupId}" data-size="${groupSize}">
      <svg viewBox="0 0 35 35" xmlns="http://www.w3.org/2000/svg" width="${groupIconSize}" height="${groupIconSize}">
        <circle cx="17.5" cy="17.5" r="15" fill="#FF6B6B" opacity="0.9" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="23" cy="12" r="3" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="17.5" cy="21" r="3" fill="#FFFFFF" opacity="0.7"/>
        <text x="17.5" y="17.5" text-anchor="middle" dy="0.3em" font-size="14" fill="white" font-weight="bold">${groupSize}</text>
      </svg>
    </div>
  `;

  return createCachedDivIcon(cacheKey, {
    html,
    className: 'group-div-icon',
    iconWidth: groupIconSize,
    iconHeight: groupIconSize,
  });
}

/**
 * Строит иконки для объектов группы (ленивая загрузка при открытии круга).
 * @returns {Record<string, import('leaflet').DivIcon>}
 */
export function ensureNonFlagIconsForObjects(objects, svgCache, existing = {}) {
  const result = { ...existing };
  if (!objects?.length || !svgCache) return result;

  objects.forEach((obj) => {
    if (!obj?.id) return;
    const icon = createNonFlagDivIcon(obj, svgCache);
    if (icon) {
      result[obj.id] = icon;
    }
  });

  return result;
}
