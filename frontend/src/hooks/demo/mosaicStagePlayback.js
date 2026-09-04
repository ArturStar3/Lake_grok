/**
 * Общий playback-state этапа для нескольких слотов с одним stage_id
 * (и одинаковым loop / startDelayMs). Продвижение битов — из mosaic clock.
 */

const entries = new Map();

export function mosaicPlaybackKey(stageId, { loop = false, startDelayMs = 0 } = {}) {
  return `${stageId ?? ''}::${loop ? 1 : 0}::${Number(startDelayMs) || 0}`;
}

function notify(entry) {
  entry.version += 1;
  entry.listeners.forEach((listener) => {
    try {
      listener(entry);
    } catch {
      // ignore
    }
  });
}

/**
 * @param {string} key
 * @param {{ beatCount: number, getBeatDuration: (index: number) => number, loop: boolean, startDelayMs?: number }} options
 */
export function acquireMosaicPlayback(key, options) {
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      key,
      refCount: 0,
      beatIndex: 0,
      beatStartedAt: 0,
      frozen: false,
      animationRunId: 0,
      clockReady: false,
      version: 0,
      listeners: new Set(),
      startTimer: null,
      beatCount: options.beatCount || 0,
      getBeatDuration: options.getBeatDuration,
      loop: Boolean(options.loop),
      startDelayMs: Number(options.startDelayMs) || 0,
      pausedAt: null,
      wantPaused: false,
    };
    entries.set(key, entry);

    const begin = () => {
      entry.beatIndex = 0;
      entry.frozen = false;
      entry.beatStartedAt = performance.now();
      entry.animationRunId += 1;
      entry.clockReady = true;
      entry.pausedAt = entry.wantPaused ? performance.now() : null;
      notify(entry);
    };

    if (entry.startDelayMs > 0) {
      entry.startTimer = setTimeout(begin, entry.startDelayMs);
    } else {
      begin();
    }
  } else {
    entry.beatCount = options.beatCount || entry.beatCount;
    entry.getBeatDuration = options.getBeatDuration || entry.getBeatDuration;
    entry.loop = Boolean(options.loop);
  }
  entry.refCount += 1;
  return entry;
}

export function releaseMosaicPlayback(key) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;
  if (entry.startTimer) {
    clearTimeout(entry.startTimer);
    entry.startTimer = null;
  }
  entries.delete(key);
}

export function subscribeMosaicPlayback(key, listener) {
  const entry = entries.get(key);
  if (!entry) return () => {};
  entry.listeners.add(listener);
  listener(entry);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function getMosaicPlayback(key) {
  return entries.get(key) || null;
}

export function setMosaicPlaybackPaused(key, paused) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.wantPaused = Boolean(paused);
  if (!entry.clockReady) return;
  if (paused) {
    if (entry.pausedAt == null) entry.pausedAt = performance.now();
    return;
  }
  if (entry.pausedAt != null) {
    entry.beatStartedAt += performance.now() - entry.pausedAt;
    entry.pausedAt = null;
  }
}

/** Пауза всех playback (вкладка скрыта). */
export function setAllMosaicPlaybacksPaused(paused) {
  entries.forEach((_entry, key) => {
    setMosaicPlaybackPaused(key, paused);
  });
}

function goToBeat(entry, nextIndex) {
  const count = entry.beatCount || 0;
  if (!count) return;
  const bounded = Math.max(0, Math.min(count - 1, nextIndex));
  entry.beatIndex = bounded;
  entry.frozen = false;
  entry.beatStartedAt = performance.now();
  entry.pausedAt = null;
  entry.animationRunId += 1;
  notify(entry);
}

/** Вызывается раз за кадр mosaic clock — для всех активных playback. */
export function tickAllMosaicPlaybacks(now) {
  if (typeof document !== 'undefined' && document.hidden) return;

  entries.forEach((entry) => {
    if (!entry.clockReady || entry.frozen || entry.pausedAt != null) return;
    const count = entry.beatCount || 0;
    if (!count) return;
    const duration = Math.max(16, entry.getBeatDuration?.(entry.beatIndex) || 0);
    const elapsed = now - entry.beatStartedAt;
    if (elapsed < duration) return;

    if (entry.beatIndex + 1 < count) {
      goToBeat(entry, entry.beatIndex + 1);
      return;
    }
    if (entry.loop) {
      goToBeat(entry, 0);
      return;
    }
    entry.frozen = true;
    notify(entry);
  });
}
