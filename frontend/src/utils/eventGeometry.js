import { calcDistanceMeters } from './geoUtils';
import { validatePolygonPoints } from './polygonDrawUtils';

const EARTH_RADIUS_M = 6371e3;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function destinationPoint(from, distanceMeters, bearingDeg) {
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const angular = distanceMeters / EARTH_RADIUS_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular)
    + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
    Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
  );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

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

function resolveAreaDrawMode(shape) {
  if (shape.areaKind === 'rectangle') return 'rectangle';
  if (shape.areaKind === 'polygon') return 'polygon';
  return 'polygon';
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
    const edge = destinationPoint({ lat, lng }, radius || 0, 90);
    return {
      drawMode: 'circle',
      drawPoints: [
        { lat, lng },
        edge,
      ],
    };
  }

  if (shape.type === 'area' && Array.isArray(shape.geometry?.points)) {
    return {
      drawMode: resolveAreaDrawMode(shape),
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
  if (drawMode === 'rectangle' && drawPoints?.length >= 4) {
    return {
      type: 'area',
      areaKind: 'rectangle',
      geometry: {
        points: drawPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
      },
    };
  }
  if (drawMode === 'polygon' && drawPoints?.length >= 3) {
    return {
      type: 'area',
      areaKind: 'polygon',
      geometry: {
        points: drawPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
      },
    };
  }
  return null;
}

/** Валидация геометрии перед открытием модалки сохранения. */
export function validateEventGeometry(drawMode, drawPoints) {
  if (!drawMode) return 'Выберите инструмент';
  if (drawMode === 'point') {
    return drawPoints?.length >= 1 ? null : 'Поставьте точку на карте';
  }
  if (drawMode === 'circle') {
    return drawPoints?.length >= 2 ? null : 'Укажите центр и радиус окружности';
  }
  if (drawMode === 'rectangle') {
    return drawPoints?.length >= 4 ? null : 'Укажите два противоположных угла территории';
  }
  if (drawMode === 'polygon') {
    return validatePolygonPoints(drawPoints);
  }
  return null;
}
