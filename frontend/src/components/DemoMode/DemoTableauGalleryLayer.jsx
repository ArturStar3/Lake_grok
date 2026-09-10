import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { getDemoAnimationMap } from '../MapComponent/demo/demoRafDriver';
import {
  computeGalleryCenterSpawnRects,
  computeGallerySettleRects,
  computeGallerySpawnRects,
} from '../../utils/demoTableauGalleryLayout';
import './DemoTableauGallery.css';

const FRAME_PHASE = {
  HIDDEN: 'hidden',
  ENTERING: 'entering',
  HOLDING: 'holding',
  SETTLING: 'settling',
  SETTLED: 'settled',
  EXITING: 'exiting',
};
const EMPTY_IMAGES = [];

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function rectStyle(rect) {
  if (!rect) return { opacity: 0 };
  return {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex: (rect.z ?? 0) + 1,
    '--gallery-rotate': `${rect.rotate || 0}deg`,
  };
}

function makePhases(count, value) {
  return Array.from({ length: count }, () => value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function projectTargetOrigin(targetId, objects) {
  const obj = (objects || []).find((item) => String(item.id) === String(targetId));
  const lat = Number(obj?.lat);
  const lng = Number(obj?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const map = getDemoAnimationMap();
  if (!map?.latLngToContainerPoint) return null;
  const point = map.latLngToContainerPoint([lat, lng]);
  const size = map.getSize?.();
  if (!size?.x || !size?.y) return null;
  return {
    x: (point.x / size.x) * 100,
    y: (point.y / size.y) * 100,
  };
}

function lerpRect(origin, rest, t) {
  const tiny = 0.8;
  const start = {
    x: origin.x - tiny / 2,
    y: origin.y - tiny / 2,
    w: tiny,
    h: tiny,
  };
  return {
    x: lerp(start.x, rest.x, t),
    y: lerp(start.y, rest.y, t),
    w: lerp(start.w, rest.w, t),
    h: lerp(start.h, rest.h, t),
  };
}

function tailBase(origin, rect) {
  const { x, y, w, h } = rect;
  const right = x + w;
  const bottom = y + h;
  let edge = 'bottom';
  if (origin.y < y) edge = 'top';
  else if (origin.y > bottom) edge = 'bottom';
  else if (origin.x < x) edge = 'left';
  else if (origin.x > right) edge = 'right';
  else {
    const dTop = Math.abs(origin.y - y);
    const dBottom = Math.abs(origin.y - bottom);
    const dLeft = Math.abs(origin.x - x);
    const dRight = Math.abs(origin.x - right);
    const nearest = Math.min(dTop, dBottom, dLeft, dRight);
    if (nearest === dTop) edge = 'top';
    else if (nearest === dBottom) edge = 'bottom';
    else if (nearest === dLeft) edge = 'left';
    else edge = 'right';
  }
  const span = edge === 'left' || edge === 'right'
    ? Math.min(5, Math.max(1.2, h * 0.22))
    : Math.min(5, Math.max(1.2, w * 0.22));
  if (edge === 'top') {
    const mx = clamp(origin.x, x + span, right - span);
    return [{ x: mx - span, y }, { x: mx + span, y }];
  }
  if (edge === 'bottom') {
    const mx = clamp(origin.x, x + span, right - span);
    return [{ x: mx - span, y: bottom }, { x: mx + span, y: bottom }];
  }
  if (edge === 'left') {
    const my = clamp(origin.y, y + span, bottom - span);
    return [{ x, y: my - span }, { x, y: my + span }];
  }
  const my = clamp(origin.y, y + span, bottom - span);
  return [{ x: right, y: my - span }, { x: right, y: my + span }];
}

function GalleryCallout({ origin, rest, progress }) {
  const t = easeOutCubic(progress);
  if (!origin || !rest || t <= 0) return null;
  const rect = lerpRect(origin, rest, t);
  const [a, b] = tailBase(origin, rect);
  const radius = Math.min(1.4, rect.w / 4, rect.h / 4);
  return (
    <svg
      className="demo-tableau-gallery__callout"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon
        className="demo-tableau-gallery__callout-shape"
        points={`${origin.x},${origin.y} ${a.x},${a.y} ${b.x},${b.y}`}
      />
      <rect
        className="demo-tableau-gallery__callout-shape"
        x={rect.x}
        y={rect.y}
        width={Math.max(rect.w, 0.2)}
        height={Math.max(rect.h, 0.2)}
        rx={radius}
        ry={radius}
      />
    </svg>
  );
}

const AnimatedGalleryCallout = memo(function AnimatedGalleryCallout({ origin, rest, durationMs }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const duration = Math.max(1, Number(durationMs) || 1);
    const tick = (now) => {
      if (!start) start = now;
      const next = Math.min(1, (now - start) / duration);
      setProgress(next);
      if (next < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [durationMs, origin, rest]);

  return <GalleryCallout origin={origin} rest={rest} progress={progress} />;
});

function DemoTableauGalleryLayer({ tableauRuntime = null, objects = [] }) {
  const gallery = tableauRuntime?.gallery || null;
  const phase = tableauRuntime?.phase || 'idle';
  const runId = tableauRuntime?.runId || 0;
  const images = gallery?.images || EMPTY_IMAGES;
  const reduced = prefersReducedMotion();
  const enterEffect = gallery?.enter_effect || 'center_zoom';

  const [aspects, setAspects] = useState({});
  const [framePhases, setFramePhases] = useState(() => makePhases(images.length, FRAME_PHASE.HIDDEN));
  const [origins, setOrigins] = useState({});
  const timersRef = useRef([]);

  const settleRects = useMemo(
    () => computeGallerySettleRects(images, gallery, aspects),
    [images, gallery, aspects],
  );
  const centerSpawnRects = useMemo(
    () => computeGalleryCenterSpawnRects(settleRects, aspects),
    [aspects, settleRects],
  );
  const spawnRects = useMemo(() => {
    if (enterEffect === 'center_zoom' || enterEffect === 'from_object') {
      return centerSpawnRects;
    }
    return computeGallerySpawnRects(settleRects, gallery);
  }, [centerSpawnRects, enterEffect, gallery, settleRects]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    if (enterEffect !== 'from_object') {
      setOrigins({});
      return undefined;
    }
    let cancelled = false;
    const collect = () => {
      const next = {};
      images.forEach((image) => {
        if (!image.target_id) return;
        const point = projectTargetOrigin(image.target_id, objects);
        if (point) next[image.id] = point;
      });
      if (!cancelled) setOrigins(next);
    };
    collect();
    const t1 = window.setTimeout(collect, 80);
    const t2 = window.setTimeout(collect, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [enterEffect, images, objects, runId]);

  useEffect(() => {
    clearTimers();
    if (!images.length) {
      setFramePhases([]);
      return undefined;
    }
    if (phase === 'exiting') {
      setFramePhases(makePhases(images.length, FRAME_PHASE.EXITING));
      return undefined;
    }
    if (reduced || phase === 'active') {
      setFramePhases(makePhases(images.length, FRAME_PHASE.SETTLED));
      return undefined;
    }

    setFramePhases(makePhases(images.length, FRAME_PHASE.HIDDEN));
    const stagger = gallery?.stagger_ms ?? 160;
    const enterMs = gallery?.enter_ms ?? 600;
    const holdMs = gallery?.hold_ms ?? 800;
    const settleMs = gallery?.settle_ms ?? 520;

    images.forEach((_, index) => {
      const startAt = reduced ? 0 : index * stagger;
      timersRef.current.push(window.setTimeout(() => {
        setFramePhases((prev) => {
          const next = prev.slice();
          next[index] = FRAME_PHASE.ENTERING;
          return next;
        });
      }, startAt));
      if (holdMs > 0) {
        timersRef.current.push(window.setTimeout(() => {
          setFramePhases((prev) => {
            const next = prev.slice();
            next[index] = FRAME_PHASE.HOLDING;
            return next;
          });
        }, startAt + enterMs));
      }
      timersRef.current.push(window.setTimeout(() => {
        setFramePhases((prev) => {
          const next = prev.slice();
          next[index] = FRAME_PHASE.SETTLING;
          return next;
        });
      }, startAt + enterMs + holdMs));
      timersRef.current.push(window.setTimeout(() => {
        setFramePhases((prev) => {
          const next = prev.slice();
          next[index] = FRAME_PHASE.SETTLED;
          return next;
        });
      }, startAt + enterMs + holdMs + settleMs));
    });
    return () => clearTimers();
  }, [
    gallery?.enter_ms,
    gallery?.hold_ms,
    gallery?.settle_ms,
    gallery?.stagger_ms,
    images,
    phase,
    reduced,
    runId,
  ]);

  if (!tableauRuntime?.active || !images.length) return null;

  const exitEffect = gallery?.exit_effect || 'fade_scale';
  const enterMs = gallery?.enter_ms ?? 600;
  const exitMs = gallery?.exit_ms ?? 420;
  const settleMs = gallery?.settle_ms ?? 520;

  return (
    <div
      className="demo-tableau-gallery"
      style={{
        '--gallery-enter-ms': `${enterMs}ms`,
        '--gallery-exit-ms': `${exitMs}ms`,
        '--gallery-settle-ms': `${settleMs}ms`,
      }}
    >
      {images.map((image, index) => {
        const src = resolveMediaUrl(image.src);
        if (!src) return null;
        const framePhase = framePhases[index] || FRAME_PHASE.HIDDEN;
        const origin = origins[image.id];
        const useCallout = enterEffect === 'from_object' && origin && !reduced;
        const spawn = spawnRects[index];
        const settle = settleRects[index];
        const useSettle = useCallout || framePhase === FRAME_PHASE.SETTLING
          || framePhase === FRAME_PHASE.SETTLED
          || framePhase === FRAME_PHASE.EXITING;
        const rect = useSettle ? settle : spawn;
        const shown = useCallout
          ? (framePhase !== FRAME_PHASE.HIDDEN && framePhase !== FRAME_PHASE.ENTERING)
          : framePhase !== FRAME_PHASE.HIDDEN;
        const frameEnter = useCallout ? 'from_object' : (
          enterEffect === 'from_object' ? 'center_zoom' : enterEffect
        );
        const frameClass = [
          'demo-tableau-gallery__frame',
          `is-${framePhase}`,
          shown ? 'is-shown' : '',
          framePhase === FRAME_PHASE.EXITING ? 'is-exiting' : '',
          `demo-tableau-gallery__frame--enter-${frameEnter}`,
          `demo-tableau-gallery__frame--exit-${exitEffect}`,
        ].filter(Boolean).join(' ');
        const style = {
          ...rectStyle({
            ...rect,
            z: (framePhase === FRAME_PHASE.ENTERING || framePhase === FRAME_PHASE.HOLDING)
              ? 80 + index
              : (rect?.z ?? index),
          }),
        };
        return (
          <Fragment key={image.id}>
            {useCallout && framePhase === FRAME_PHASE.ENTERING ? (
              <AnimatedGalleryCallout
                origin={origin}
                rest={settle}
                durationMs={enterMs}
              />
            ) : null}
            <figure
              className={frameClass}
              style={style}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                onLoad={(event) => {
                  const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
                  if (!w || !h) return;
                  const aspect = w / h;
                  setAspects((prev) => (
                    prev[image.id] === aspect ? prev : { ...prev, [image.id]: aspect }
                  ));
                }}
              />
            </figure>
          </Fragment>
        );
      })}
    </div>
  );
}

export default memo(DemoTableauGalleryLayer);
