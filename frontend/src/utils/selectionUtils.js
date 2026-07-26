/** Переключение id в списке выбранных элементов (чекбоксы таблиц). */
export function toggleIdInList(prev, id, checked) {
  const key = String(id);
  if (checked) {
    return prev.some((itemId) => String(itemId) === key) ? prev : [...prev, id];
  }
  return prev.filter((itemId) => String(itemId) !== key);
}

/**
 * Пакетное добавление/удаление id (select-all, чекбокс страны/типа).
 * Одно обновление состояния вместо N вызовов toggleIdInList.
 */
export function toggleIdsInList(prev, ids, checked) {
  const list = Array.isArray(ids) ? ids : [];
  if (list.length === 0) return prev;

  if (checked) {
    const existing = new Set((prev || []).map((itemId) => String(itemId)));
    const next = [...(prev || [])];
    list.forEach((id) => {
      const key = String(id);
      if (!existing.has(key)) {
        existing.add(key);
        next.push(id);
      }
    });
    return next;
  }

  const remove = new Set(list.map((id) => String(id)));
  return (prev || []).filter((itemId) => !remove.has(String(itemId)));
}
