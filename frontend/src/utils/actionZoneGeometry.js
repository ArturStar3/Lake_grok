const EARTH_RADIUS_M = 6371000;

/** Точка на сфере по азимуту и расстоянию (метры). */
export function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const θ = (bearingDeg * Math.PI) / 180;
  const δ = distanceM / EARTH_RADIUS_M;

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/** Кольцо окружности для Polyline (lat/lng pairs). */
export function generateCircleRing(lat, lng, radiusMeters, segments = 128) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const bearing = (i / segments) * 360;
    const p = destinationPoint(lat, lng, bearing, radiusMeters);
    points.push([p.lat, p.lng]);
  }
  return points;
}

export function computeDashCrossCount(radiusMeters) {
  const circumference = 2 * Math.PI * radiusMeters;
  return Math.max(6, Math.min(32, Math.round(circumference / 1000)));
}

export function computeDashCrossArmMeters(radiusMeters) {
  return Math.max(100, Math.min(radiusMeters * 0.05, 3000));
}

/**
 * Кресты (×) на окружности зоны — для line_type dash_x.
 * @returns {Array<{ lines: [Array, Array] }>}
 */
export function generateDashCrossMarkers(lat, lng, radiusMeters, crossCount) {
  const arm = computeDashCrossArmMeters(radiusMeters);
  const markers = [];

  for (let i = 0; i < crossCount; i += 1) {
    const bearing = (i / crossCount) * 360;
    const onCircle = destinationPoint(lat, lng, bearing, radiusMeters);
    const a1 = destinationPoint(onCircle.lat, onCircle.lng, bearing + 135, arm);
    const a2 = destinationPoint(onCircle.lat, onCircle.lng, bearing - 45, arm);
    const b1 = destinationPoint(onCircle.lat, onCircle.lng, bearing + 45, arm);
    const b2 = destinationPoint(onCircle.lat, onCircle.lng, bearing - 135, arm);
    markers.push({
      lines: [
        [[a1.lat, a1.lng], [a2.lat, a2.lng]],
        [[b1.lat, b1.lng], [b2.lat, b2.lng]],
      ],
    });
  }

  return markers;
}

export function usesDashCrossMarkers(lineType) {
  return lineType === 'dash_x';
}
