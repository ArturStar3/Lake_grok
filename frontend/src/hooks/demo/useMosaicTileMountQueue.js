import { useEffect, useRef, useState } from 'react';

const EMPTY = new Set();

/**
 * Поочерёдный mount Leaflet-карт мультиэкрана.
 *
 * Первый кадр сетки рисуется без карт (скелеты), затем пакетами по
 * `batchSize` слотов — иначе N MapContainer в одном commit подвешивают UI.
 */
export function useMosaicTileMountQueue({
  active = false,
  presetId = null,
  slotIds = [],
  batchSize = 2,
  gapMs = 80,
} = {}) {
  const [mounted, setMounted] = useState(EMPTY);
  const genRef = useRef(0);
  const slotKey = Array.isArray(slotIds) ? slotIds.join(',') : '';

  useEffect(() => {
    if (!active) {
      genRef.current += 1;
      setMounted(EMPTY);
      return undefined;
    }

    const gen = ++genRef.current;
    const wanted = slotKey ? slotKey.split(',') : [];
    const size = Math.max(1, Number(batchSize) || 2);
    const gap = Math.max(0, Number(gapMs) || 0);

    setMounted(EMPTY);

    let cursor = 0;
    let timeoutId = 0;
    let raf1 = 0;
    let raf2 = 0;

    const cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = 0;
      }
      if (raf1) {
        cancelAnimationFrame(raf1);
        raf1 = 0;
      }
      if (raf2) {
        cancelAnimationFrame(raf2);
        raf2 = 0;
      }
    };

    const mountNext = () => {
      if (gen !== genRef.current) return;
      if (cursor >= wanted.length) return;
      const slice = wanted.slice(cursor, cursor + size);
      cursor += size;
      setMounted((prev) => {
        const next = new Set(prev);
        slice.forEach((id) => next.add(id));
        return next;
      });
      if (cursor < wanted.length) schedule(gap);
    };

    const schedule = (delayMs) => {
      if (gen !== genRef.current) return;
      if (delayMs <= 0) {
        mountNext();
        return;
      }
      timeoutId = window.setTimeout(mountNext, delayMs);
    };

    // Двойной rAF: сетка и подписи успевают покраситься до первого Leaflet.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (gen !== genRef.current) return;
        mountNext();
      });
    });

    return () => {
      genRef.current += 1;
      cancel();
    };
  }, [active, batchSize, gapMs, presetId, slotKey]);

  return mounted;
}
