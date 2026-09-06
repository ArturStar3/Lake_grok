import { memo, useEffect, useId, useMemo, useRef } from 'react';

const TRAIL_SPACING = 0.06;

const TRAIL_META = [
  { isHead: true, lag: 0, radius: 1.35, baseOpacity: 1, fadeTail: 1 },
  {
    isHead: false,
    lag: TRAIL_SPACING,
    radius: 0.85,
    baseOpacity: 0.4,
    fadeTail: Math.max(0, 1 - TRAIL_SPACING * 4),
  },
  {
    isHead: false,
    lag: TRAIL_SPACING * 2,
    radius: 0.5,
    baseOpacity: 0.18,
    fadeTail: Math.max(0, 1 - TRAIL_SPACING * 2 * 4),
  },
];

function easeInOut(t) {
  return t < 0.5
    ? 2 * t * t
    : 1 - ((-2 * t + 2) ** 2) / 2;
}

function normalizePoints(points, x1, y1, x2, y2) {
  if (Array.isArray(points) && points.length >= 2) {
    return points.map((p) => ({
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
    }));
  }
  return [
    { x: Number(x1) || 0, y: Number(y1) || 0 },
    { x: Number(x2) || 0, y: Number(y2) || 0 },
  ];
}

function pointsKey(pts) {
  return pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(';');
}

function buildPathMetrics(pts) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  return { segs, total: total || 1 };
}

function pointAt(metrics, dist) {
  const d = Math.max(0, Math.min(metrics.total, dist));
  for (let i = 0; i < metrics.segs.length; i += 1) {
    const seg = metrics.segs[i];
    if (d <= seg.start + seg.len || i === metrics.segs.length - 1) {
      const t = seg.len > 0 ? (d - seg.start) / seg.len : 1;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
      };
    }
  }
  const last = metrics.segs[metrics.segs.length - 1];
  return last ? { x: last.b.x, y: last.b.y } : { x: 0, y: 0 };
}

/**
 * Светящаяся искра вдоль полилинии (viewBox %).
 * Позиции — через style.transform (compositor), без setAttribute/layout на кадр.
 */
function DemoTableauArrowSpark({
  points = null,
  x1 = 0,
  y1 = 0,
  x2 = 0,
  y2 = 0,
  color = '#f8fafc',
  durationMs = 1600,
  runToken = 0,
  onComplete,
}) {
  const reactId = useId();
  const gradId = `demo-tableau-spark-grad-${reactId.replace(/:/g, '')}`;
  const groupRefs = useRef([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const pts = useMemo(
    () => normalizePoints(points, x1, y1, x2, y2),
    [points, x1, y1, x2, y2],
  );
  const pathKey = useMemo(() => pointsKey(pts), [pts]);
  const ptsRef = useRef(pts);
  ptsRef.current = pts;

  useEffect(() => {
    const metrics = buildPathMetrics(ptsRef.current);
    const duration = Math.max(200, Number(durationMs) || 1600);
    let raf = 0;
    let start = 0;
    let pausedAt = 0;
    let cancelled = false;

    const apply = (progress) => {
      for (let i = 0; i < TRAIL_META.length; i += 1) {
        const el = groupRefs.current[i];
        if (!el) continue;
        const meta = TRAIL_META[i];
        const raw = Math.max(0, Math.min(1, progress - meta.lag));
        const eased = easeInOut(raw);
        const pt = pointAt(metrics, eased * metrics.total);
        const opacity = progress <= 0 ? 0 : meta.baseOpacity * meta.fadeTail;
        // % от viewBox (0 0 100 100) = user units; px были бы CSS-пикселями.
        el.style.transform = `translate(${pt.x}%, ${pt.y}%)`;
        el.style.opacity = String(opacity);
      }
    };

    const tick = (now) => {
      if (cancelled) return;
      if (!start) start = now;
      const t = (now - start) / duration;
      if (t >= 1) {
        apply(1);
        if (!cancelled) onCompleteRef.current?.();
        return;
      }
      apply(t);
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        pausedAt = performance.now();
        return;
      }
      if (pausedAt) {
        start += performance.now() - pausedAt;
        pausedAt = 0;
      }
      if (!cancelled && !raf) raf = requestAnimationFrame(tick);
    };

    apply(0);
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pathKey, durationMs, runToken]);

  return (
    <g className="demo-tableau__spark" aria-hidden="true">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="35%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {TRAIL_META.map((meta, index) => (
        <g
          key={meta.isHead ? 'head' : `trail-${index}`}
          ref={(el) => { groupRefs.current[index] = el; }}
          className="demo-tableau__spark-node"
          style={{ opacity: 0, transform: 'translate(0%, 0%)' }}
        >
          <circle
            className={meta.isHead ? 'demo-tableau__spark-core' : 'demo-tableau__spark-trail'}
            cx={0}
            cy={0}
            r={meta.radius}
            fill={meta.isHead ? `url(#${gradId})` : color}
          />
        </g>
      ))}
    </g>
  );
}

export default memo(DemoTableauArrowSpark);
