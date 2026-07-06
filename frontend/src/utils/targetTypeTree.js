const NO_TYPE_KEY = '__no_type__';

function compareTypes(a, b) {
  const orderDiff = (a.order ?? 0) - (b.order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return (a.title || '').localeCompare(b.title || '', 'ru');
}

function sortTypeNodes(nodes) {
  return [...nodes].sort(compareTypes);
}

/**
 * @param {Array<{id, title, parent?, order?}>} flatTypes
 * @returns {Array} roots with children[]
 */
export function buildTargetTypeTree(flatTypes) {
  const list = Array.isArray(flatTypes) ? flatTypes : [];
  const byId = new Map(list.map((t) => [t.id, { ...t, children: [] }]));

  const roots = [];
  for (const node of byId.values()) {
    const parentId = node.parent ?? null;
    if (parentId != null && byId.has(parentId)) {
      byId.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (nodes) => {
    sortTypeNodes(nodes).forEach((n) => {
      n.children = sortRecursive(n.children);
    });
    return nodes;
  };

  return sortRecursive(roots);
}

/**
 * @returns {Array<{node, depth}>}
 */
export function flattenTargetTypeTree(tree, depth = 0) {
  const result = [];
  for (const node of tree) {
    result.push({ node, depth });
    if (node.children?.length) {
      result.push(...flattenTargetTypeTree(node.children, depth + 1));
    }
  }
  return result;
}

export function collectDescendantTypeIds(typeId, flatTypes) {
  const list = Array.isArray(flatTypes) ? flatTypes : [];
  const byParent = new Map();
  for (const t of list) {
    const pid = t.parent ?? null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(t.id);
  }

  const ids = [];
  const walk = (id) => {
    ids.push(id);
    for (const childId of byParent.get(id) || []) {
      walk(childId);
    }
  };
  walk(typeId);
  return ids;
}

export function collectDescendantTypeTitles(typeId, flatTypes) {
  const list = Array.isArray(flatTypes) ? flatTypes : [];
  const byId = new Map(list.map((t) => [t.id, t]));
  return collectDescendantTypeIds(typeId, list)
    .map((id) => byId.get(id)?.title)
    .filter(Boolean);
}

function collectItemsInSubtree(typeId, itemsByTypeId, flatTypes) {
  const ids = collectDescendantTypeIds(typeId, flatTypes);
  const result = [];
  for (const id of ids) {
    const bucket = itemsByTypeId.get(id);
    if (bucket?.length) result.push(...bucket);
  }
  return result;
}

function subtreeHasItems(typeId, itemsByTypeId, flatTypes) {
  return collectItemsInSubtree(typeId, itemsByTypeId, flatTypes).length > 0;
}

/**
 * Объединяет каталог типов с типами из объектов (id, title, parent),
 * чтобы группировка работала до загрузки справочника и для «сирот» в каталоге.
 */
export function mergeTypesCatalogForItems(flatTypes, items) {
  const byId = new Map();
  for (const t of flatTypes || []) {
    byId.set(t.id, {
      id: t.id,
      title: t.title,
      parent: t.parent ?? null,
      order: t.order ?? 0,
    });
  }
  for (const item of items || []) {
    const type = item.type;
    if (!type?.id) continue;
    if (!byId.has(type.id)) {
      byId.set(type.id, {
        id: type.id,
        title: type.title,
        parent: type.parent ?? null,
        order: 0,
      });
    }
  }
  return [...byId.values()];
}

function collectIncludedItemIds(typeNodes, orphanItems) {
  const ids = new Set();
  const walk = (nodes) => {
    for (const node of nodes) {
      node.allItems.forEach((item) => ids.add(item.id));
      walk(node.children || []);
    }
  };
  walk(typeNodes);
  orphanItems.forEach((item) => ids.add(item.id));
  return ids;
}

function buildTypeNodesForCountry(countryItems, flatTypes) {
  const itemsByTypeId = new Map();
  const orphanItems = [];

  for (const item of countryItems) {
    const typeId = item.type?.id;
    if (!typeId) {
      orphanItems.push(item);
      continue;
    }
    if (!itemsByTypeId.has(typeId)) itemsByTypeId.set(typeId, []);
    itemsByTypeId.get(typeId).push(item);
  }

  const mergedTypes = mergeTypesCatalogForItems(flatTypes, countryItems);
  const tree = buildTargetTypeTree(mergedTypes);

  const mapNode = (node) => {
    if (!subtreeHasItems(node.id, itemsByTypeId, mergedTypes)) {
      return null;
    }
    const directItems = itemsByTypeId.get(node.id) || [];
    const children = (node.children || [])
      .map(mapNode)
      .filter(Boolean);
    return {
      typeId: node.id,
      title: node.title,
      items: directItems,
      children,
      allItems: collectItemsInSubtree(node.id, itemsByTypeId, mergedTypes),
    };
  };

  const typeNodes = tree.map(mapNode).filter(Boolean);

  const includedIds = collectIncludedItemIds(typeNodes, orphanItems);
  const fallbackNodes = [];
  for (const [typeId, items] of itemsByTypeId) {
    const missing = items.filter((item) => !includedIds.has(item.id));
    if (!missing.length) continue;
    fallbackNodes.push({
      typeId,
      title: missing[0].type?.title || 'Без названия',
      items: missing,
      children: [],
      allItems: missing,
    });
  }

  return {
    typeNodes: [...typeNodes, ...fallbackNodes],
    orphanItems,
  };
}

/**
 * Группировка объектов страны по дереву типов.
 */
export function groupCountryItemsByTypeTree(countryItems, flatTypes) {
  return buildTypeNodesForCountry(countryItems, flatTypes);
}

/**
 * Группировка по странам + дерево типов.
 */
export function groupObjectsByCountryAndTypeTree(data, flatTypes) {
  const byCountry = new Map();

  for (const item of data) {
    const countryTitle = item.country?.title || 'Без страны';
    const countryKey = item.country?.id ?? countryTitle;
    if (!byCountry.has(countryKey)) {
      byCountry.set(countryKey, {
        countryKey,
        country: countryTitle,
        items: [],
      });
    }
    byCountry.get(countryKey).items.push(item);
  }

  return [...byCountry.values()]
    .sort((a, b) => a.country.localeCompare(b.country, 'ru'))
    .map((group) => {
      const { typeNodes, orphanItems } = buildTypeNodesForCountry(group.items, flatTypes);
      return {
        countryKey: group.countryKey,
        country: group.country,
        typeNodes,
        orphanItems,
        allItems: group.items,
      };
    });
}

export function makeTypeExpandKey(countryKey, typeId) {
  return `${countryKey}|||${typeId}`;
}

export function collectAllTypeExpandKeys(countryGroups) {
  const keys = [];
  const walk = (countryKey, nodes) => {
    for (const node of nodes) {
      keys.push(makeTypeExpandKey(countryKey, node.typeId));
      if (node.children?.length) walk(countryKey, node.children);
    }
  };
  for (const g of countryGroups) {
    walk(g.countryKey, g.typeNodes);
  }
  return keys;
}

export function formatTypeOptionLabel(title, depth) {
  const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
  return `${prefix}${title}`;
}

/** Типы, применимые к стране (пустой countries = все страны). */
export function filterTargetTypesForCountry(targetTypes, countryId) {
  const list = Array.isArray(targetTypes) ? targetTypes : [];
  if (!countryId) return list;
  const cid = parseInt(countryId, 10);
  return list.filter((t) => {
    const countries = t.countries || [];
    if (!countries.length) return true;
    return countries.some((c) => c === cid || c?.id === cid);
  });
}

/** Кандидаты в родители: та же страна, order типа не выше текущего. */
export function filterParentOptionsForTarget(targets, targetTypes, { countryId, typeId, excludeId }) {
  if (!countryId) return [];
  const orderByTypeId = new Map(
    (targetTypes || []).map((t) => [Number(t.id), Number(t.order)]),
  );
  const currentOrder = typeId ? orderByTypeId.get(Number(typeId)) : undefined;

  return (targets || []).filter((t) => {
    if (excludeId && t.id === excludeId) return false;
    if (Number(t.country) !== Number(countryId)) return false;
    if (currentOrder == null) return true;
    const candidateOrder = t.type ? orderByTypeId.get(Number(t.type)) : undefined;
    return candidateOrder == null || candidateOrder <= currentOrder;
  });
}

export function getAllTypeTitlesInObjects(objects) {
  return [...new Set(objects.map((o) => o.type?.title).filter(Boolean))];
}

export function getTypesPresentInObjects(objects, flatTypes) {
  const titlesInObjects = new Set(
    objects.map((o) => o.type?.title).filter(Boolean),
  );
  const flat = flattenTargetTypeTree(buildTargetTypeTree(flatTypes));
  return flat.filter(({ node }) => titlesInObjects.has(node.title));
}

export function filterTypesForTreeList(search, flatTypes) {
  const list = Array.isArray(flatTypes) ? flatTypes : [];
  const q = search.trim().toLowerCase();

  let pool = list;
  if (q) {
    const byId = Object.fromEntries(list.map((t) => [t.id, t]));
    const includeIds = new Set();
    for (const t of list) {
      if (!(t.title || '').toLowerCase().includes(q)) continue;
      includeIds.add(t.id);
      let pid = t.parent ?? null;
      while (pid != null && byId[pid]) {
        includeIds.add(pid);
        pid = byId[pid].parent ?? null;
      }
    }
    pool = list.filter((t) => includeIds.has(t.id));
  }

  return flattenTargetTypeTree(buildTargetTypeTree(pool));
}

export { NO_TYPE_KEY };
