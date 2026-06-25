import { calcDistanceMeters } from './geoUtils';

/** Центр события для fly-to на карте. */
export function getEventCenter(eventItem) {
  const shape = eventItem?.shape;
  if (!shape) return null;

  if (shape.type === 'point' && shape.geometry) {
    return [shape.geometry.lat, shape.geometry.lng];
  }
  if (shape.type === 'circle' && shape.geometry) {
    return [shape.geometry.lat, shape.geometry.lng];
  }
  if (shape.type === 'area' && Array.isArray(shape.geometry?.points) && shape.geometry.points.length > 0) {
    const sum = shape.geometry.points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / shape.geometry.points.length, sum.lng / shape.geometry.points.length];
  }
  return null;
}

/** Точки рисования из сохранённой геометрии события (для редактирования). */
export function buildDrawPointsFromEvent(eventItem) {
  const shape = eventItem?.shape;
  if (!shape) return { drawMode: null, drawPoints: [] };

  if (shape.type === 'point' && shape.geometry) {
    return {
      drawMode: 'point',
      drawPoints: [{ lat: shape.geometry.lat, lng: shape.geometry.lng }],
    };
  }

  if (shape.type === 'circle' && shape.geometry) {
    const { lat, lng, radius } = shape.geometry;
    const deltaLat = (radius || 0) / 111139;
    return {
      drawMode: 'circle',
      drawPoints: [
        { lat, lng },
        { lat: lat + deltaLat, lng },
      ],
    };
  }

  if (shape.type === 'area' && Array.isArray(shape.geometry?.points)) {
    return {
      drawMode: 'polygon',
      drawPoints: shape.geometry.points.map((p) => ({ lat: p.lat, lng: p.lng })),
    };
  }

  return { drawMode: null, drawPoints: [] };
}

/** Геометрия события из режима рисования (сохранение на API). */
export function buildEventShape(geometry) {
  if (!geometry) return null;
  const { drawMode, drawPoints } = geometry;

  if (drawMode === 'point' && drawPoints?.[0]) {
    return {
      type: 'point',
      geometry: { lat: drawPoints[0].lat, lng: drawPoints[0].lng },
    };
  }
  if (drawMode === 'circle' && drawPoints?.length >= 2) {
    return {
      type: 'circle',
      geometry: {
        lat: drawPoints[0].lat,
        lng: drawPoints[0].lng,
        radius: Math.round(calcDistanceMeters(drawPoints[0], drawPoints[1])),
      },
    };
  }
  if ((drawMode === 'rectangle' || drawMode === 'polygon') && drawPoints?.length > 0) {
    return {
      type: 'area',
      geometry: {
        points: drawPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
      },
    };
  }
  return null;
}
