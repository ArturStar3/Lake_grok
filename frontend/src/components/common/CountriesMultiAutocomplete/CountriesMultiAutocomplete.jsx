import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../TargetEquipment/EquipmentAutocomplete.css';
import './CountriesMultiAutocomplete.css';

const LIST_Z_INDEX = 13000;
const RESULT_LIMIT = 50;

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

export default function CountriesMultiAutocomplete({
  countries = [],
  value = [],
  onChange,
  placeholder = 'Поиск страны…',
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

  const selectedSet = useMemo(() => new Set(value), [value]);
  const countryById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  );

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.title.localeCompare(b.title)),
    [countries],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = sortedCountries.filter((country) => {
      if (needle && !country.title.toLowerCase().includes(needle)) return false;
      return !selectedSet.has(country.id);
    });
    return matched.slice(0, RESULT_LIMIT);
  }, [sortedCountries, search, selectedSet]);

  const selectedCountries = useMemo(
    () => value
      .map((id) => countryById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [value, countryById],
  );

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

  const addCountry = useCallback((countryId) => {
    if (selectedSet.has(countryId)) return;
    onChange?.([...value, countryId]);
    setSearch('');
    setHighlightIndex(0);
    inputRef.current?.focus();
  }, [onChange, selectedSet, value]);

  const removeCountry = useCallback((countryId) => {
    onChange?.(value.filter((id) => id !== countryId));
  }, [onChange, value]);

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

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      open();
      return;
    }
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter' && filtered[highlightIndex]) {
      e.preventDefault();
      addCountry(filtered[highlightIndex].id);
    }
  };

  const listContent = isOpen && listStyle && (
    <ul
      ref={listRef}
      id={listId}
      className="equipment-autocomplete__list equipment-autocomplete__list--portal"
      style={listStyle}
      role="listbox"
    >
      {filtered.length === 0 ? (
        <li className="equipment-autocomplete__empty">
          {search.trim() ? 'Ничего не найдено' : 'Все страны уже выбраны'}
        </li>
      ) : (
        filtered.map((country, index) => (
          <li key={country.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={index === highlightIndex}
              className={`equipment-autocomplete__option${
                index === highlightIndex ? ' equipment-autocomplete__option--active' : ''
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addCountry(country.id)}
            >
              <span className="equipment-autocomplete__option-title">{country.title}</span>
            </button>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div
      ref={containerRef}
      className={`countries-multi-autocomplete equipment-autocomplete${
        disabled ? ' equipment-autocomplete--disabled' : ''
      }`}
    >
      {selectedCountries.length > 0 && (
        <div className="countries-multi-autocomplete__chips">
          {selectedCountries.map((country) => (
            <span key={country.id} className="countries-multi-autocomplete__chip">
              {country.title}
              {!disabled && (
                <button
                  type="button"
                  className="countries-multi-autocomplete__chip-remove"
                  onClick={() => removeCountry(country.id)}
                  aria-label={`Убрать ${country.title}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="equipment-autocomplete__control">
        <input
          ref={inputRef}
          type="text"
          className="equipment-autocomplete__input"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) open();
          }}
          onFocus={open}
          onKeyDown={handleKeyDown}
          placeholder={selectedCountries.length > 0 ? 'Добавить страну…' : placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {listContent && createPortal(listContent, document.body)}
    </div>
  );
}
