import { resolveMediaUrl } from './mediaUrl';

const images = new Map();

// Share decoding between preparation and the visible gallery. Bound retained
// image references so long demonstrations do not grow the cache indefinitely.
export function prepareDemoImage(value) {
  const src = resolveMediaUrl(value);
  if (!src) return Promise.resolve(null);
  if (images.has(src)) return images.get(src);
  const pending = new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (!result) images.delete(src);
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 10000);
    image.onerror = () => finish(null);
    image.onload = async () => {
      try { await image.decode(); } catch { /* Loaded images can still render. */ }
      finish(image.naturalWidth && image.naturalHeight ? image : null);
    };
    image.src = src;
  });
  images.set(src, pending);
  if (images.size > 80) images.delete(images.keys().next().value);
  return pending;
}

export function warmDemoImages(scenario) {
  const urls = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, item]) => {
      if (typeof item === 'string' && (key === 'image_url' || key === 'src')
        && !/\.(mp4|webm)(?:[?#]|$)/i.test(item)) urls.add(item);
      else if (typeof item === 'object') visit(item);
    });
  };
  visit(scenario);
  const queue = [...urls];
  let cancelled = false;
  const worker = async () => {
    while (!cancelled && queue.length) await prepareDemoImage(queue.shift());
  };
  // Avoid competing with map tiles and the currently visible media.
  void worker();
  void worker();
  return () => { cancelled = true; };
}
