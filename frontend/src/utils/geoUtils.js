const EARTH_RADIUS_M = 6371e3;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/** Расстояние между двумя точками (метры), формула Haversine. */
export function calcDistanceMeters(from, to) {
  const phi1 = toRadians(from.lat);
  const phi2 = toRadians(to.lat);
  const deltaPhi = toRadians(to.lat - from.lat);
  const deltaLambda = toRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}
