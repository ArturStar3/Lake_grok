import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findTableauBlock,
  DEMO_TABLEAU_MAP_FRAME,
  buildTableauOverlayArrows,
  overlayGridStyle,
  cellAlignStyle,
  bridgeSpacerPercent,
} from '../../utils/demoScenario';
import DemoTableauArrowSpark from './DemoTableauArrowSpark';
import DemoTableauBlockView from './DemoTableauBlockView';
import './DemoTableauBlockView.css';
import './DemoTableau.css';

/**
 * Художественный режим: наклон карты, grid-оверлей и ортогональные стрелки.
 */

const ARROW_DASH = {
  solid: 'none',
  dashed: '6 5',
  dotted: '2 3',
};

const ARROW_HEAD_LEN = 1.4;
const SPARK_TRAVEL_MS = 1600;
const SPARK_GAP_MIN_MS = 220;
const SPARK_GAP_MAX_MS = 1000;
/** Пауза после overlaysReady: не стартовать искру в кадре invalidateSize/reveal. */
const SPARK_SETTLE_MS = 280;

function resolveArrowDash(line) {
  if (line === 'solid') return 'none';
  return ARROW_DASH[line] || ARROW_DASH.dashed;
}

function shortenPolylineForHead(points, headLen = ARROW_HEAD_LEN) {
  if (!points?.length || points.length < 2) return points || [];
  const out = points.map((p) => ({ ...p }));
  const last = out.length - 1;
  const a = out[last - 1];
  const b = out[last];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const trim = Math.min(headLen, len * 0.35);
  out[last] = {
    x: b.x - (dx / len) * trim,
    y: b.y - (dy / len) * trim,
  };
  return out;
}

function arrowHeadPoints(xTip, yTip, xBase, yBase, halfWidth = ARROW_HEAD_LEN * 0.45) {
  const dx = xTip - xBase;
  const dy = yTip - yBase;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * halfWidth;
  const py = (dx / len) * halfWidth;
  return [
    `${xTip},${yTip}`,
    `${xBase + px},${yBase + py}`,
    `${xBase - px},${yBase - py}`,
  ].join(' ');
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function arrowsGeometryKey(items) {
  if (!items?.length) return '';
  return items.map((item) => {
    const pts = (item.points || []).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';');
    return `${item.id}:${pts}:${item.color}`;
  }).join('|');
}

function pointsToSvg(points) {
  return (points || []).map((p) => `${p.x},${p.y}`).join(' ');
}

function prepareArrowDrawables(overlayArrows) {
  return (overlayArrows || []).map((arrow) => {
    const pts = arrow.points || [];
    if (pts.length < 2) {
      return { id: arrow.id, skip: true };
    }
    const needsHead = arrow.head === 'end' || arrow.head === 'both';
    const drawn = needsHead ? shortenPolylineForHead(pts) : pts;
    const tip = pts[pts.length - 1];
    const base = drawn[drawn.length - 1];
    return {
      id: arrow.id,
      skip: false,
      points: pts,
      color: arrow.color,
      width: arrow.width ?? 1.5,
      dash: resolveArrowDash(arrow.line),
      svgPoints: pointsToSvg(drawn),
      needsHead,
      headSvg: needsHead ? arrowHeadPoints(tip.x, tip.y, base.x, base.y) : null,
    };
  }).filter((item) => !item.skip);
}

function DemoTableauShell({
  tableauRuntime = null,
  mapRef = null,
  children,
}) {
  const [tilted, setTilted] = useState(false);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const [spark, setSpark] = useState(null);
  const sparkCtlRef = useRef({ schedule: null, cancelled: true, lastId: null });
  const overlayArrowsRef = useRef([]);

  const active = Boolean(tableauRuntime?.active);
  const phase = tableauRuntime?.phase || (active ? 'active' : 'idle');
  const tilt = tableauRuntime?.tilt || {};
  const blocks = tableauRuntime?.blocks || [];
  const overlay = tableauRuntime?.overlay || null;
  const caption = tableauRuntime?.caption || null;
  const tiltMs = tableauRuntime?.tiltMs ?? 700;
  const untiltMs = tableauRuntime?.untiltMs ?? 700;
  const borderRadius = tableauRuntime?.borderRadiusPx ?? 14;
  const runId = tableauRuntime?.runId || 0;
  const overlaysVisible = active && overlaysReady && phase !== 'exiting';

  const mapFrame = useMemo(() => {
    const offsetY = tilt.offset_y ?? 0;
    return {
      left: DEMO_TABLEAU_MAP_FRAME.left,
      top: DEMO_TABLEAU_MAP_FRAME.top + offsetY,
      width: DEMO_TABLEAU_MAP_FRAME.width,
      height: DEMO_TABLEAU_MAP_FRAME.height,
    };
  }, [tilt.offset_y]);

  const overlayCells = useMemo(() => {
    if (!overlaysVisible || !overlay?.cells?.length) return [];
    return overlay.cells.filter((cell) => cell.block_id);
  }, [overlaysVisible, overlay]);

  const overlayArrows = useMemo(() => {
    if (!overlaysVisible || !overlay) return [];
    return buildTableauOverlayArrows(overlay, mapFrame);
  }, [overlaysVisible, overlay, mapFrame]);

  overlayArrowsRef.current = overlayArrows;
  const arrowsKey = useMemo(() => arrowsGeometryKey(overlayArrows), [overlayArrows]);

  const arrowDrawables = useMemo(
    () => prepareArrowDrawables(overlayArrows),
    // geometry already keyed; avoid re-trim on identical paths
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arrowsKey],
  );

  const rootStyle = useMemo(() => {
    if (!active) return undefined;
    const perspective = tilt.perspective || 1200;
    const rotateX = tilt.rotate_x ?? 58;
    const rotateZ = tilt.rotate_z ?? -8;
    const scale = tilt.scale ?? 0.92;
    const offsetY = tilt.offset_y ?? 0;
    const transitionMs = phase === 'exiting' ? untiltMs : tiltMs;
    return {
      perspective: `${perspective}px`,
      '--tableau-rotate-x': `${rotateX}deg`,
      '--tableau-rotate-z': `${rotateZ}deg`,
      '--tableau-scale': scale,
      '--tableau-offset-y': `${offsetY}%`,
      '--tableau-radius': `${borderRadius}px`,
      '--tableau-tilt-ms': `${transitionMs}ms`,
    };
  }, [
    active,
    borderRadius,
    phase,
    tilt.perspective,
    tilt.rotate_x,
    tilt.rotate_z,
    tilt.scale,
    tilt.offset_y,
    tiltMs,
    untiltMs,
  ]);

  const gridStyle = useMemo(() => overlayGridStyle(overlay), [overlay]);

  useEffect(() => {
    if (!active) {
      setTilted(false);
      setOverlaysReady(false);
      return undefined;
    }
    setTilted(false);
    setOverlaysReady(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setTilted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [active, runId]);

  useEffect(() => {
    if (!active) return undefined;
    if (phase === 'exiting') {
      setTilted(false);
      setOverlaysReady(false);
    }
    return undefined;
  }, [active, phase]);

  useEffect(() => {
    if (!active || !tilted || phase === 'exiting') return undefined;
    const map = mapRef?.current;
    if (!map) return undefined;
    const delay = Math.min(tiltMs + 40, 1200);
    const t = window.setTimeout(() => {
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        try { map.invalidateSize(); } catch { /* ignore */ }
      }
      try {
        map.eachLayer?.((layer) => {
          const ml = layer.getMaplibreMap?.();
          ml?.resize?.();
        });
      } catch { /* ignore */ }
    }, delay);
    const dragging = map.dragging;
    const scroll = map.scrollWheelZoom;
    const wasDragging = dragging?.enabled?.();
    const wasScroll = scroll?.enabled?.();
    dragging?.disable?.();
    scroll?.disable?.();
    return () => {
      clearTimeout(t);
      if (wasDragging) dragging?.enable?.();
      if (wasScroll) scroll?.enable?.();
    };
  }, [active, mapRef, phase, runId, tiltMs, tilted]);

  useEffect(() => {
    if (!active || phase !== 'exiting') return undefined;
    const map = mapRef?.current;
    if (!map) return undefined;
    const restoreSize = () => {
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        try { map.invalidateSize(); } catch { /* ignore */ }
      }
      try {
        map.eachLayer?.((layer) => {
          const ml = layer.getMaplibreMap?.();
          ml?.resize?.();
        });
      } catch { /* ignore */ }
    };
    const delay = Math.min(untiltMs + 40, 1200);
    const t0 = window.setTimeout(restoreSize, delay);
    const t1 = window.setTimeout(restoreSize, delay + 120);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [active, mapRef, phase, runId, untiltMs]);

  useEffect(() => {
    if (active) return undefined;
    const map = mapRef?.current;
    if (!map) return undefined;
    const restoreSize = () => {
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        try { map.invalidateSize(); } catch { /* ignore */ }
      }
      try {
        map.eachLayer?.((layer) => {
          const ml = layer.getMaplibreMap?.();
          ml?.resize?.();
        });
      } catch { /* ignore */ }
    };
    const t0 = window.setTimeout(restoreSize, 0);
    const t1 = window.setTimeout(restoreSize, 100);
    const t2 = window.setTimeout(restoreSize, 280);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, mapRef, runId]);

  useEffect(() => {
    if (!active || phase === 'exiting') {
      setOverlaysReady(false);
      return undefined;
    }
    if (!tilted) {
      setOverlaysReady(false);
      return undefined;
    }

    let raf = 0;
    let timer = 0;
    const settleMs = prefersReducedMotion() ? 0 : Math.min(tiltMs + 48, 1200);
    timer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setOverlaysReady(true));
      });
    }, settleMs);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [active, phase, runId, tiltMs, tilted]);

  useEffect(() => {
    const sparkReady = overlaysVisible
      && phase === 'active'
      && Boolean(arrowsKey)
      && !prefersReducedMotion();

    if (!sparkReady) {
      setSpark(null);
      sparkCtlRef.current.cancelled = true;
      sparkCtlRef.current.schedule = null;
      sparkCtlRef.current.lastId = null;
      return undefined;
    }

    let cancelled = false;
    let timer = 0;
    const ctl = sparkCtlRef.current;
    ctl.cancelled = false;

    const pickNext = () => {
      const list = overlayArrowsRef.current;
      if (!list.length) return null;
      if (list.length === 1) return list[0];
      const lastId = ctl.lastId;
      const candidates = lastId
        ? list.filter((item) => item.id !== lastId)
        : list;
      const pool = candidates.length ? candidates : list;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const scheduleNext = (delay) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(runOnce, delay);
    };

    const runOnce = () => {
      if (cancelled) return;
      const next = pickNext();
      if (!next) {
        scheduleNext(SPARK_GAP_MAX_MS);
        return;
      }
      ctl.lastId = next.id;
      setSpark((prev) => ({
        id: next.id,
        points: next.points,
        color: next.color,
        runToken: (prev?.runToken || 0) + 1,
      }));
    };

    ctl.schedule = scheduleNext;
    scheduleNext(SPARK_SETTLE_MS);
    return () => {
      cancelled = true;
      ctl.cancelled = true;
      ctl.schedule = null;
      window.clearTimeout(timer);
    };
  }, [overlaysVisible, arrowsKey, runId, phase]);

  const onSparkComplete = useCallback(() => {
    if (sparkCtlRef.current.cancelled) return;
    sparkCtlRef.current.schedule?.(randomBetween(SPARK_GAP_MIN_MS, SPARK_GAP_MAX_MS));
  }, []);

  return (
    <div
      className={[
        'demo-tableau',
        active ? 'demo-tableau--active' : 'demo-tableau--idle',
        active && tilted ? 'demo-tableau--tilted' : '',
        phase === 'exiting' ? 'demo-tableau--exiting' : '',
      ].filter(Boolean).join(' ')}
      style={rootStyle}
    >
      <div className="demo-tableau__plane">
        <div className="demo-tableau__map">
          {children}
        </div>
      </div>

      {active && (
        <>
          <svg
            className="demo-tableau__arrows"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {arrowDrawables.map((arrow) => (
              <g key={arrow.id} className="demo-tableau__arrow">
                <polyline
                  className="demo-tableau__arrow-line"
                  points={arrow.svgPoints}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    stroke: arrow.color,
                    strokeWidth: arrow.width,
                    strokeDasharray: arrow.dash,
                  }}
                />
                {arrow.needsHead ? (
                  <polygon
                    className="demo-tableau__arrow-head"
                    points={arrow.headSvg}
                    fill={arrow.color}
                  />
                ) : null}
              </g>
            ))}
            {spark ? (
              <DemoTableauArrowSpark
                points={spark.points}
                color={spark.color}
                durationMs={SPARK_TRAVEL_MS}
                runToken={spark.runToken}
                onComplete={onSparkComplete}
              />
            ) : null}
          </svg>

          {caption?.content ? (
            <div
              className={[
                'demo-tableau__caption',
                overlaysVisible ? 'demo-tableau__caption--visible' : '',
              ].filter(Boolean).join(' ')}
              style={{
                left: `${caption.x}%`,
                top: `${caption.y}%`,
                fontFamily: caption.font_family || 'Roboto',
                fontSize: `${caption.font_size ?? 17}px`,
                fontWeight: caption.font_weight ?? 700,
                color: caption.color || '#f8fafc',
                background: caption.background || 'rgba(15, 23, 42, 0.82)',
                border: `${caption.border?.width ?? 1}px solid ${caption.border?.color || 'rgba(255, 255, 255, 0.28)'}`,
              }}
            >
              {caption.content}
            </div>
          ) : null}

          {overlay && overlaysVisible ? (
            <div className="demo-tableau__grid" style={gridStyle}>
              {overlayCells.map((cell) => {
                const block = findTableauBlock(blocks, cell.block_id);
                if (!block) return null;
                const isBridge = cell.role === 'bridge';
                const spacerPct = isBridge ? bridgeSpacerPercent(overlay, cell) : 0;
                const align = cellAlignStyle(cell);
                const blockView = (
                  <DemoTableauBlockView
                    block={block}
                    enableBlur={false}
                    className="demo-tableau__placement-block"
                    style={{
                      width: `${cell.content_width ?? 100}%`,
                      height: `${cell.content_height ?? 100}%`,
                    }}
                  />
                );
                return (
                  <div
                    key={cell.id}
                    className={[
                      'demo-tableau__grid-cell',
                      isBridge ? 'demo-tableau__grid-cell--bridge' : '',
                    ].filter(Boolean).join(' ')}
                    style={{
                      gridColumn: `${cell.col + 1} / span ${cell.col_span || 1}`,
                      gridRow: `${cell.row + 1}`,
                      ...(spacerPct > 0
                        ? { flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch' }
                        : align),
                    }}
                  >
                    {spacerPct > 0 ? (
                      <>
                        <div
                          className="demo-tableau__bridge-spacer"
                          style={{ height: `${spacerPct}%`, flexShrink: 0, width: '100%' }}
                          aria-hidden="true"
                        />
                        <div
                          className="demo-tableau__bridge-body"
                          style={{
                            flex: 1,
                            minHeight: 0,
                            width: '100%',
                            display: 'flex',
                            ...align,
                          }}
                        >
                          {blockView}
                        </div>
                      </>
                    ) : blockView}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default memo(DemoTableauShell);
