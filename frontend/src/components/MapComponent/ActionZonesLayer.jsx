import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import DashCrossZoneLayer from './DashCrossZoneLayer';
import { buildVisibleZones } from '../../utils/buildVisibleZones';
import { getZoneDashArray, usesDashCrossMarkers } from '../../utils/actionZoneStyle';

const VIEWPORT_DEBOUNCE_MS = 80;

function isZoneInViewport(zone, bounds) {
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

    setInViewport(filterZones());
    map.on('moveend', schedule);
    map.on('zoomend', schedule);
    return () => {
      map.off('moveend', schedule);
      map.off('zoomend', schedule);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [map, filterZones]);

  useEffect(() => {
    setInViewport(filterZones());
  }, [zones, filterZones]);

  return inViewport;
}

function ZoneCircleLayer({
  zone,
  entryId,
  hoverController,
  onZoneMouseOver,
  onZoneMouseOut,
  onZoneClick,
}) {
  const circleRef = useRef(null);
  const { obj, centerLat, centerLng, radiusMeters, color, lineType } = zone;
  const dashArray = getZoneDashArray(lineType);

  const baseStyle = useMemo(() => ({
    color,
    weight: 2,
    hoverWeight: 3.5,
    opacity: 0.65,
    hoverOpacity: 0.95,
    dashArray,
    fillColor: color,
    fillOpacity: 0.09,
  }), [color, dashArray]);

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

  return (
    <Circle
      ref={circleRef}
      center={[centerLat, centerLng]}
      radius={radiusMeters}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.09,
        weight: 2,
        opacity: 0.65,
        dashArray,
        className: 'action-radius-circle',
        interactive: true,
      }}
      eventHandlers={{
        mouseover: () => onZoneMouseOver(obj.id),
        mouseout: onZoneMouseOut,
        click: onZoneClick,
      }}
    />
  );
}

const ActionZonesLayer = React.memo(function ActionZonesLayer({
  zoneObjects = [],
  actionZoneFilters,
  hoverController,
  skipHoverRef,
  onZoneClickAt,
}) {
  const visibleZones = useMemo(
    () => buildVisibleZones(zoneObjects, actionZoneFilters),
    [zoneObjects, actionZoneFilters],
  );

  const zonesInViewport = useZonesInViewport(visibleZones);

  const visibleZonesRef = useRef(visibleZones);
  visibleZonesRef.current = visibleZones;

  const highlightByCenter = useMemo(() => {
    const map = new Map();
    zonesInViewport.forEach((zone) => {
      const key = `${zone.centerLat.toFixed(6)},${zone.centerLng.toFixed(6)}`;
      if (!map.has(key)) {
        map.set(key, { lat: zone.centerLat, lng: zone.centerLng, color: zone.color, objId: zone.obj.id });
      }
    });
    return map;
  }, [zonesInViewport]);

  const onZoneMouseOver = useCallback((objId) => {
    if (skipHoverRef?.current) return;
    hoverController?.setHovered([objId]);
  }, [hoverController, skipHoverRef]);

  const onZoneMouseOut = useCallback(() => {
    if (skipHoverRef?.current) return;
    hoverController?.clear();
  }, [hoverController, skipHoverRef]);

  const handleZoneClick = useCallback((e) => {
    L.DomEvent.stopPropagation(e.originalEvent);
    const ll = e.latlng;
    const candidates = visibleZonesRef.current.filter((zone) => {
      const dist = L.latLng(zone.centerLat, zone.centerLng).distanceTo(ll);
      return dist <= zone.radiusMeters + 1;
    });
    onZoneClickAt?.(e, candidates);
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
      {zonesInViewport.map((zone, idx) => {
        const entryId = `zone-${zone.obj.id}-${zone.equipmentDeploymentId ?? 'm'}-${zone.actionTypeId ?? zone.actionIndex}-${idx}`;
        if (usesDashCrossMarkers(zone.lineType)) {
          return (
            <DashCrossZoneLayer
              key={entryId}
              entryId={entryId}
              objId={zone.obj.id}
              hoverController={hoverController}
              centerLat={zone.centerLat}
              centerLng={zone.centerLng}
              radiusMeters={zone.radiusMeters}
              color={zone.color}
              onZoneMouseOver={onZoneMouseOver}
              onZoneMouseOut={onZoneMouseOut}
              onZoneClick={handleZoneClick}
            />
          );
        }
        return (
          <ZoneCircleLayer
            key={entryId}
            zone={zone}
            entryId={entryId}
            hoverController={hoverController}
            onZoneMouseOver={onZoneMouseOver}
            onZoneMouseOut={onZoneMouseOut}
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
        weight: 2,
        opacity: 0.9,
        className: 'action-radius-marker-highlight',
        interactive: false,
      }}
    />
  );
}

export default ActionZonesLayer;
