import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { resolveMediaUrl } from '../../utils/mediaUrl';
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

function DemoTableauGalleryLayer({ tableauRuntime = null }) {
  const gallery = tableauRuntime?.gallery || null;
  const phase = tableauRuntime?.phase || 'idle';
  const runId = tableauRuntime?.runId || 0;
  const images = gallery?.images || [];
  const reduced = prefersReducedMotion();

  const [aspects, setAspects] = useState({});
  const [framePhases, setFramePhases] = useState(() => makePhases(images.length, FRAME_PHASE.HIDDEN));
  const timersRef = useRef([]);

  const settleRects = useMemo(
    () => computeGallerySettleRects(images, gallery, aspects),
    [images, gallery, aspects],
  );
  const spawnRects = useMemo(() => {
    if (gallery?.enter_effect === 'center_zoom') {
      return computeGalleryCenterSpawnRects(settleRects, aspects);
    }
    return computeGallerySpawnRects(settleRects, gallery);
  }, [aspects, gallery, settleRects]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

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

  const enterEffect = gallery?.enter_effect || 'center_zoom';
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
        const spawn = spawnRects[index];
        const settle = settleRects[index];
        const useSettle = framePhase === FRAME_PHASE.SETTLING
          || framePhase === FRAME_PHASE.SETTLED
          || framePhase === FRAME_PHASE.EXITING;
        const rect = useSettle ? settle : spawn;
        const shown = framePhase !== FRAME_PHASE.HIDDEN;
        const frameClass = [
          'demo-tableau-gallery__frame',
          `is-${framePhase}`,
          shown ? 'is-shown' : '',
          framePhase === FRAME_PHASE.EXITING ? 'is-exiting' : '',
          `demo-tableau-gallery__frame--enter-${enterEffect}`,
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
          <figure
            key={image.id}
            className={frameClass}
            style={style}
          >
            <img
              src={src}
              alt={image.title || ''}
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
            {image.title ? (
              <figcaption>{image.title}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

export default memo(DemoTableauGalleryLayer);
