/**
 * Утилиты для работы с Markdown: очистка превью и вставка форматирования.
 */

/**
 * Убирает служебные символы Markdown для кратких превью в карточках.
 */
export function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  let result = text;

  // Блоки кода
  result = result.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`([^`]+)`/g, '$1');

  // Ссылки [text](url) и ![alt](url)
  result = result.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Заголовки
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Цитаты
  result = result.replace(/^>\s?/gm, '');

  // Списки
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');

  // Жирный, курсив, зачёркнутый
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');
  result = result.replace(/~~([^~]+)~~/g, '$1');

  // Горизонтальные разделители
  result = result.replace(/^[-*_]{3,}\s*$/gm, '');

  // Лишние пробелы и переносы
  result = result.replace(/\n{2,}/g, ' ').replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Применяет форматирование к выделенному тексту в textarea.
 * @param {string} value - текущее значение
 * @param {number} selectionStart
 * @param {number} selectionEnd
 * @param {string} before - маркер до выделения
 * @param {string} after - маркер после выделения
 * @param {string} placeholder - текст при пустом выделении
 */
export function applyWrapFormat(
  value,
  selectionStart,
  selectionEnd,
  before,
  after,
  placeholder = 'текст',
) {
  const selected = value.slice(selectionStart, selectionEnd);
  const text = selected || placeholder;
  const newValue =
    value.slice(0, selectionStart) + before + text + after + value.slice(selectionEnd);
  const start = selectionStart + before.length;
  const end = start + text.length;
  return { value: newValue, selectionStart: start, selectionEnd: end };
}

/**
 * Добавляет префикс к каждой строке в выделении.
 */
export function applyLinePrefixFormat(value, selectionStart, selectionEnd, prefix) {
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);

  const lines = selected.length > 0 ? selected.split('\n') : [''];
  const formatted = lines.map((line) => {
    if (line.startsWith(prefix)) return line;
    return prefix + line;
  }).join('\n');

  const newValue = before + formatted + after;
  return {
    value: newValue,
    selectionStart,
    selectionEnd: selectionStart + formatted.length,
  };
}

/**
 * Вставляет ссылку [текст](url).
 */
export function applyLinkFormat(value, selectionStart, selectionEnd) {
  const selected = value.slice(selectionStart, selectionEnd);
  const text = selected || 'текст';
  const link = `[${text}](url)`;
  const newValue = value.slice(0, selectionStart) + link + value.slice(selectionEnd);
  const urlStart = selectionStart + text.length + 3;
  const urlEnd = urlStart + 3;
  return { value: newValue, selectionStart: urlStart, selectionEnd: urlEnd };
}

/**
 * Вставляет горизонтальный разделитель.
 */
export function applyHorizontalRule(value, selectionStart, selectionEnd) {
  const rule = '\n\n---\n\n';
  const newValue = value.slice(0, selectionStart) + rule + value.slice(selectionEnd);
  const pos = selectionStart + rule.length;
  return { value: newValue, selectionStart: pos, selectionEnd: pos };
}

/**
 * Вставляет шаблон Markdown-таблицы (GFM) заданного размера.
 */
export function applyTableFormat(value, selectionStart, selectionEnd, rows = 2, cols = 3) {
  const colCount = Math.max(1, cols);
  const rowCount = Math.max(1, rows);

  const headerCells = Array.from({ length: colCount }, (_, i) => `Заголовок ${i + 1}`);
  const separatorCells = Array.from({ length: colCount }, () => '---');
  const bodyRow = Array.from({ length: colCount }, () => 'Значение');

  const lines = [
    `| ${headerCells.join(' | ')} |`,
    `| ${separatorCells.join(' | ')} |`,
    ...Array.from({ length: rowCount }, () => `| ${bodyRow.join(' | ')} |`),
  ];

  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n\n')
    ? (before.endsWith('\n') ? '\n' : '\n\n')
    : '';
  const needsTrailingNewline = after.startsWith('\n') ? '\n' : '\n\n';

  const table = needsLeadingNewline + lines.join('\n') + needsTrailingNewline;
  const newValue = before + table + after;
  const pos = before.length + table.length;

  return { value: newValue, selectionStart: pos, selectionEnd: pos };
}

/**
 * Восстанавливает позицию курсора в textarea после программного изменения.
 */
export function restoreSelection(textarea, start, end) {
  if (!textarea) return;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start, end);
  });
}
