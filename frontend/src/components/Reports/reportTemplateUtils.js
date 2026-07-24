export const EMPTY_SECTION_FILTERS = {
  countries: { country_ids: [] },
  targets: { country_ids: [], type_ids: [], title: '' },
  equipment: { category_ids: [], origin_country_ids: [], title: '' },
  events: { country_ids: [], event_type_ids: [], date_from: '', date_to: '', title: '' },
  situations: {
    country_ids: [],
    date_from: '',
    date_to: '',
    title: '',
    group_by_situation: false,
  },
  zones: { target_ids: [], action_type_ids: [], country_ids: [] },
  vulnerabilities: { target_ids: [], country_ids: [] },
  country_full: { country_ids: [] },
  objects_full: { target_ids: [], country_ids: [] },
};

export function defaultFiltersForType(sectionType) {
  const base = EMPTY_SECTION_FILTERS[sectionType];
  return base ? JSON.parse(JSON.stringify(base)) : {};
}

export function createEmptySection(sectionType, label, order = 0) {
  return {
    clientKey: `${sectionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    section_type: sectionType,
    title: label || sectionType,
    order,
    filters: defaultFiltersForType(sectionType),
    page_break_before: order > 0,
  };
}

/** Вшить глобальный список стран в фильтры разделов. */
export function applyGlobalCountryIds(sections, countryIds = []) {
  const ids = Array.isArray(countryIds)
    ? countryIds.map(Number).filter((n) => !Number.isNaN(n))
    : [];
  return (sections || []).map((section) => {
    const defaults = defaultFiltersForType(section.section_type);
    const filters = {
      ...defaults,
      ...(section.filters || {}),
    };
    if (Object.prototype.hasOwnProperty.call(defaults, 'country_ids')) {
      filters.country_ids = [...ids];
    }
    if (Object.prototype.hasOwnProperty.call(defaults, 'origin_country_ids')) {
      filters.origin_country_ids = [...ids];
    }
    return {
      ...section,
      filters,
    };
  });
}

/** Достать страны для UI: union country_ids / origin_country_ids по секциям. */
export function extractGlobalCountryIds(sections) {
  const set = new Set();
  for (const section of sections || []) {
    const filters = section.filters || {};
    for (const key of ['country_ids', 'origin_country_ids']) {
      const list = filters[key];
      if (Array.isArray(list)) {
        list.forEach((id) => {
          const n = Number(id);
          if (!Number.isNaN(n)) set.add(n);
        });
      }
    }
  }
  return [...set];
}

export function toApiPayload(form, globalCountryIds = null) {
  const countryIds = globalCountryIds != null
    ? globalCountryIds
    : extractGlobalCountryIds(form.sections);
  const sections = applyGlobalCountryIds(form.sections || [], countryIds);
  return {
    name: form.name?.trim() || 'Без названия',
    description: form.description || '',
    sections: sections.map((section, index) => ({
      section_type: section.section_type,
      title: section.title?.trim() || section.section_type,
      order: index,
      filters: section.filters || defaultFiltersForType(section.section_type),
      page_break_before: index > 0 ? section.page_break_before !== false : false,
    })),
  };
}

export function fromApiTemplate(template) {
  return {
    id: template.id,
    name: template.name || '',
    description: template.description || '',
    sections: (template.sections || []).map((section, index) => ({
      clientKey: `saved-${section.id || index}`,
      id: section.id,
      section_type: section.section_type,
      title: section.title || '',
      order: section.order ?? index,
      filters: {
        ...defaultFiltersForType(section.section_type),
        ...(section.filters || {}),
      },
      page_break_before: section.page_break_before !== false,
    })),
  };
}

/** Шаблон только из секций objects_full (библиотека вкладки «По объектам»). */
export function isObjectsOnlyTemplate(template) {
  const types = Array.isArray(template?.section_types) && template.section_types.length > 0
    ? template.section_types
    : (template?.sections || []).map((s) => s.section_type);
  return types.length > 0 && types.every((t) => t === 'objects_full');
}

export function createEmptyObjectsForm(name = 'Отчёт по объектам') {
  return {
    id: null,
    name,
    description: '',
    targetIds: [],
    countryIds: [],
  };
}

export function objectsFormFromTemplate(template) {
  const form = fromApiTemplate(template);
  const section = (form.sections || []).find((s) => s.section_type === 'objects_full')
    || form.sections?.[0]
    || null;
  const filters = section?.filters || {};
  return {
    id: form.id,
    name: form.name,
    description: form.description,
    targetIds: Array.isArray(filters.target_ids) ? filters.target_ids.map(String) : [],
    countryIds: Array.isArray(filters.country_ids) ? filters.country_ids.map(Number).filter((n) => !Number.isNaN(n)) : [],
  };
}

/** Страны, у которых выбраны все видимые объекты. */
export function deriveFullySelectedCountryIds(targets, selectedTargetIds = []) {
  const selected = new Set((selectedTargetIds || []).map((id) => Number(id)));
  const byCountry = new Map();
  for (const target of targets || []) {
    const countryId = target.country?.id ?? target.country_id;
    if (countryId == null) continue;
    const cid = Number(countryId);
    if (!byCountry.has(cid)) byCountry.set(cid, []);
    byCountry.get(cid).push(Number(target.id));
  }
  const result = [];
  for (const [cid, ids] of byCountry) {
    if (ids.length > 0 && ids.every((id) => selected.has(id))) {
      result.push(cid);
    }
  }
  return result;
}

export function toObjectsApiPayload(form, targets = []) {
  const targetIds = (form.targetIds || [])
    .map((id) => Number(id))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const countryIds = Array.isArray(form.countryIds) && form.countryIds.length > 0
    ? form.countryIds.map(Number).filter((n) => !Number.isNaN(n))
    : deriveFullySelectedCountryIds(targets, targetIds);
  return {
    name: form.name?.trim() || 'Отчёт по объектам',
    description: form.description || '',
    sections: [{
      section_type: 'objects_full',
      title: 'Полный отчёт по объектам',
      order: 0,
      filters: {
        target_ids: targetIds,
        country_ids: countryIds,
      },
      page_break_before: false,
    }],
  };
}
