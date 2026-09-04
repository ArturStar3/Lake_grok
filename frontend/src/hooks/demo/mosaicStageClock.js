/**
 * Единый RAF-тикер для плиток мультиэкрана.
 * Пауза при document.hidden; старт/стоп снаружи (когда сетка играет).
 */

import { setAllMosaicPlaybacksPaused, tickAllMosaicPlaybacks } from './mosaicStagePlayback';

let rafId = 0;
let running = false;
let visibilityBound = false;
const listeners = new Set();

function onVisibilityChange() {
  if (typeof document === 'undefined') return;
  setAllMosaicPlaybacksPaused(document.hidden);
}

function tick(now) {
  if (!running) return;
  if (typeof document === 'undefined' || !document.hidden) {
    tickAllMosaicPlaybacks(now);
    listeners.forEach((listener) => {
      try {
        listener(now);
      } catch {
        // один сломанный подписчик не останавливает тикер
      }
    });
  }
  rafId = requestAnimationFrame(tick);
}

function bindVisibility() {
  if (visibilityBound || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', onVisibilityChange);
  visibilityBound = true;
}

function unbindVisibility() {
  if (!visibilityBound || typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  visibilityBound = false;
}

export function subscribeMosaicClock(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMosaicClockEnabled(enabled) {
  if (enabled) {
    if (running) return;
    running = true;
    bindVisibility();
    rafId = requestAnimationFrame(tick);
    return;
  }
  if (!running) return;
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (listeners.size === 0) unbindVisibility();
}

export function isMosaicClockRunning() {
  return running;
}
