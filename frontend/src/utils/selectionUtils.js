/** Переключение id в списке выбранных элементов (чекбоксы таблиц). */
export function toggleIdInList(prev, id, checked) {
  const key = String(id);
  if (checked) {
    return prev.some((itemId) => String(itemId) === key) ? prev : [...prev, id];
  }
  return prev.filter((itemId) => String(itemId) !== key);
}
