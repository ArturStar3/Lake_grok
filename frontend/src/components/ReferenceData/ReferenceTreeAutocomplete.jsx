import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../TargetEquipment/EquipmentAutocomplete.css';

const LIST_Z_INDEX = 13000;

function computeListPosition(inputEl) {
  if (!inputEl) return null;
  const rect = inputEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const maxHeight = Math.min(260, Math.max(spaceBelow, spaceAbove, 120));
  const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;

  return {
    position: 'fixed',
    left: rect.left,
    width: rect.width,
    zIndex: LIST_Z_INDEX,
    maxHeight,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };
}

function formatTreeLabel(item, depthOf) {
  if (item.isRoot) return item.title;
  const depth = depthOf(item.id);
  const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
  return `${prefix}${item.title}`;
}

export default function ReferenceTreeAutocomplete({
  items = [],
  value = '',
  onChange,
  depthOf = () => 0,
  rootLabel = '— корневой —',
  placeholder = 'Поиск родительского типа…',
  disabled = false,
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [listStyle, setListStyle] = useState(null);

  const options = useMemo(() => {
    const root = { id: '', title: rootLabel, isRoot: true };
    return [root, ...items.map((item) => ({ ...item, isRoot: false }))];
  }, [items, rootLabel]);

  const selected = useMemo(
    () => options.find((item) => String(item.id) === String(value ?? '')) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => formatTreeLabel(item, depthOf).toLowerCase().includes(q));
  }, [options, search, depthOf]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch('');
    setHighlightIndex(0);
  }, []);

  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setHighlightIndex(0);
  }, [disabled]);

  const selectItem = useCallback(
    (item) => {
      onChange(item.isRoot ? '' : String(item.id));
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  const updateListPosition = useCallback(() => {
    setListStyle(computeListPosition(inputRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setListStyle(null);
      return undefined;
    }
    updateListPosition();
    window.addEventListener('resize', updateListPosition);
    window.addEventListener('scroll', updateListPosition, true);
    return () => {
      window.removeEventListener('resize', updateListPosition);
      window.removeEventListener('scroll', updateListPosition, true);
    };
  }, [isOpen, search, filtered.length, updateListPosition]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  const handleInputChange = (e) => {
    setSearch(e.target.value);
    open();
    if (value) {
      onChange('');
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      open();
      return;
    }
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        selectItem(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const displayValue = isOpen
    ? search
    : (selected ? formatTreeLabel(selected, depthOf) : '');

  const listContent = isOpen && listStyle ? (
    <ul
      ref={listRef}
      className="equipment-autocomplete__list equipment-autocomplete__list--portal"
      id={listId}
      role="listbox"
      style={listStyle}
    >
      {filtered.length === 0 ? (
        <li className="equipment-autocomplete__empty">Ничего не найдено</li>
      ) : (
        filtered.map((item, index) => (
          <li key={item.isRoot ? '__root__' : item.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={index === highlightIndex}
              className={`equipment-autocomplete__option${
                index === highlightIndex ? ' equipment-autocomplete__option--active' : ''
              }${String(value) === String(item.id) ? ' equipment-autocomplete__option--selected' : ''}`}
              style={
                !item.isRoot
                  ? { paddingLeft: `${12 + depthOf(item.id) * 14}px` }
                  : undefined
              }
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => selectItem(item)}
            >
              <span className="equipment-autocomplete__option-title">
                {formatTreeLabel(item, depthOf)}
              </span>
            </button>
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <div
      className={`equipment-autocomplete${disabled ? ' equipment-autocomplete--disabled' : ''}`}
      ref={containerRef}
    >
      <div className="equipment-autocomplete__control">
        <input
          ref={inputRef}
          type="text"
          className="equipment-autocomplete__input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={open}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {selected && !selected.isRoot && !isOpen && (
          <button
            type="button"
            className="equipment-autocomplete__clear"
            onClick={() => {
              onChange('');
              setSearch('');
              open();
            }}
            aria-label="Сбросить родительский тип"
          >
            ×
          </button>
        )}
      </div>

      {listContent && createPortal(listContent, document.body)}
    </div>
  );
}
