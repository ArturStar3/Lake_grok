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

export function toApiPayload(form) {
  return {
    name: form.name?.trim() || 'Без названия',
    description: form.description || '',
    sections: (form.sections || []).map((section, index) => ({
      section_type: section.section_type,
      title: section.title?.trim() || section.section_type,
      order: index,
      filters: section.filters || defaultFiltersForType(section.section_type),
      page_break_before: Boolean(section.page_break_before),
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
