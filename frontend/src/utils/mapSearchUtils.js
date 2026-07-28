export const MAP_SEARCH_LIMITS = {
  countries: 8,
  objects: 8,
};

export function normalizeSearchQuery(query) {
  return (query ?? '').trim().toLowerCase();
}

export function searchCountries(countries, query, limit = MAP_SEARCH_LIMITS.countries) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  return (countries ?? [])
    .filter((country) =>
      country.title?.toLowerCase().includes(normalizedQuery)
      || country.title_short?.toLowerCase().includes(normalizedQuery)
      || country.iso_code?.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, limit)
    .map((country) => ({
      type: 'country',
      id: country.id,
      title: country.title,
      subtitle: [country.title_short, country.iso_code].filter(Boolean).join(' · '),
      country,
    }));
}

export function searchObjects(objects, query, limit = MAP_SEARCH_LIMITS.objects) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  return (objects ?? [])
    .filter((object) =>
      object.title?.toLowerCase().includes(normalizedQuery)
      || object.label?.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, limit)
    .map((object) => ({
      type: 'object',
      id: object.id,
      title: object.title,
      subtitle: object.country?.title ?? '',
      object,
    }));
}

/**
 * Объединённый результат поиска по карте.
 * Позже сюда можно добавить searchSettlements().
 */
export function buildMapSearchResults({
  countries = [],
  objects = [],
  query,
  limits = MAP_SEARCH_LIMITS,
} = {}) {
  const countryResults = searchCountries(countries, query, limits.countries);
  const objectResults = searchObjects(objects, query, limits.objects);

  return {
    countries: countryResults,
    objects: objectResults,
    flat: [...countryResults, ...objectResults],
    isEmpty: countryResults.length === 0 && objectResults.length === 0,
  };
}

export function getCountryFeatureIso(feature) {
  return feature?.properties?.ISO_A2
    || feature?.properties?.iso_a2
    || feature?.id
    || null;
}

export function findCountryFeature(geoData, isoCode) {
  if (!geoData?.features || !isoCode) return null;

  const normalizedIso = String(isoCode).toUpperCase();
  return geoData.features.find((feature) =>
    String(getCountryFeatureIso(feature)).toUpperCase() === normalizedIso,
  ) ?? null;
}
