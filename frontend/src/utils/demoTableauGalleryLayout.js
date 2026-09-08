const DEFAULT_ASPECT = 4 / 3;
const MAX_IMAGES = 6;
const DEFAULT_BAND = { x: 6, y: 8, width: 88, height: 42 };
const SETTLE = {
  ROW: 'row',
  ROW_FIT: 'row_fit',
  OVERLAP: 'overlap',
  FREE: 'free',
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function imageAspect(image, measured = null) {
  if (measured && Number.isFinite(measured) && measured > 0.2 && measured < 8) {
    return measured;
  }
  const w = Number(image?.rest?.w);
  const h = Number(image?.rest?.h);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return w / h;
  }
  return DEFAULT_ASPECT;
}

function bandOf(gallery) {
  const band = gallery?.band || DEFAULT_BAND;
  return {
    x: clamp(Number(band.x) || 0, 0, 100),
    y: clamp(Number(band.y) || 0, 0, 100),
    width: clamp(Number(band.width) || 88, 8, 100),
    height: clamp(Number(band.height) || 42, 8, 100),
  };
}

function takeImages(images) {
  return (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES);
}

/**
 * Раскладка после входа. Координаты — проценты экрана.
 * @param {object[]} images
 * @param {object} gallery
 * @param {Record<string, number>} [aspects] измеренные width/height
 */
export function computeGallerySettleRects(images, gallery, aspects = {}) {
  const items = takeImages(images);
  const band = bandOf(gallery);
  const settle = gallery?.settle || SETTLE.ROW_FIT;
  const gap = clamp(Number(gallery?.gap_pct) || 1.2, 0, 8);
  if (!items.length) return [];

  if (settle === SETTLE.FREE) {
    return items.map((image, index) => ({
      id: image.id,
      x: clamp(Number(image.rest?.x) || (band.x + index * 8), 0, 100),
      y: clamp(Number(image.rest?.y) || band.y, 0, 100),
      w: clamp(Number(image.rest?.w) || 22, 4, 100),
      h: clamp(Number(image.rest?.h) || 28, 4, 100),
      rotate: 0,
      z: index,
    }));
  }

  if (settle === SETTLE.OVERLAP) {
    const offset = clamp(Number(gallery?.overlap_offset_pct) || 4, 0.5, 16);
    const rotate = clamp(Number(gallery?.overlap_rotate_deg) || 3, 0, 12);
    const n = items.length;
    const maxW = Math.min(band.width * 0.62, 42);
    const maxH = Math.min(band.height * 0.92, 36);
    const baseH = maxH;
    return items.map((image, index) => {
      const aspect = imageAspect(image, aspects[image.id]);
      let h = baseH;
      let w = h * aspect;
      if (w > maxW) {
        w = maxW;
        h = w / aspect;
      }
      const stackW = w + offset * Math.max(0, n - 1);
      const stackH = h + offset * Math.max(0, n - 1);
      const originX = band.x + Math.max(0, (band.width - stackW) / 2);
      const originY = band.y + Math.max(0, (band.height - stackH) / 2);
      const sign = index % 2 === 0 ? -1 : 1;
      return {
        id: image.id,
        x: originX + offset * index,
        y: originY + offset * index * 0.55,
        w,
        h,
        rotate: n === 1 ? 0 : sign * rotate * (0.4 + index * 0.35),
        z: index,
      };
    });
  }

  const aspectsList = items.map((image) => imageAspect(image, aspects[image.id]));
  const n = items.length;
  const gapsTotal = gap * Math.max(0, n - 1);

  if (settle === SETTLE.ROW) {
    const natural = items.map((image, index) => {
      const aspect = aspectsList[index];
      const w = clamp(Number(image.rest?.w) || Math.min(22, band.width / n), 8, 80);
      const h = clamp(Number(image.rest?.h) || (w / aspect), 8, 70);
      return { w, h };
    });
    const rawW = natural.reduce((sum, item) => sum + item.w, 0) + gapsTotal;
    const rawH = Math.max(...natural.map((item) => item.h));
    const scale = Math.min(
      1,
      band.width / Math.max(rawW, 1),
      band.height / Math.max(rawH, 1),
    );
    const totalW = rawW * scale;
    let x = band.x + Math.max(0, (band.width - totalW) / 2);
    const yBase = band.y + band.height / 2;
    return items.map((image, index) => {
      const w = natural[index].w * scale;
      const h = natural[index].h * scale;
      const rect = {
        id: image.id,
        x,
        y: yBase - h / 2,
        w,
        h,
        rotate: 0,
        z: index,
      };
      x += w + gap * scale;
      return rect;
    });
  }

  // row_fit: общая высота, ширины по пропорциям, вписать в band.
  let height = band.height;
  const widthsAt = (h) => aspectsList.map((aspect) => h * aspect);
  let widths = widthsAt(height);
  let total = widths.reduce((sum, w) => sum + w, 0) + gapsTotal;
  if (total > band.width) {
    height *= band.width / Math.max(total, 1);
    widths = widthsAt(height);
    total = widths.reduce((sum, w) => sum + w, 0) + gapsTotal;
  }
  let extra = Math.max(0, band.width - total);
  const extraGap = n > 1 ? extra / (n - 1) : 0;
  if (n === 1) {
    const w = widths[0];
    return [{
      id: items[0].id,
      x: band.x + (band.width - w) / 2,
      y: band.y + (band.height - height) / 2,
      w,
      h: height,
      rotate: 0,
      z: 0,
    }];
  }
  let x = band.x;
  const y = band.y + (band.height - height) / 2;
  return items.map((image, index) => {
    const w = widths[index];
    const rect = {
      id: image.id,
      x,
      y,
      w,
      h: height,
      rotate: 0,
      z: index,
    };
    x += w + gap + extraGap;
    return rect;
  });
}

/**
 * Стартовая позиция входа: центр зоны посадки, чуть меньше финального кадра.
 */
export function computeGallerySpawnRects(settleRects, gallery) {
  const band = bandOf(gallery);
  const cx = band.x + band.width / 2;
  const cy = band.y + band.height / 2;
  return (settleRects || []).map((rect, index) => {
    const w = Math.min(rect.w * 0.86, band.width * 0.38);
    const h = Math.min(rect.h * 0.86, band.height * 0.78);
    const jitter = (index - ((settleRects.length - 1) / 2)) * 1.4;
    return {
      id: rect.id,
      x: cx - w / 2 + jitter,
      y: cy - h / 2,
      w,
      h,
      rotate: 0,
      z: rect.z,
    };
  });
}

/**
 * Крупный кадр в центре экрана для эффекта «проявление с увеличением».
 */
export function computeGalleryCenterSpawnRects(settleRects, aspects = {}) {
  return (settleRects || []).map((rect, index) => {
    const aspect = aspects[rect.id]
      || (rect.w > 0 && rect.h > 0 ? rect.w / rect.h : DEFAULT_ASPECT);
    let w = 56;
    let h = w / Math.max(aspect, 0.2);
    if (h > 70) {
      h = 70;
      w = h * aspect;
    }
    if (w > 72) {
      w = 72;
      h = w / aspect;
    }
    return {
      id: rect.id,
      x: 50 - w / 2,
      y: 50 - h / 2,
      w,
      h,
      rotate: 0,
      z: 80 + index,
    };
  });
}

export function bakeGalleryLayoutIntoRest(images, gallery, settle) {
  const items = takeImages(images);
  const rects = computeGallerySettleRects(items, { ...gallery, settle });
  return items.map((image, index) => {
    const rect = rects[index];
    if (!rect) return image;
    return {
      ...image,
      rest: {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      },
    };
  });
}
