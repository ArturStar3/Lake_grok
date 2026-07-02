/**
 * Фильтрация объектов разведки по названию, типу и (опционально) стране.
 * @param {Array} objects
 * @param {{ title?: string, types?: string[], countries?: string[]|null }} filters
 *   countries: null — не фильтровать по стране; [] — все страны (как пустой фильтр)
 */
export function filterTargets(objects, { title = '', types = [], countries = null } = {}) {
  const normalizedTitle = title.trim().toLowerCase();

  return objects.filter((obj) => {
    if (normalizedTitle.length > 0) {
      if (!obj.title?.toLowerCase().includes(normalizedTitle)) return false;
    }
    if (types.length > 0 && !types.includes(obj.type?.title)) return false;
    if (countries !== null && countries.length > 0) {
      if (!countries.includes(obj.country?.title)) return false;
    }
    return true;
  });
}
