import { useEffect, useMemo, useRef, useState } from 'react';
import '../Events/EventsFilterPanel.css';
import './OperationalSituation.css';

export default function SituationsFilterPanel({ countries, filters, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const countryDropdownRef = useRef(null);

  const countryOptions = useMemo(
    () => [...countries].sort((a, b) => a.title.localeCompare(b.title)),
    [countries],
  );

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryOptions;
    const needle = countrySearch.trim().toLowerCase();
    const matched = countryOptions.filter((country) => country.title.toLowerCase().includes(needle));
    const selected = countryOptions.filter((country) => filters.countries.includes(country.id));
    return [...new Set([...selected, ...matched])];
  }, [countryOptions, countrySearch, filters.countries]);

  const handleCountryToggle = (id) => {
    const next = filters.countries.includes(id)
      ? filters.countries.filter((cid) => cid !== id)
      : [...filters.countries, id];
    onChange({ ...filters, countries: next });
  };

  const handleSelectAll = () => {
    if (filters.countries.length === countryOptions.length) {
      onChange({ ...filters, countries: [] });
    } else {
      onChange({ ...filters, countries: countryOptions.map((c) => c.id) });
    }
  };

  const handleReset = () => {
    onChange({ title: '', dateFrom: '', dateTo: '', countries: [] });
    setCountrySearch('');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!countryDropdownRef.current?.contains(event.target)) {
        setIsCountryDropdownOpen(false);
      }
    };
    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCountryDropdownOpen]);

  const activeFiltersCount =
    (filters.title?.trim() ? 1 : 0)
    + (filters.dateFrom ? 1 : 0)
    + (filters.dateTo ? 1 : 0)
    + filters.countries.length;

  return (
    <div className="events-filter situations-filter">
      <div className="events-filter__header">
        <button
          type="button"
          className="events-filter__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span className="events-filter__title">Фильтры обстановки</span>
          {activeFiltersCount > 0 && (
            <span className="events-filter__badge">{activeFiltersCount}</span>
          )}
          <span className={`events-filter__chevron${isExpanded ? ' events-filter__chevron--expanded' : ''}`}>
            ▼
          </span>
        </button>
        {activeFiltersCount > 0 && (
          <button type="button" className="events-filter__reset" onClick={handleReset}>
            Сбросить
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="events-filter__content">
          <div className="events-filter__section">
            <label className="events-filter__label">Название</label>
            <input
              type="text"
              className="events-filter__input"
              value={filters.title}
              onChange={(e) => onChange({ ...filters, title: e.target.value })}
              placeholder="Поиск по названию"
            />
          </div>
          <div className="events-filter__row">
            <div className="events-filter__section">
              <label className="events-filter__label">Дата от</label>
              <input
                type="date"
                className="events-filter__input"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div className="events-filter__section">
              <label className="events-filter__label">Дата до</label>
              <input
                type="date"
                className="events-filter__input"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>
          <div className="events-filter__section" ref={countryDropdownRef}>
            <label className="events-filter__label">Страна</label>
            <div className="events-filter__multi-select">
              <button
                type="button"
                className="events-filter__multi-select-trigger"
                onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
              >
                <span>
                  {filters.countries.length === 0
                    ? 'Все страны'
                    : filters.countries.length === countryOptions.length
                      ? 'Все страны'
                      : `Выбрано: ${filters.countries.length}`}
                </span>
                <span className={`events-filter__multi-select-arrow${isCountryDropdownOpen ? ' events-filter__multi-select-arrow--open' : ''}`}>
                  ▼
                </span>
              </button>
              {isCountryDropdownOpen && (
                <div className="events-filter__dropdown">
                  <div className="events-filter__dropdown-header">
                    <button type="button" className="events-filter__select-all" onClick={handleSelectAll}>
                      {filters.countries.length === countryOptions.length ? 'Снять все' : 'Выбрать все'}
                    </button>
                  </div>
                  <div className="events-filter__dropdown-search">
                    <input
                      type="text"
                      className="events-filter__search-input"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Поиск страны..."
                    />
                  </div>
                  <div className="events-filter__dropdown-list">
                    {filteredCountries.length === 0 && (
                      <div className="events-filter__no-results">Ничего не найдено</div>
                    )}
                    {filteredCountries.map((country) => (
                      <label key={country.id} className="events-filter__checkbox-label">
                        <input
                          type="checkbox"
                          className="events-filter__checkbox"
                          checked={filters.countries.includes(country.id)}
                          onChange={() => handleCountryToggle(country.id)}
                        />
                        <span className="events-filter__checkbox-text">{country.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
