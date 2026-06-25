import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  filterEquipmentCatalog,
  formatEquipmentLabel,
  formatEquipmentSubtitle,
} from '../../utils/equipmentCatalogUtils';
import './EquipmentAutocomplete.css';

const RESULT_LIMIT = 50;

export default function EquipmentAutocomplete({
  catalog = [],
  value = '',
  onChange,
  excludeIds = [],
  placeholder = 'Поиск: обозначение, название, категория…',
  error = null,
  disabled = false,
  clearOnSelect = false,
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const numericValue = value ? parseInt(value, 10) : null;
  const availableCatalog = catalog.filter(
    (item) => !excludeIds.includes(item.id) || item.id === numericValue,
  );
  const { items: filtered, total: totalMatches } = filterEquipmentCatalog(
    search,
    availableCatalog,
    RESULT_LIMIT,
  );
  const selected = numericValue
    ? catalog.find((item) => item.id === numericValue)
    : null;

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
      onChange(item.id);
      if (clearOnSelect) {
        setSearch('');
      }
      close();
    },
    [clearOnSelect, close, onChange],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

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
    if (numericValue) {
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

  const displayValue = isOpen ? search : (selected ? formatEquipmentLabel(selected) : search);

  return (
    <div
      className={`equipment-autocomplete${error ? ' equipment-autocomplete--error' : ''}${
        disabled ? ' equipment-autocomplete--disabled' : ''
      }`}
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
        {selected && !isOpen && (
          <button
            type="button"
            className="equipment-autocomplete__clear"
            onClick={() => {
              onChange('');
              setSearch('');
              open();
            }}
            aria-label="Очистить выбор"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <ul className="equipment-autocomplete__list" id={listId} role="listbox">
          {filtered.length === 0 ? (
            <li className="equipment-autocomplete__empty">Ничего не найдено</li>
          ) : (
            filtered.map((item, index) => (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlightIndex}
                  className={`equipment-autocomplete__option${
                    index === highlightIndex ? ' equipment-autocomplete__option--active' : ''
                  }${numericValue === item.id ? ' equipment-autocomplete__option--selected' : ''}`}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => selectItem(item)}
                >
                  <span className="equipment-autocomplete__option-title">
                    {formatEquipmentLabel(item)}
                  </span>
                  {formatEquipmentSubtitle(item) && (
                    <span className="equipment-autocomplete__option-meta">
                      {formatEquipmentSubtitle(item)}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
          {totalMatches > RESULT_LIMIT && (
            <li className="equipment-autocomplete__hint">
              Показано {RESULT_LIMIT} из {totalMatches}. Уточните запрос.
            </li>
          )}
        </ul>
      )}

      {error && <span className="equipment-autocomplete__error">{error}</span>}
    </div>
  );
}
