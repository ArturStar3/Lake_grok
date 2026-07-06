import { useRef, useState } from 'react';
import MarkdownContent from './MarkdownContent';
import {
  applyHorizontalRule,
  applyLinePrefixFormat,
  applyLinkFormat,
  applyTableFormat,
  applyWrapFormat,
  restoreSelection,
} from '../../../utils/markdown';
import './MarkdownEditor.css';

const TOOLBAR_ACTIONS = [
  { id: 'h2', label: 'H2', title: 'Заголовок 2 уровня', type: 'prefix', prefix: '## ' },
  { id: 'h3', label: 'H3', title: 'Заголовок 3 уровня', type: 'prefix', prefix: '### ' },
  { id: 'divider1', type: 'divider' },
  { id: 'bold', label: 'B', title: 'Жирный (**текст**)', type: 'wrap', before: '**', after: '**' },
  { id: 'italic', label: 'I', title: 'Курсив (*текст*)', type: 'wrap', before: '*', after: '*' },
  { id: 'strike', label: 'S', title: 'Зачёркнутый (~~текст~~)', type: 'wrap', before: '~~', after: '~~' },
  { id: 'divider2', type: 'divider' },
  { id: 'ul', label: '•', title: 'Маркированный список', type: 'prefix', prefix: '- ' },
  { id: 'ol', label: '1.', title: 'Нумерованный список', type: 'prefix', prefix: '1. ' },
  { id: 'quote', label: '❝', title: 'Цитата', type: 'prefix', prefix: '> ' },
  { id: 'link', label: '🔗', title: 'Ссылка', type: 'link' },
  { id: 'table', label: '▦', title: 'Вставить таблицу', type: 'table' },
  { id: 'hr', label: '—', title: 'Разделитель', type: 'hr', className: 'markdown-editor__btn--separator' },
];

export default function MarkdownEditor({
  value = '',
  onChange,
  placeholder = 'Введите текст...',
  rows = 4,
  disabled = false,
  variant = 'default',
  className = '',
}) {
  const textareaRef = useRef(null);
  const [mode, setMode] = useState('edit');

  const applyFormat = (action) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    let result;

    switch (action.type) {
      case 'wrap':
        result = applyWrapFormat(value, start, end, action.before, action.after);
        break;
      case 'prefix':
        result = applyLinePrefixFormat(value, start, end, action.prefix);
        break;
      case 'link':
        result = applyLinkFormat(value, start, end);
        break;
      case 'hr':
        result = applyHorizontalRule(value, start, end);
        break;
      case 'table':
        result = applyTableFormat(value, start, end, 2, 3);
        break;
      default:
        return;
    }

    onChange?.(result.value);
    restoreSelection(textarea, result.selectionStart, result.selectionEnd);
  };

  const minHeight = variant === 'compact' ? Math.max(rows * 18, 60) : Math.max(rows * 22, 80);

  return (
    <div
      className={`markdown-editor markdown-editor--${variant} ${
        disabled ? 'markdown-editor--disabled' : ''
      } ${className}`.trim()}
    >
      <div className="markdown-editor__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'edit'}
          className={`markdown-editor__tab${mode === 'edit' ? ' markdown-editor__tab--active' : ''}`}
          onClick={() => setMode('edit')}
          disabled={disabled}
        >
          Правка
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          className={`markdown-editor__tab${mode === 'preview' ? ' markdown-editor__tab--active' : ''}`}
          onClick={() => setMode('preview')}
          disabled={disabled}
        >
          Предпросмотр
        </button>
      </div>

      {mode === 'edit' && (
        <div className="markdown-editor__toolbar" role="toolbar" aria-label="Форматирование">
          {TOOLBAR_ACTIONS.map((action) => {
            if (action.type === 'divider') {
              return <span key={action.id} className="markdown-editor__toolbar-divider" aria-hidden />;
            }
            return (
              <button
                key={action.id}
                type="button"
                className={`markdown-editor__btn${action.className ? ` ${action.className}` : ''}`}
                title={action.title}
                onClick={() => applyFormat(action)}
                disabled={disabled}
                aria-label={action.title}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="markdown-editor__body">
        {mode === 'edit' ? (
          <textarea
            ref={textareaRef}
            className="markdown-editor__textarea"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            style={{ minHeight }}
          />
        ) : (
          <div className="markdown-editor__preview" style={{ minHeight }}>
            {value?.trim() ? (
              <MarkdownContent variant={variant === 'compact' ? 'compact' : 'default'}>
                {value}
              </MarkdownContent>
            ) : (
              <span className="markdown-editor__preview-empty">Нет содержимого для предпросмотра</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
