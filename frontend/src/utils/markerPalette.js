export const DEFAULT_MARKER_PALETTE = {
  color_first: '#008DD2',
  color_second: '#FEFEFE',
  color_third: '#00A0E3',
  color_forth: '#A2D9F7',
};

export function normalizeMarkerPalette(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_MARKER_PALETTE };
  }
  const pick = (key, fallback) => {
    const v = raw[key];
    return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v : fallback;
  };
  return {
    color_first: pick('color_first', DEFAULT_MARKER_PALETTE.color_first),
    color_second: pick('color_second', DEFAULT_MARKER_PALETTE.color_second),
    color_third: pick('color_third', DEFAULT_MARKER_PALETTE.color_third),
    color_forth: pick('color_forth', DEFAULT_MARKER_PALETTE.color_forth),
  };
}

/** @param {{ marker_palette?: object } | null | undefined} country */
export function getCountryMarkerPalette(country) {
  return normalizeMarkerPalette(country?.marker_palette);
}

export function buildMarkerPaletteStyle(palette) {
  const p = normalizeMarkerPalette(palette);
  return (
    `--marker-c1:${p.color_first};` +
    `--marker-c2:${p.color_second};` +
    `--marker-c3:${p.color_third};` +
    `--marker-c4:${p.color_forth};`
  );
}

export function markerPaletteCacheKey(palette) {
  const p = normalizeMarkerPalette(palette);
  return `${p.color_first}|${p.color_second}|${p.color_third}|${p.color_forth}`;
}
