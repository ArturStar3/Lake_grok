import L from 'leaflet';
import { Circle, CircleMarker, Marker, Polygon, Polyline } from 'react-leaflet';
import { calcDistanceMeters } from '../../utils/geoUtils';
import { getSegmentLabels } from '../../utils/polygonDrawUtils';

const DRAFT_COLOR = '#ff9800';
const DRAFT_FILL = '#ffcc80';

function createHandleIcon(highlightFirst = false) {
  const extraClass = highlightFirst ? ' event-point-handle--first' : '';
  return L.divIcon({
    className: 'event-point-icon',
    html: `<div class='event-point-handle${extraClass}'></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function EventDraftLayer({
  drawMode,
  drawPoints,
  previewPoint,
  previewRectangle,
  previewPolygonPositions,
  polygonClosed,
  mapRef,
  isEventPointDraggingRef,
  isEventPointPointerDownRef,
  onUpdatePoint,
  onRemoveVertex,
  onInsertVertexOnEdge,
  extraClosedPolygons = [],
}) {
  const hasExtraPolygons = extraClosedPolygons.some((ring) => ring?.length >= 3);
  if (!drawMode || drawPoints.length === 0) {
    if (drawMode === 'circle' && drawPoints.length === 0 && !hasExtraPolygons) return null;
    if (drawMode === 'rectangle' && drawPoints.length === 0 && !hasExtraPolygons) return null;
    if (drawMode === 'polygon' && drawPoints.length === 0 && !hasExtraPolygons) return null;
    if (drawMode !== 'point' && !hasExtraPolygons) return null;
  }

  const rectanglePoints = drawMode === 'rectangle'
    ? (drawPoints.length >= 4 ? drawPoints : previewRectangle)
    : null;

  const polygonRenderPoints = drawMode === 'polygon'
    ? (polygonClosed ? drawPoints : previewPolygonPositions || drawPoints)
    : null;

  const circleEdge = drawMode === 'circle' && drawPoints.length >= 1
    ? (drawPoints.length >= 2 ? drawPoints[1] : previewPoint)
    : null;

  return (
    <>
      {extraClosedPolygons.map((ring, ringIndex) => (
        ring?.length >= 3 ? (
          <Polygon
            key={`extra-closed-${ringIndex}`}
            positions={ring.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: DRAFT_COLOR,
              fillColor: DRAFT_FILL,
              fillOpacity: 0.2,
              weight: 1,
              interactive: false,
            }}
          />
        ) : null
      ))}

      {drawMode === 'point' && drawPoints[0] && (
        <CircleMarker
          center={[drawPoints[0].lat, drawPoints[0].lng]}
          radius={6}
          pathOptions={{ color: DRAFT_COLOR, fillColor: DRAFT_FILL, fillOpacity: 0.9 }}
        />
      )}

      {drawMode === 'circle' && drawPoints[0] && circleEdge && (
        <>
          <Circle
            center={[drawPoints[0].lat, drawPoints[0].lng]}
            radius={calcDistanceMeters(drawPoints[0], circleEdge)}
            pathOptions={{
              color: DRAFT_COLOR,
              fillColor: DRAFT_FILL,
              fillOpacity: 0.2,
              weight: 1,
              interactive: false,
            }}
          />
          <Polyline
            positions={[
              [drawPoints[0].lat, drawPoints[0].lng],
              [circleEdge.lat, circleEdge.lng],
            ]}
            pathOptions={{ color: DRAFT_COLOR, weight: 1, dashArray: '4 6', interactive: false }}
            interactive={false}
            bubblingMouseEvents={false}
          />
          <Marker
            position={[
              drawPoints[0].lat + (circleEdge.lat - drawPoints[0].lat) * 0.35,
              drawPoints[0].lng + (circleEdge.lng - drawPoints[0].lng) * 0.35,
            ]}
            icon={L.divIcon({
              className: 'event-radius-label',
              html: `<div class='event-radius-label__inner'>${(calcDistanceMeters(drawPoints[0], circleEdge) / 1000).toFixed(2)} км</div>`,
            })}
            interactive={false}
            bubblingMouseEvents={false}
            zIndexOffset={900}
          />
        </>
      )}

      {rectanglePoints && rectanglePoints.length === 4 && (
        <>
          <Polygon
            positions={rectanglePoints.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: DRAFT_COLOR,
              fillColor: DRAFT_FILL,
              fillOpacity: 0.2,
              weight: 1,
              interactive: false,
            }}
          />
          {getSegmentLabels(rectanglePoints).map((segment) => (
            <Marker
              key={segment.key}
              position={[segment.lat, segment.lng]}
              icon={L.divIcon({
                className: 'event-segment-label',
                html: `<div class='event-segment-label__inner'>${segment.label}</div>`,
              })}
              interactive={false}
              bubblingMouseEvents={false}
              zIndexOffset={900}
            />
          ))}
        </>
      )}

      {polygonRenderPoints && polygonRenderPoints.length >= 2 && (
        <>
          {polygonRenderPoints.length >= 3 && (
            <Polygon
              positions={polygonRenderPoints.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: DRAFT_COLOR,
                fillColor: DRAFT_FILL,
                fillOpacity: polygonClosed ? 0.2 : 0.12,
                weight: 1,
                interactive: false,
              }}
            />
          )}
          {polygonRenderPoints.length >= 2 && !polygonClosed && (
            <Polyline
              positions={polygonRenderPoints.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: DRAFT_COLOR, weight: 2, dashArray: '6 6', interactive: false }}
              interactive={false}
            />
          )}
          {polygonClosed && drawPoints.length >= 2 && drawPoints.map((point, edgeIndex) => {
            const next = drawPoints[(edgeIndex + 1) % drawPoints.length];
            return (
              <Polyline
                key={`polygon-edge-${edgeIndex}`}
                positions={[[point.lat, point.lng], [next.lat, next.lng]]}
                pathOptions={{
                  color: 'transparent',
                  weight: 14,
                  className: 'event-polygon-edge',
                }}
                interactive
                bubblingMouseEvents={false}
                eventHandlers={{
                  dblclick: (e) => {
                    e.originalEvent?.preventDefault?.();
                    e.originalEvent?.stopPropagation?.();
                    const { lat, lng } = e.latlng;
                    onInsertVertexOnEdge?.(edgeIndex, { lat, lng });
                  },
                }}
              />
            );
          })}
          {polygonClosed && getSegmentLabels(drawPoints).map((segment) => (
            <Marker
              key={segment.key}
              position={[segment.lat, segment.lng]}
              icon={L.divIcon({
                className: 'event-segment-label',
                html: `<div class='event-segment-label__inner'>${segment.label}</div>`,
              })}
              interactive={false}
              bubblingMouseEvents={false}
              zIndexOffset={900}
            />
          ))}
        </>
      )}

      {drawPoints.map((point, index) => (
        <Marker
          key={`event-point-${index}`}
          position={[point.lat, point.lng]}
          draggable
          interactive
          bubblingMouseEvents={false}
          autoPan
          zIndexOffset={1000}
          icon={createHandleIcon(drawMode === 'polygon' && index === 0 && !polygonClosed && drawPoints.length >= 3)}
          eventHandlers={{
            mousedown: () => {
              isEventPointPointerDownRef.current = true;
            },
            mouseup: () => {
              isEventPointPointerDownRef.current = false;
            },
            contextmenu: (e) => {
              e.originalEvent?.preventDefault?.();
              if (drawMode === 'polygon' && drawPoints.length > 3) {
                onRemoveVertex?.(index);
              }
            },
            dragstart: () => {
              isEventPointDraggingRef.current = true;
              if (mapRef?.current?.dragging) {
                mapRef.current.dragging.disable();
              }
            },
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onUpdatePoint?.(index, { lat, lng });
              isEventPointDraggingRef.current = false;
              isEventPointPointerDownRef.current = false;
              if (mapRef?.current?.dragging) {
                mapRef.current.dragging.enable();
              }
            },
          }}
        />
      ))}
    </>
  );
}
