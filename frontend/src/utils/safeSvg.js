const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ALLOWED_TAGS = new Set('svg g defs path rect circle ellipse line polyline polygon text tspan title desc use symbol linearGradient radialGradient stop clipPath mask pattern filter feGaussianBlur feOffset feBlend feColorMatrix feComposite feFlood feMerge feMergeNode'.split(' '));

/** Defense for legacy marker files that predate server validation. */
export function parseSafeSvg(value) {
  if (typeof value !== 'string' || value.length > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(value)) return null;
  const doc = new DOMParser().parseFromString(value, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') return null;
  const nodes = Array.from(doc.querySelectorAll('*'));
  if (nodes.length > 10000) return null;
  for (const node of nodes) {
    if ((node.localName === 'metadata' && node.namespaceURI === SVG_NAMESPACE) ||
        (node.localName === 'namedview' && node.namespaceURI === 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd')) node.remove();
  }
  let selectorsSeen = 0;
  for (const style of doc.querySelectorAll('style')) {
    // Palette classes remain; styles are supplied by the local marker theme.
    // Normalize legacy simple class/id declarations before removing global CSS.
    const css = (style.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const declarations = rule[2];
      if (/\\|@|expression|javascript|data:|https?:|file:/i.test(declarations)) continue;
      if (Array.from(declarations.matchAll(/url\s*\((.*?)\)/gi)).some((match) => !/^[\s'"]*#[\w.-]+[\s'"]*$/.test(match[1]))) continue;
      for (const selector of rule[1].split(',').map((item) => item.trim())) {
        selectorsSeen += 1;
        if (selectorsSeen > 256) return null;
        if (!/^[.#][\w-]+$/.test(selector)) continue;
        for (const node of nodes) {
          if (selector[0] === '.' ? node.classList.contains(selector.slice(1)) : node.id === selector.slice(1)) {
            node.setAttribute('style', `${declarations};${node.getAttribute('style') || ''}`);
          }
        }
      }
    }
    style.remove();
  }
  for (const node of doc.querySelectorAll('*')) {
    if (node.namespaceURI !== SVG_NAMESPACE || !ALLOWED_TAGS.has(node.localName)) return null;
    for (const attr of Array.from(node.attributes)) {
      const name = attr.localName.toLowerCase();
      if (attr.value.includes('\\') || attr.value.includes('/*')) return null;
      if (/^on/i.test(name) || ['base', 'src'].includes(name)) return null;
      if (name === 'href' && !/^#[\w.-]+$/.test(attr.value)) return null;
      if (name === 'style' && /\\|@|expression|javascript|data:|https?:|file:/i.test(attr.value)) return null;
      for (const match of attr.value.matchAll(/url\s*\((.*?)\)/gi)) {
        if (!/^[\s'"]*#[\w.-]+[\s'"]*$/.test(match[1])) return null;
      }
    }
  }
  return doc;
}
