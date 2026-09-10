/**
 * Кэш разобранного эффекта демонстрации на «корзину» шага.
 *
 * Резолверы вызываются для каждого маркера, события и зоны на каждом рендере
 * карты. Пока они собирали новый объект на каждый вызов, любой рендер менял
 * ссылку на эффект: зависимые useEffect срабатывали заново, снимали и вешали
 * CSS-классы — и анимация начиналась с нуля, вместо того чтобы продолжаться.
 * Заодно на каждый маркер строился свой Set с идентификаторами шага.
 *
 * Корзина пересоздаётся вместе с demoAnimation, то есть на смене такта, —
 * поэтому WeakMap по ней и есть нужное время жизни кэша.
 */
const buckets = new WeakMap();

export function cachedBucketData(bucket, build) {
  if (!bucket) return null;
  let value = buckets.get(bucket);
  if (value === undefined) {
    value = build();
    buckets.set(bucket, value);
  }
  return value;
}

/** Набор идентификаторов шага; `null` означает «все показанные». */
export function idSet(ids) {
  return ids?.length ? new Set(ids.map(String)) : null;
}

export function demoLoopClass(continuous) {
  return continuous ? 'demo-anim--continuous' : 'demo-anim--once';
}

/**
 * В сохранённых ранее сценариях `repeat` отсутствует или равен нулю.
 * Для ограниченного режима это означает один полный прогон анимации.
 */
export function demoRepeatCount(repeat) {
  const value = Math.trunc(Number(repeat));
  if (!Number.isFinite(value)) return 1;
  return Math.min(100, Math.max(1, value));
}
