/**
 * Утилиты для фильтрации маркеров по типу (flag/non-flag)
 */

/**
 * Проверяет, является ли объект флаговым маркером
 * @param {Object} obj - Объект для проверки
 * @returns {boolean} true, если объект имеет флаговый маркер или без маркера
 */
export const isFlagMarker = (obj) => {
  return obj.marker?.is_flag === true || 
         obj.marker?.is_flag === undefined || 
         !obj.marker;
};

/**
 * Проверяет, является ли объект нефлаговым маркером
 * @param {Object} obj - Объект для проверки
 * @returns {boolean} true, если объект имеет нефлаговый маркер
 */
export const isNonFlagMarker = (obj) => {
  return obj.marker?.is_flag === false;
};

/**
 * Фильтрует флаговые маркеры из массива объектов по выбранным ID
 * @param {Array} objects - Массив объектов
 * @param {Array} selectedIds - Массив выбранных ID
 * @returns {Array} Отфильтрованный массив флаговых маркеров
 */
export const filterFlagMarkers = (objects, selectedIds) => {
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  return objects.filter(obj => 
    selectedSet.has(obj.id) && isFlagMarker(obj)
  );
};

/**
 * Фильтрует нефлаговые маркеры из массива объектов по выбранным ID
 * @param {Array} objects - Массив объектов
 * @param {Array} selectedIds - Массив выбранных ID
 * @returns {Array} Отфильтрованный массив нефлаговых маркеров
 */
export const filterNonFlagMarkers = (objects, selectedIds) => {
  const selectedSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  return objects.filter(obj => 
    selectedSet.has(obj.id) && isNonFlagMarker(obj)
  );
};
