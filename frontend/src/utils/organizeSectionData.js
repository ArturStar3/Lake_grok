import { stripMarkdown } from './markdown';

const EXCERPT_MAX_LEN = 120;

export function getOrderValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 9999;
}

export function truncateExcerpt(text, maxLen = EXCERPT_MAX_LEN) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = stripMarkdown(text);
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trim()}…`;
}

export function isChildOf(childSection, parentSection) {
  if (!childSection?.parent || !parentSection) return false;
  const parentId = parentSection.id;
  const parentTitle = parentSection.title;
  const parentRef = childSection.parent;

  if (typeof parentRef === 'object') {
    return parentRef.id === parentId;
  }
  if (typeof parentRef === 'number') {
    return parentRef === parentId;
  }
  return parentRef === parentTitle;
}

function getParentTitle(parentValue, sorted) {
  if (!parentValue) return null;
  if (typeof parentValue === 'object') return parentValue.title;
  const found = sorted.find((item) => item.section?.id === parentValue);
  return found?.section?.title || String(parentValue);
}

function getParentKey(parentValue, parentTitle) {
  if (typeof parentValue === 'object' && parentValue.id != null) {
    return parentValue.id;
  }
  if (typeof parentValue === 'number') return parentValue;
  return parentTitle;
}

export function organizeSectionData(items = []) {
  if (!items?.length) {
    return { standalone: [], groups: [] };
  }

  const sorted = [...items].sort(
    (a, b) => getOrderValue(a.section?.order) - getOrderValue(b.section?.order)
  );

  const standalone = [];
  const groupsMap = new Map();

  sorted.forEach((item) => {
    const section = item.section;
    if (!section) return;

    if (section.parent) {
      const parentTitle = getParentTitle(section.parent, sorted);
      const parentKey = getParentKey(section.parent, parentTitle);

      if (!groupsMap.has(parentKey)) {
        const parentObj =
          typeof section.parent === 'object'
            ? section.parent
            : sorted.find((entry) => entry.section?.id === section.parent)?.section || {
                id: parentKey,
                title: parentTitle,
                is_hidden: false,
              };

        groupsMap.set(parentKey, {
          parent: parentObj,
          children: [],
        });
      }

      groupsMap.get(parentKey).children.push(item);
      return;
    }

    const hasChildren = sorted.some((entry) => isChildOf(entry.section, section));
    if (section.is_hidden && !hasChildren) {
      return;
    }

    standalone.push(item);
  });

  return {
    standalone,
    groups: Array.from(groupsMap.values()),
  };
}

function countAttachments(sectionId, attachmentsBySection) {
  return (attachmentsBySection[sectionId] || []).length;
}

export function itemHasVisibleContent(item, attachmentsBySection) {
  const content = item.content?.trim();
  const photos = countAttachments(item.section.id, attachmentsBySection);
  return Boolean(content) || photos > 0;
}

function countGroupAttachments(group, attachmentsBySection) {
  return group.children.reduce(
    (sum, child) => sum + countAttachments(child.section.id, attachmentsBySection),
    0
  );
}

function groupHasVisibleContent(group, attachmentsBySection) {
  return group.children.some((child) => itemHasVisibleContent(child, attachmentsBySection));
}

function buildStandaloneExcerpt(item, attachmentsBySection) {
  const excerpt = truncateExcerpt(item.content);
  if (excerpt) return excerpt;
  const photos = countAttachments(item.section.id, attachmentsBySection);
  if (photos > 0) return `${photos} фото`;
  return '';
}

function buildGroupExcerpt(group, _attachmentsBySection) {
  const firstWithContent = group.children.find((child) => child.content?.trim());
  if (firstWithContent) {
    return truncateExcerpt(firstWithContent.content);
  }
  const count = group.children.length;
  return `${count} ${count === 1 ? 'подраздел' : count < 5 ? 'подраздела' : 'подразделов'}`;
}

export function buildSectionCards({
  organized,
  attachmentsBySection = {},
  extraCards = [],
}) {
  const cards = [];
  const { standalone, groups } = organized;

  standalone.forEach((item) => {
    if (!itemHasVisibleContent(item, attachmentsBySection)) return;

    const photos = countAttachments(item.section.id, attachmentsBySection);
    cards.push({
      id: `section-${item.section.id}`,
      title: item.section.title,
      excerpt: buildStandaloneExcerpt(item, attachmentsBySection),
      badge: { photos, subsections: 0, items: 0 },
      kind: 'section',
      payload: { item },
    });
  });

  groups.forEach((group, index) => {
    if (!groupHasVisibleContent(group, attachmentsBySection)) return;

    const photos = countGroupAttachments(group, attachmentsBySection);
    const subsections = group.children.filter((child) =>
      itemHasVisibleContent(child, attachmentsBySection)
    ).length;

    cards.push({
      id: `group-${group.parent?.id ?? index}`,
      title: group.parent?.title || 'Раздел',
      excerpt: buildGroupExcerpt(group, attachmentsBySection),
      badge: { photos, subsections, items: 0 },
      kind: 'group',
      payload: { group },
    });
  });

  return [...cards, ...extraCards];
}
