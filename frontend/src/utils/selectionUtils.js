/** Переключение id в списке выбранных элементов (чекбоксы таблиц). */
export function toggleIdInList(prev, id, checked) {
  if (checked) {
    return prev.includes(id) ? prev : [...prev, id];
  }
  return prev.filter((itemId) => itemId !== id);
}
