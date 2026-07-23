import {
  drawPolygonsToGeoJson,
  getZonePolygonPositionsList,
} from './inundationZone';
import { stripMarkdown } from './markdown';

const TIMELINE_DESCRIPTION_EXCERPT_LEN = 100;

export function getSituationRevision(situation) {
  return situation?.current_revision || null;
}

export function getSituationId(situationOrRevision) {
  if (!situationOrRevision) return null;
  // У ревизии id — это id версии; id обстановки — в situation_id / situation.id.
  if (situationOrRevision.situation_id != null) {
    return situationOrRevision.situation_id;
  }
  if (situationOrRevision.situation?.id != null) {
    return situationOrRevision.situation.id;
  }
  return situationOrRevision.id ?? null;
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

/** Крайнее состояние по дате/времени события (не по номеру версии). */
export function getSituationDisplayRevision(situation) {
  return situation?.display_revision || situation?.current_revision || null;
}

export function isSituationCurrentRevision(situation, revision) {
  if (!situation || !revision) return false;
  const currentId = situation.current_revision?.id;
  return currentId != null && String(currentId) === String(revision.id);
}

export function findSituationById(situations, situationId) {
  if (!situationId) return null;
  const key = String(situationId);
  return (situations || []).find((item) => String(item.id) === key) || null;
}

export function findSituationRevision(revisions, revisionId) {
  if (revisionId == null) return null;
  const key = String(revisionId);
  return (revisions || []).find((revision) => String(revision.id) === key) || null;
}

export function filterRevisionsForSituation(revisions, situationId) {
  if (!situationId) return [];
  const key = String(situationId);
  return (revisions || []).filter(
    (revision) => String(getSituationId(revision)) === key,
  );
}

export function filterRevisionsForSituations(revisions, situationIds = []) {
  if (!situationIds?.length) return [];
  const keys = new Set(situationIds.map(String));
  return (revisions || []).filter(
    (revision) => keys.has(String(getSituationId(revision))),
  );
}

export function resolveActiveSituationId(
  selectedSituationIds = [],
  focusedSituationId = null,
  highlightedSituationId = null,
) {
  const isSelected = (id) => (
    id != null
    && selectedSituationIds.some((itemId) => String(itemId) === String(id))
  );

  if (isSelected(focusedSituationId)) return focusedSituationId;
  if (isSelected(highlightedSituationId)) return highlightedSituationId;
  if (selectedSituationIds.length > 0) {
    return selectedSituationIds[selectedSituationIds.length - 1];
  }
  return null;
}

/**
 * Какую ревизию рисовать на карте.
 * 1) Для активной обстановки с выбранным таймлайном — ревизия таймлайна.
 * 2) Иначе — display_revision (крайнее по дате/времени события).
 */
export function resolveSituationMapRevision(
  situation,
  {
    activeSituationId = null,
    timelineRevisionId = null,
    revisions,
    situationRevisions,
  } = {},
) {
  if (!situation) return null;

  const revisionList = revisions ?? situationRevisions ?? [];

  const situationId = String(situation.id);
  const isActive = activeSituationId != null
    && String(activeSituationId) === situationId;

  if (isActive && timelineRevisionId != null) {
    const selected = findSituationRevision(revisionList, timelineRevisionId);
    if (selected && String(getSituationId(selected)) === situationId) {
      return selected;
    }
  }

  return getSituationDisplayRevision(situation);
}

export function buildSituationRevisionIndex(revisions = []) {
  const index = {};
  for (const revision of revisions) {
    if (revision?.id == null) continue;
    index[String(revision.id)] = revision;
  }
  return index;
}

export function getSituationTitle(situation) {
  return getSituationDisplayRevision(situation)?.title || 'Обстановка';
}

function getSituationGeometry(situationOrRevision) {
  return situationOrRevision?.geometry
    || situationOrRevision?.display_revision?.geometry
    || situationOrRevision?.current_revision?.geometry;
}

function getSituationAllPositions(situationOrRevision) {
  const rings = getZonePolygonPositionsList(getSituationGeometry(situationOrRevision));
  if (!rings.length) return [];
  return rings.flat();
}

export function getSituationCenter(situationOrRevision) {
  const positions = getSituationAllPositions(situationOrRevision);
  if (!positions?.length) return null;
  const sum = positions.reduce(
    (acc, [lat, lng]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 },
  );
  return [sum.lat / positions.length, sum.lng / positions.length];
}

/** Границы полигона обстановки для fitBounds: [[south, west], [north, east]]. */
export function getSituationBounds(situationOrRevision) {
  const positions = getSituationAllPositions(situationOrRevision);
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

export function formatSituationDate(revision) {
  return revision?.situation_date || '—';
}

export function formatSituationTime(revision) {
  if (!revision?.situation_time) return '—';
  return String(revision.situation_time).slice(0, 5);
}

export function getSituationDescriptionExcerpt(
  revision,
  maxLen = TIMELINE_DESCRIPTION_EXCERPT_LEN,
) {
  const plain = stripMarkdown(revision?.description || '');
  if (!plain) return '';
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trim()}…`;
}

export function buildSituationRequestBody(form, drawPolygons) {
  return {
    title: form.title,
    description: form.description || '',
    situation_date: form.situationDate || null,
    situation_time: form.situationTime || null,
    color: form.color || '#2f80ed',
    geometry: drawPolygonsToGeoJson(drawPolygons || []),
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
