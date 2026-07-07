import { calcDistanceMeters } from './geoUtils';

export const SNAP_CLOSE_PIXELS = 12;

function orientation(p, q, r) {
  const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
  if (Math.abs(val) < 1e-12) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p, q, r) {
  return (
    q.lng <= Math.max(p.lng, r.lng)
    && q.lng >= Math.min(p.lng, r.lng)
    && q.lat <= Math.max(p.lat, r.lat)
    && q.lat >= Math.min(p.lat, r.lat)
  );
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/** Проверка самопересечения замкнутого полигона. */
export function isSelfIntersecting(points) {
  if (!points || points.length < 4) return false;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === n - 1) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Расстояние между точками в пикселях контейнера карты. */
export function pixelDistance(map, a, b) {
  if (!map || !a || !b) return Infinity;
  const pa = map.latLngToContainerPoint(a);
  const pb = map.latLngToContainerPoint(b);
  return pa.distanceTo(pb);
}

export function isNearFirstVertex(map, clickLatLng, firstVertex, thresholdPx = SNAP_CLOSE_PIXELS) {
  if (!map || !clickLatLng || !firstVertex) return false;
  return pixelDistance(map, clickLatLng, firstVertex) <= thresholdPx;
}

/** Четыре угла прямоугольника по двум противоположным углам. */
export function buildRectangleFromCorners(cornerA, cornerB) {
  return [
    { lat: cornerA.lat, lng: cornerA.lng },
    { lat: cornerA.lat, lng: cornerB.lng },
    { lat: cornerB.lat, lng: cornerB.lng },
    { lat: cornerB.lat, lng: cornerA.lng },
  ];
}

export function getSegmentLabels(points) {
  if (!points || points.length < 2) return [];
  const segments = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    if (!current || !next) continue;
    const midLat = (current.lat + next.lat) / 2;
    const midLng = (current.lng + next.lng) / 2;
    const distanceKm = calcDistanceMeters(current, next) / 1000;
    segments.push({
      key: `segment-${i}`,
      lat: midLat,
      lng: midLng,
      label: `${distanceKm.toFixed(2)} км`,
    });
  }
  return segments;
}

export function validatePolygonPoints(points) {
  if (!points || points.length < 3) {
    return 'Нужно минимум 3 вершины';
  }
  if (isSelfIntersecting(points)) {
    return 'Контур не должен пересекать сам себя';
  }
  return null;
}

function distancePointToSegmentPx(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return Math.hypot(apx, apy);
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * abx;
  const cy = a.y + t * aby;
  return Math.hypot(p.x - cx, p.y - cy);
}

function projectPointOnSegmentPx(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return { x: a.x, y: a.y };
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

/** Индекс ребра (от вершины i к i+1), ближайшего к клику в пикселях. */
export function findNearestEdgeIndex(map, clickLatLng, points, thresholdPx = 12) {
  if (!map || !clickLatLng || !points || points.length < 3) return -1;

  const clickPoint = map.latLngToContainerPoint(clickLatLng);
  let bestIdx = -1;
  let bestDist = thresholdPx;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const pa = map.latLngToContainerPoint(a);
    const pb = map.latLngToContainerPoint(b);
    const dist = distancePointToSegmentPx(clickPoint, pa, pb);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/** Точка на ближайшем ребре к клику (проекция на отрезок). */
export function getVertexOnNearestEdge(map, clickLatLng, points, thresholdPx = 12) {
  const edgeIndex = findNearestEdgeIndex(map, clickLatLng, points, thresholdPx);
  if (edgeIndex < 0) return null;

  const a = points[edgeIndex];
  const b = points[(edgeIndex + 1) % points.length];
  const clickPoint = map.latLngToContainerPoint(clickLatLng);
  const pa = map.latLngToContainerPoint(a);
  const pb = map.latLngToContainerPoint(b);
  const projected = projectPointOnSegmentPx(clickPoint, pa, pb);
  const latlng = map.containerPointToLatLng(projected);

  return {
    edgeIndex,
    vertex: { lat: latlng.lat, lng: latlng.lng },
  };
}

/** Вставить вершину после edgeIndex (между i и i+1). */
export function insertVertexOnEdge(points, edgeIndex, vertex) {
  if (!points || edgeIndex < 0 || edgeIndex >= points.length) return points;
  const next = [...points];
  next.splice(edgeIndex + 1, 0, vertex);
  return next;
}
