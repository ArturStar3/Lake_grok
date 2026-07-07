import { getZonePolygonPositions, pointsToGeoJsonPolygon } from './inundationZone';

export function getSituationRevision(situation) {
  return situation?.current_revision || null;
}

export function getSituationId(situationOrRevision) {
  return situationOrRevision?.id
    || situationOrRevision?.situation_id
    || situationOrRevision?.situation?.id
    || null;
}

export function sameSituationId(left, right) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
}

function normalizeDateTimePart(value) {
  return value ? String(value) : '';
}

/** Сравнение ревизий по полям «дата/время обстановки» (возрастание, без даты — в конце). */
export function compareSituationDateTime(a, b) {
  const dateA = normalizeDateTimePart(a?.situation_date);
  const dateB = normalizeDateTimePart(b?.situation_date);
  if (!dateA && !dateB) {
    // continue
  } else if (!dateA) {
    return 1;
  } else if (!dateB) {
    return -1;
  } else if (dateA !== dateB) {
    return dateA < dateB ? -1 : 1;
  }

  const timeA = normalizeDateTimePart(a?.situation_time).slice(0, 8);
  const timeB = normalizeDateTimePart(b?.situation_time).slice(0, 8);
  if (!timeA && !timeB) {
    // continue
  } else if (!timeA) {
    return 1;
  } else if (!timeB) {
    return -1;
  } else if (timeA !== timeB) {
    return timeA < timeB ? -1 : 1;
  }

  return (a?.version || 0) - (b?.version || 0);
}

/** Сортировка ревизий по дате/времени обстановки. */
export function sortRevisionsBySituationDateTime(revisions, direction = 'desc') {
  const sorted = [...(revisions || [])].sort(compareSituationDateTime);
  return direction === 'desc' ? sorted.reverse() : sorted;
}

export function getSituationDisplayRevision(situation) {
  return situation?.display_revision || situation?.current_revision || null;
}

export function getSituationTitle(situation) {
  return getSituationDisplayRevision(situation)?.title || 'Обстановка';
}

function getSituationGeometry(situationOrRevision) {
  return situationOrRevision?.geometry
    || situationOrRevision?.display_revision?.geometry
    || situationOrRevision?.current_revision?.geometry;
}

export function getSituationCenter(situationOrRevision) {
  const positions = getZonePolygonPositions(getSituationGeometry(situationOrRevision));
  if (!positions?.length) return null;
  const sum = positions.reduce(
    (acc, [lat, lng]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 },
  );
  return [sum.lat / positions.length, sum.lng / positions.length];
}

/** Границы полигона обстановки для fitBounds: [[south, west], [north, east]]. */
export function getSituationBounds(situationOrRevision) {
  const positions = getZonePolygonPositions(getSituationGeometry(situationOrRevision));
  if (!positions?.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of positions) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return [[minLat, minLng], [maxLat, maxLng]];
}

export function formatSituationDateTime(revision) {
  if (!revision?.situation_date) return '—';
  const time = revision.situation_time;
  if (time) {
    const shortTime = String(time).slice(0, 5);
    return `${revision.situation_date} ${shortTime}`;
  }
  return revision.situation_date;
}

export function buildSituationRequestBody(form, drawPoints) {
  return {
    title: form.title,
    description: form.description || '',
    situation_date: form.situationDate || null,
    situation_time: form.situationTime || null,
    color: form.color || '#2f80ed',
    geometry: pointsToGeoJsonPolygon(drawPoints),
    country_ids: form.countryIds || [],
    change_note: form.changeNote || '',
  };
}

export const CHANGE_KIND_LABELS = {
  initial: 'Создание',
  correction: 'Исправление',
  new_state: 'Новое состояние',
  fork: 'На основе другой',
};
