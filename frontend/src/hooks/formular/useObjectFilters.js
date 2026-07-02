import { useMemo, useState } from 'react';
import { filterTargets } from '../../utils/targetFilters';

export function useObjectFilters(objects) {
  const [filterCountry, setFilterCountry] = useState([]);
  const [filterType, setFilterType] = useState([]);
  const [filterTitle, setFilterTitle] = useState('');

  const filteredObjects = useMemo(
    () =>
      filterTargets(objects, {
        title: filterTitle,
        types: filterType,
        countries: filterCountry,
      }),
    [objects, filterTitle, filterType, filterCountry],
  );

  // Для таблицы и зон: без фильтра по стране (можно выбирать скрытые на карте объекты).
  const tableObjects = useMemo(
    () =>
      filterTargets(objects, {
        title: filterTitle,
        types: filterType,
        countries: null,
      }),
    [objects, filterTitle, filterType],
  );

  return {
    filterCountry,
    setFilterCountry,
    filterType,
    setFilterType,
    filterTitle,
    setFilterTitle,
    filteredObjects,
    tableObjects,
  };
}
