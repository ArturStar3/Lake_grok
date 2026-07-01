import { useEffect, useMemo, useRef } from 'react';
import { Circle, Polyline } from 'react-leaflet';
import {
  computeDashCrossCount,
  generateCircleRing,
  generateDashCrossMarkers,
} from '../../utils/actionZoneGeometry';

/**
 * Зона действия с типом линии «Тире крест» (dash_x).
 */
export default function DashCrossZoneLayer({
  entryId,
  objId,
  hoverController,
  centerLat,
  centerLng,
  radiusMeters,
  color,
  onZonePointer,
  onZonePointerEnd,
  onZoneClick,
}) {
  const fillRef = useRef(null);
  const ringRef = useRef(null);
  const crossRefs = useRef([]);

  const ring = useMemo(
    () => generateCircleRing(centerLat, centerLng, radiusMeters),
    [centerLat, centerLng, radiusMeters],
  );

  const crossCount = useMemo(
    () => computeDashCrossCount(radiusMeters),
    [radiusMeters],
  );

  const crosses = useMemo(
    () => generateDashCrossMarkers(centerLat, centerLng, radiusMeters, crossCount),
    [centerLat, centerLng, radiusMeters, crossCount],
  );

  const baseStyle = useMemo(() => ({
    color,
    weight: 2,
    hoverWeight: 3.5,
    opacity: 0.65,
    hoverOpacity: 0.95,
    dashArray: '16, 14',
    fillColor: color,
    fillOpacity: 0.09,
  }), [color]);

  useEffect(() => {
    crossRefs.current = [];
  }, [crosses]);

  useEffect(() => {
    if (!hoverController) return undefined;
    let cancelled = false;
    const registerLayers = () => {
      if (cancelled) return;
      const layers = [
        ringRef.current ? { layer: ringRef.current, cross: false } : null,
        ...crossRefs.current
          .filter(Boolean)
          .map((layer) => ({ layer, cross: true })),
      ].filter(Boolean);
      if (layers.length === 0) return;
      hoverController.register(entryId, { objId, layers, baseStyle });
    };
    const frameId = requestAnimationFrame(registerLayers);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      hoverController.unregister(entryId);
    };
  }, [entryId, objId, hoverController, baseStyle, crosses]);

  const pointerHandlers = useMemo(() => ({
    mouseover: (e) => onZonePointer?.(e),
    mouseout: () => onZonePointerEnd?.(),
    click: onZoneClick,
  }), [onZonePointer, onZonePointerEnd, onZoneClick]);

  return (
    <>
      <Circle
        ref={fillRef}
        center={[centerLat, centerLng]}
        radius={radiusMeters}
        pathOptions={{
          color: 'transparent',
          fillColor: color,
          fillOpacity: 0.09,
          weight: 0,
          interactive: true,
          className: 'action-radius-circle',
        }}
        eventHandlers={pointerHandlers}
      />
      <Polyline
        ref={ringRef}
        positions={ring}
        pathOptions={{
          color,
          weight: 2,
          opacity: 0.65,
          dashArray: '16, 14',
          interactive: false,
        }}
      />
      {crosses.map((cross, crossIndex) =>
        cross.lines.map((positions, lineIndex) => (
          <Polyline
            key={`dash-x-${entryId}-${crossIndex}-${lineIndex}`}
            ref={(layer) => {
              crossRefs.current[crossIndex * 2 + lineIndex] = layer;
            }}
            positions={positions}
            pathOptions={{
              color,
              weight: 2.5,
              opacity: 0.8,
              interactive: false,
            }}
          />
        )),
      )}
    </>
  );
}
