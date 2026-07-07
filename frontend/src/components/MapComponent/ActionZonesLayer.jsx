import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import DashCrossZoneLayer from './DashCrossZoneLayer';
import { buildVisibleZones } from '../../utils/buildVisibleZones';
import {
  getZonePolygonStrokeStyle,
  getZoneStrokeStyle,
  usesDashCrossMarkers,
  ZONE_CENTER_HIGHLIGHT_WEIGHT,
  ZONE_STROKE_WEIGHT,
} from '../../utils/actionZoneStyle';
import { getZonePolygonPositions, isInundationZone, isPolygonZone, isTerrainZoneEnabled } from '../../utils/computeLosZone';
import { isPointInPolygon } from '../../utils/inundationZone';

const VIEWPORT_DEBOUNCE_MS = 150;

function buildZoneEntryId(zone) {
  // Стабильный идентификатор на основе zoneKey (не зависит от позиции в
  // отфильтрованном по вьюпорту списке) — иначе Circle перемонтируется при
  // пане/зуме, что вызывает мерцание зон и потерю hover-состояния.
  return `zone-${zone.zoneKey}`;
}

function getZonesAtLatLng(zones, latlng, toleranceMeters = 1) {
  if (!latlng || !zones?.length) return [];
  const point = L.latLng(latlng.lat, latlng.lng);
  return zones.filter((zone) => {
    if (zone.isPolygonZone && zone.polygonPositions?.length) {
      return isPointInPolygon(latlng.lat, latlng.lng, zone.polygonPositions);
    }
    const dist = L.latLng(zone.centerLat, zone.centerLng).distanceTo(point);
    return dist <= zone.radiusMeters + toleranceMeters;
  });
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

  const filterZones = useCallback(() => {
    const list = zonesRef.current;
    if (!map || !list?.length) return list ?? [];
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
  }, [map, filterZones]);

  useEffect(() => {
    const timer = setTimeout(() => setInViewport(filterZones()), VIEWPORT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [zones, filterZones]);

  return inViewport;
}

function ZoneCircleLayer({
  zone,
  entryId,
  hoverController,
  onZonePointer,
  onZonePointerEnd,
  onZoneClick,
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

  const pointerHandlers = useMemo(() => ({
    mouseover: (e) => onZonePointer?.(e),
    mouseout: () => onZonePointerEnd?.(),
    click: onZoneClick,
  }), [onZonePointer, onZonePointerEnd, onZoneClick]);

  return (
    <Circle
      ref={circleRef}
      center={[centerLat, centerLng]}
      radius={radiusMeters}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: baseStyle.fillOpacity,
        weight: ZONE_STROKE_WEIGHT,
        opacity: baseStyle.opacity,
        dashArray: baseStyle.dashArray,
        className: 'action-radius-circle',
        interactive: true,
      }}
      eventHandlers={pointerHandlers}
    />
  );
}

function ZonePolygonLayer({
  zone,
  entryId,
  positions,
  hoverController,
  onZonePointer,
  onZonePointerEnd,
  onZoneClick,
  polygonClassName = 'action-radius-polygon action-radius-polygon--los',
  inundation = false,
}) {
  const polygonRef = useRef(null);
  const { obj, color, lineType } = zone;
  const baseStyle = useMemo(
    () => getZonePolygonStrokeStyle(color, lineType, { inundation }),
    [color, lineType, inundation],
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

  const pointerHandlers = useMemo(() => ({
    mouseover: (e) => onZonePointer?.(e),
    mouseout: () => onZonePointerEnd?.(),
    click: onZoneClick,
  }), [onZonePointer, onZonePointerEnd, onZoneClick]);

  if (!positions?.length) return null;

  return (
    <Polygon
      ref={polygonRef}
      positions={positions}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: baseStyle.fillOpacity,
        weight: ZONE_STROKE_WEIGHT,
        opacity: baseStyle.opacity,
        dashArray: baseStyle.dashArray,
        className: polygonClassName,
        interactive: true,
      }}
      eventHandlers={pointerHandlers}
    />
  );
}

const ActionZonesLayer = React.memo(function ActionZonesLayer({
  zoneObjects = [],
  actionZoneFilters,
  visibleZones: visibleZonesProp,
  hoverController,
  skipHoverRef,
  isZonePanelPinned = false,
  onZoneClickAt,
  onZoneHoverChange,
  considerTerrain,
  losGeometryByActionId = {},
}) {
  const visibleZones = useMemo(
    () => visibleZonesProp ?? buildVisibleZones(zoneObjects, actionZoneFilters),
    [visibleZonesProp, zoneObjects, actionZoneFilters],
  );

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

  const highlightByCenter = useMemo(() => {
    const map = new Map();
    zonesWithEntryIds.forEach((zone) => {
      const key = `${zone.centerLat.toFixed(6)},${zone.centerLng.toFixed(6)}`;
      if (!map.has(key)) {
        map.set(key, { lat: zone.centerLat, lng: zone.centerLng, color: zone.color, objId: zone.obj.id });
      }
    });
    return map;
  }, [zonesWithEntryIds]);

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
      {Array.from(highlightByCenter.entries()).map(([key, info]) => (
        <ZoneCenterHighlight
          key={`zone-highlight-${key}`}
          centerKey={key}
          lat={info.lat}
          lng={info.lng}
          color={info.color}
          objId={info.objId}
          hoverController={hoverController}
        />
      ))}
      {zonesWithEntryIds.map((zone) => {
        const useTerrainLos = isTerrainZoneEnabled(zone, considerTerrain);
        const usePolygon = isPolygonZone(zone);
        const useInundationStyle = isInundationZone(zone);
        const geometry = useTerrainLos
          ? (losGeometryByActionId[zone.actionId] || zone.zoneGeometry)
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
          />
        );
      })}
    </>
  );
});

function ZoneCenterHighlight({ centerKey, lat, lng, color, objId, hoverController }) {
  const markerRef = useRef(null);
  const entryId = `zone-highlight-${centerKey}`;

  useEffect(() => {
    const layer = markerRef.current;
    if (!layer || !hoverController) return undefined;
    hoverController.register(entryId, {
      objId,
      layers: [],
      highlightLayer: layer,
      baseStyle: { color },
    });
    return () => hoverController.unregister(entryId);
  }, [entryId, objId, color, hoverController]);

  return (
    <CircleMarker
      ref={markerRef}
      center={[lat, lng]}
      radius={11}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.18,
        weight: ZONE_CENTER_HIGHLIGHT_WEIGHT,
        opacity: 0.9,
        className: 'action-radius-marker-highlight',
        interactive: false,
      }}
    />
  );
}

export default ActionZonesLayer;
