export function formatEquipmentLabel(item) {
  if (!item) return '';
  const designation = item.designation?.trim();
  const title = item.title?.trim();
  if (designation && title && designation !== title) {
    return `${designation} — ${title}`;
  }
  return designation || title || `ID ${item.id}`;
}

/** Короткое имя для подписи зоны: designation или title. */
export function formatZoneEquipmentShortName(equipment) {
  if (!equipment) return '';
  return equipment.designation?.trim() || equipment.title?.trim() || `ID ${equipment.id}`;
}

export function formatEquipmentSubtitle(item) {
  if (!item?.category?.title) return '';
  return item.category.title;
}

function equipmentSearchHaystack(item) {
  return [
    item.designation,
    item.title,
    item.category?.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * @param {string} query
 * @param {Array} catalog
 * @param {number} [limit=50]
 */
export function filterEquipmentCatalog(query, catalog, limit = 50) {
  const needle = query.trim().toLowerCase();
  const matched = needle
    ? catalog.filter((item) => equipmentSearchHaystack(item).includes(needle))
    : catalog;
  return {
    items: matched.slice(0, limit),
    total: matched.length,
  };
}
