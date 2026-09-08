import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import DashCrossZoneLayer from './DashCrossZoneLayer';
import {
  getZonePolygonStrokeStyle,
  getZoneStrokeStyle,
  usesDashCrossMarkers,
  ZONE_STROKE_WEIGHT,
} from '../../utils/actionZoneStyle';
import { getZonePolygonPositions, isPointInPolygon } from '../../utils/inundationZone';
import { isInundationZone, isPolygonZone, isTerrainZoneEnabled } from '../../utils/computeLosZone';
import { DEMO_EFFECT } from '../../utils/demoScenario';
import {
  demoFadeClassName,
  collapsePositionsToCentroid,
  MIN_REVEAL_RADIUS_M,
  resolveZoneDemoEffect,
  useCircleRevealAnimation,
  useDemoEffectCssVars,
  useDirectionalWipeAnimation,
  usePolygonRevealAnimation,
} from './demo/zoneDemoAnimations';
import './demo/DemoAnimations.css';

const VIEWPORT_DEBOUNCE_MS = 150;
const METERS_PER_DEG_LAT = 111320;
const EMPTY_ZONES = [];

function buildZoneEntryId(zone) {
  // Стабильный идентификатор на основе zoneKey (не зависит от позиции в
  // отфильтрованном по вьюпорту списке) — иначе Circle перемонтируется при
  // пане/зуме, что вызывает мерцание зон и потерю hover-состояния.
  return `zone-${zone.zoneKey}`;
}

function getZonesAtLatLng(zones, latlng, toleranceMeters = 1) {
  if (!latlng || !zones?.length) return [];
  const { lat, lng } = latlng;
  const point = L.latLng(lat, lng);
  const hits = [];
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i];
    if (zone.isPolygonZone && zone.polygonPositions?.length) {
      const bounds = zone.polygonBounds;
      if (
        bounds
        && (lat < bounds.minLat || lat > bounds.maxLat || lng < bounds.minLng || lng > bounds.maxLng)
      ) {
        continue;
      }
      if (isPointInPolygon(lat, lng, zone.polygonPositions)) hits.push(zone);
      continue;
    }
    const radius = (zone.radiusMeters || 0) + toleranceMeters;
    const latDelta = radius / METERS_PER_DEG_LAT;
    if (Math.abs(lat - zone.centerLat) > latDelta) continue;
    const cosLat = Math.max(0.2, Math.cos((zone.centerLat * Math.PI) / 180));
    if (Math.abs(lng - zone.centerLng) > latDelta / cosLat) continue;
    if (point.distanceTo(L.latLng(zone.centerLat, zone.centerLng)) <= radius) {
      hits.push(zone);
    }
  }
  return hits;
}

function isZoneInViewport(zone, bounds) {
  if (zone.polygonBounds) {
    const { minLat, maxLat, minLng, maxLng } = zone.polygonBounds;
    const zoneBounds = L.latLngBounds(
      [minLat, minLng],
      [maxLat, maxLng],
    );
    return bounds.intersects(zoneBounds);
  }

  const center = L.latLng(zone.centerLat, zone.centerLng);
  if (bounds.contains(center)) return true;
  const corners = [
    bounds.getNorthWest(),
    bounds.getNorthEast(),
    bounds.getSouthWest(),
    bounds.getSouthEast(),
  ];
  return corners.some((corner) => center.distanceTo(corner) <= zone.radiusMeters);
}

function useZonesInViewport(zones) {
  const map = useMap();
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const zonesKey = zones?.length ? zones.map((z) => z.zoneKey).join('|') : '';

  const filterZones = useCallback(() => {
    const list = zonesRef.current;
    if (!map || !list?.length) return list ?? EMPTY_ZONES;
    const bounds = map.getBounds().pad(0.1);
    return list.filter((zone) => isZoneInViewport(zone, bounds));
  }, [map]);

  const [inViewport, setInViewport] = useState(() => filterZones());

  useEffect(() => {
    let timeoutId = null;
    const schedule = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setInViewport(filterZones()), VIEWPORT_DEBOUNCE_MS);
    };

    schedule();
    map.on('moveend', schedule);
    map.on('zoomend', schedule);
    return () => {
      map.off('moveend', schedule);
      map.off('zoomend', schedule);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [map, filterZones, zonesKey]);

  return inViewport;
}

const ZoneCircleLayer = React.memo(function ZoneCircleLayer({
  zone,
  entryId,
  hoverController,
  onZonePointer,
  onZonePointerEnd,
  onZoneClick,
  demoEffect = null,
}) {
  const circleRef = useRef(null);
  const { obj, centerLat, centerLng, radiusMeters, color, lineType } = zone;
  const baseStyle = useMemo(() => getZoneStrokeStyle(color, lineType), [color, lineType]);

  useEffect(() => {
    const layer = circleRef.current;
    if (!layer || !hoverController) return undefined;
    hoverController.register(entryId, {
      objId: obj.id,
      layers: [layer],
      baseStyle,
    });
    return () => hoverController.unregister(entryId);
  }, [entryId, obj.id, hoverController, baseStyle]);

  const revealEnabled = demoEffect?.effect === DEMO_EFFECT.REVEAL_FROM_CENTER;

  useCircleRevealAnimation(circleRef, {
    enabled: revealEnabled,
    runId: demoEffect?.runId ?? 0,
    radiusMeters,
    durationMs: demoEffect?.durationMs ?? 0,
    delayMs: demoEffect?.delayMs ?? 0,
    easing: demoEffect?.easing,
    continuous: Boolean(demoEffect?.continuous),
    animationKey: entryId,
  });
  useDemoEffectCssVars(circleRef, demoEffect);

  const pointerHandlers = useMemo(() => ({
    mouseover: (e) => onZonePointer?.(e),
    mouseout: () => onZonePointerEnd?.(),
    click: onZoneClick,
  }), [onZonePointer, onZonePointerEnd, onZoneClick]);

  const className = demoFadeClassName('action-radius-circle', demoEffect);
  const pathOptions = useMemo(() => ({
    color,
    fillColor: color,
    fillOpacity: baseStyle.fillOpacity,
    weight: ZONE_STROKE_WEIGHT,
    opacity: baseStyle.opacity,
    dashArray: baseStyle.dashArray,
    className,
    interactive: true,
  }), [color, baseStyle, className]);

  return (
    <Circle
      ref={circleRef}
      center={[centerLat, centerLng]}
      radius={revealEnabled ? MIN_REVEAL_RADIUS_M : radiusMeters}
      pathOptions={pathOptions}
      eventHandlers={pointerHandlers}
    />
  );
});

const ZonePolygonLayer = React.memo(function ZonePolygonLayer({
  zone,
  entryId,
  positions,
  hoverController,
  onZonePointer,
  onZonePointerEnd,
  onZoneClick,
  polygonClassName = 'action-radius-polygon action-radius-polygon--los',
  inundation = false,
  demoEffect = null,
}) {
  const polygonRef = useRef(null);
  const { obj, color, lineType, centerLat, centerLng } = zone;
  const baseStyle = useMemo(
    () => getZonePolygonStrokeStyle(color, lineType, { inundation }),
    [color, lineType, inundation],
  );
  const centroid = useMemo(() => ({ lat: centerLat, lng: centerLng }), [centerLat, centerLng]);
  const revealEnabled = demoEffect?.effect === DEMO_EFFECT.REVEAL_FROM_CENTER;
  const wipeEnabled = demoEffect?.effect === DEMO_EFFECT.DIRECTIONAL_WIPE;
  const renderPositions = useMemo(
    () => (revealEnabled ? collapsePositionsToCentroid(positions, centroid) : positions),
    [revealEnabled, centroid, positions],
  );

  useEffect(() => {
    const layer = polygonRef.current;
    if (!layer || !hoverController) return undefined;
    hoverController.register(entryId, {
      objId: obj.id,
      layers: [layer],
      baseStyle,
    });
    return () => hoverController.unregister(entryId);
  }, [entryId, obj.id, hoverController, baseStyle]);

  usePolygonRevealAnimation(polygonRef, {
    enabled: revealEnabled,
    runId: demoEffect?.runId ?? 0,
    positions,
    centroid,
    durationMs: demoEffect?.durationMs ?? 0,
    delayMs: demoEffect?.delayMs ?? 0,
    easing: demoEffect?.easing,
    continuous: Boolean(demoEffect?.continuous),
    animationKey: entryId,
  });

  useDirectionalWipeAnimation(polygonRef, {
    enabled: wipeEnabled,
    runId: demoEffect?.runId ?? 0,
    positions,
    direction: demoEffect?.direction,
    durationMs: demoEffect?.durationMs ?? 0,
    delayMs: demoEffect?.delayMs ?? 0,
    easing: demoEffect?.easing,
    continuous: Boolean(demoEffect?.continuous),
    animationKey: entryId,
  });
  useDemoEffectCssVars(polygonRef, demoEffect);

  const pointerHandlers = useMemo(() => ({
    mouseover: (e) => onZonePointer?.(e),
    mouseout: () => onZonePointerEnd?.(),
    click: onZoneClick,
  }), [onZonePointer, onZonePointerEnd, onZoneClick]);

  const className = demoFadeClassName(polygonClassName, demoEffect);
  const pathOptions = useMemo(() => ({
    color,
    fillColor: color,
    fillOpacity: baseStyle.fillOpacity,
    weight: ZONE_STROKE_WEIGHT,
    opacity: baseStyle.opacity,
    dashArray: baseStyle.dashArray,
    className,
    interactive: true,
  }), [color, baseStyle, className]);

  if (!positions?.length) return null;

  return (
    <Polygon
      ref={polygonRef}
      positions={renderPositions}
      pathOptions={pathOptions}
      eventHandlers={pointerHandlers}
    />
  );
});

const ActionZonesLayer = React.memo(function ActionZonesLayer({
  visibleZones: visibleZonesProp,
  hoverController,
  skipHoverRef,
  isZonePanelPinned = false,
  onZoneClickAt,
  onZoneHoverChange,
  considerTerrain,
  losGeometryByZoneKey = {},
  demoAnimation = null,
}) {
  const visibleZones = visibleZonesProp ?? EMPTY_ZONES;

  const zonesInViewport = useZonesInViewport(visibleZones);

  const zonesWithEntryIds = useMemo(
    () => zonesInViewport.map((zone) => ({
      ...zone,
      entryId: buildZoneEntryId(zone),
    })),
    [zonesInViewport],
  );

  const zonesRef = useRef(zonesWithEntryIds);
  zonesRef.current = zonesWithEntryIds;

  const lastHoverKeyRef = useRef('');

  const applyZoneHover = useCallback((e) => {
    if (skipHoverRef?.current || isZonePanelPinned) return;
    const candidates = getZonesAtLatLng(zonesRef.current, e.latlng);
    const key = candidates.map((z) => z.entryId).sort().join('|');
    if (key === lastHoverKeyRef.current) return;
    lastHoverKeyRef.current = key;
    hoverController?.setHoveredEntries(candidates.map((z) => z.entryId));
    if (!isZonePanelPinned) {
      onZoneHoverChange?.(candidates);
    }
  }, [hoverController, skipHoverRef, onZoneHoverChange, isZonePanelPinned]);

  const clearZoneHover = useCallback(() => {
    if (skipHoverRef?.current || isZonePanelPinned) return;
    lastHoverKeyRef.current = '';
    hoverController?.clear();
    onZoneHoverChange?.(null);
  }, [hoverController, skipHoverRef, onZoneHoverChange, isZonePanelPinned]);

  const handleZoneClick = useCallback((e) => {
    L.DomEvent.stop(e);
    onZoneClickAt?.(e, getZonesAtLatLng(zonesRef.current, e.latlng));
  }, [onZoneClickAt]);

  return (
    <>
      {zonesWithEntryIds.map((zone) => {
        const useTerrainLos = isTerrainZoneEnabled(zone, considerTerrain);
        const usePolygon = isPolygonZone(zone);
        const useInundationStyle = isInundationZone(zone);
        const demoEffect = resolveZoneDemoEffect(zone, demoAnimation);
        const geometry = useTerrainLos
          ? (losGeometryByZoneKey[zone.zoneKey] || zone.zoneGeometry)
          : null;
        const terrainPolygonPositions = useTerrainLos
          ? getZonePolygonPositions(geometry)
          : null;
        const polygonPositions = usePolygon
          ? zone.polygonPositions
          : null;

        if (usePolygon && polygonPositions) {
          return (
            <ZonePolygonLayer
              key={zone.entryId}
              zone={zone}
              entryId={zone.entryId}
              positions={polygonPositions}
              hoverController={hoverController}
              onZonePointer={applyZoneHover}
              onZonePointerEnd={clearZoneHover}
              onZoneClick={handleZoneClick}
              polygonClassName={useInundationStyle
                ? 'action-radius-polygon action-radius-polygon--inundation'
                : 'action-radius-polygon action-radius-polygon--polygon'}
              inundation={useInundationStyle}
              demoEffect={demoEffect}
            />
          );
        }

        if (useTerrainLos && terrainPolygonPositions) {
          return (
            <ZonePolygonLayer
              key={zone.entryId}
              zone={zone}
              entryId={zone.entryId}
              positions={terrainPolygonPositions}
              hoverController={hoverController}
              onZonePointer={applyZoneHover}
              onZonePointerEnd={clearZoneHover}
              onZoneClick={handleZoneClick}
              demoEffect={demoEffect}
            />
          );
        }

        if (usesDashCrossMarkers(zone.lineType)) {
          return (
            <DashCrossZoneLayer
              key={zone.entryId}
              entryId={zone.entryId}
              objId={zone.obj.id}
              hoverController={hoverController}
              centerLat={zone.centerLat}
              centerLng={zone.centerLng}
              radiusMeters={zone.radiusMeters}
              color={zone.color}
              onZonePointer={applyZoneHover}
              onZonePointerEnd={clearZoneHover}
              onZoneClick={handleZoneClick}
            />
          );
        }
        return (
          <ZoneCircleLayer
            key={zone.entryId}
            zone={zone}
            entryId={zone.entryId}
            hoverController={hoverController}
            onZonePointer={applyZoneHover}
            onZonePointerEnd={clearZoneHover}
            onZoneClick={handleZoneClick}
            demoEffect={demoEffect}
          />
        );
      })}
    </>
  );
});

export default ActionZonesLayer;
