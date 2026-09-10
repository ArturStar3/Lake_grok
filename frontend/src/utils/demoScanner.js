export const SCANNER_EFFECTS = [
  { id: 'letters', label: 'Побуквенное проявление' },
  { id: 'scramble', label: 'Перебор букв' },
  { id: 'typewriter', label: 'Печатная машинка' },
];

export function normalizeScanner(raw = {}) {
  const number = (key, fallback, min, max) => Number.isFinite(Number(raw?.[key]))
    ? Math.max(min, Math.min(max, Math.round(Number(raw[key])))) : fallback;
  const minimum = number('scan_min_ms', 2200, 500, 15000);
  return {
    images: (Array.isArray(raw?.images) ? raw.images : []).slice(0, 40)
      .filter((image) => /^\/media\/[\w./%-]+$/.test(image?.src) && !image.src.includes('..'))
      .map((image, index) => ({ id: `scan-${index}`, src: image.src, title: String(image.title || '').slice(0, 120) })),
    document: raw?.document && Array.isArray(raw.document.blocks) ? raw.document : { name: '', blocks: [] },
    effect: SCANNER_EFFECTS.some((item) => item.id === raw?.effect) ? raw.effect : 'letters',
    scan_min_ms: minimum,
    scan_max_ms: Math.max(minimum, number('scan_max_ms', 4800, 500, 15000)),
    characters_per_second: number('characters_per_second', 80, 10, 500),
  };
}

export function documentLength(document) {
  const count = (blocks) => (blocks || []).reduce((sum, block) => sum + (block.type === 'table'
    ? block.rows.reduce((n, row) => n + row.reduce((m, cell) => m + count(cell), 0), 0)
    : (block.runs || []).reduce((n, run) => n + Array.from(run.text).length, 0)), 0);
  return count(document?.blocks);
}

export function scannerDurationMs(raw) {
  const config = normalizeScanner(raw);
  // Conservative bound even for a viewport exposing only one card.
  return config.images.length * (config.scan_max_ms * 2 + 1400)
    + documentLength(config.document) / config.characters_per_second * 1600 + 2500;
}

export function createScannerState(config, random = Math.random) {
  return {
    cards: config.images.map((image) => ({ ...image, elapsed: 0, phase: 'scan',
      down: config.scan_min_ms + random() * (config.scan_max_ms - config.scan_min_ms),
      up: config.scan_min_ms + random() * (config.scan_max_ms - config.scan_min_ms) })),
    delivered: 0, revealed: 0, tick: 0, draining: false,
  };
}

export function advanceScanner(state, config, delta, visibleCount, length, reducedMotion = false) {
  let delivered = state.delivered;
  const activeCards = [];
  const returnedCards = [];
  // Once the text is complete, retain only the currently visible sources.
  // They finish their final scan and handoff; nothing else enters the queue.
  const sourceCards = state.draining ? state.cards.slice(0, visibleCount) : state.cards;
  sourceCards.forEach((card, index) => {
    if (card.phase === 'done' || (!state.draining && card.phase === 'scan' && index >= visibleCount)) {
      activeCards.push(card);
      return;
    }
    const elapsed = card.elapsed + delta;
    const scanEnd = reducedMotion ? 700 : card.down + card.up;
    const flyEnd = scanEnd + (reducedMotion ? 200 : 900);
    const end = flyEnd + 500;
    const phase = elapsed >= end ? 'done' : elapsed >= flyEnd ? 'collapse' : elapsed >= scanEnd ? 'fly' : 'scan';
    if ((card.phase === 'scan' || card.phase === 'fly') && (phase === 'collapse' || phase === 'done')) delivered += 1;
    if (phase === 'done') {
      if (!state.draining) {
        // Sources return to the tail while the document text is still forming.
        returnedCards.push({ ...card, elapsed: 0, phase: 'scan' });
      }
      return;
    }
    activeCards.push({ ...card, elapsed, phase, scanEnd, flyEnd });
  });
  const cards = [...activeCards, ...returnedCards];
  const unlocked = config.images.length ? Math.ceil(length * delivered / config.images.length) : 0;
  const speed = config.characters_per_second * (config.effect === 'typewriter' ? 0.7 + 0.3 * Math.sin(state.tick / 140) ** 2 : 1);
  const revealed = Math.min(unlocked, state.revealed + delta * speed / 1000);
  const beginsDraining = !state.draining && revealed >= length;
  return {
    cards: beginsDraining ? cards.slice(0, visibleCount) : cards,
    delivered,
    revealed,
    tick: state.tick + delta,
    draining: state.draining || beginsDraining,
  };
}
