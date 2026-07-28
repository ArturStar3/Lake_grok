import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import L from 'leaflet';
import { useMapFlyTo } from '../../hooks/formular/useMapFlyTo';
import {
  buildMapSearchResults,
  findCountryFeature,
  normalizeSearchQuery,
} from '../../utils/mapSearchUtils';
import './MapSearchControl.css';

const OBJECT_FLY_ZOOM = 10;

const COUNTRY_BOUNDS_OPTIONS = {
  padding: [48, 48],
  maxZoom: 6,
  duration: 1.0,
  easeLinearity: 0.3,
};

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ResultOption({
  item,
  index,
  highlightIndex,
  onSelect,
}) {
  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={index === highlightIndex}
        className={`map-search-control__option${
          index === highlightIndex ? ' map-search-control__option--active' : ''
        }`}
        onMouseEnter={() => onSelect(index, { hoverOnly: true })}
        onClick={() => onSelect(index, { hoverOnly: false })}
      >
        <span className="map-search-control__option-title">{item.title}</span>
        {item.subtitle ? (
          <span className="map-search-control__option-meta">{item.subtitle}</span>
        ) : null}
      </button>
    </li>
  );
}

export default function MapSearchControl({
  objects = [],
  countries = [],
  geoData = null,
  mapRef,
}) {
  const listId = useId();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const { flyTo, flyToBounds } = useMapFlyTo(mapRef);

  const results = useMemo(
    () => buildMapSearchResults({ countries, objects, query }),
    [countries, objects, query],
  );

  const hasQuery = normalizeSearchQuery(query).length > 0;
  const showDropdown = isExpanded && hasQuery;

  const collapse = useCallback(() => {
    setIsExpanded(false);
    setQuery('');
    setHighlightIndex(0);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
    setHighlightIndex(0);
  }, []);

  const handleToggle = useCallback(() => {
    if (isExpanded) {
      collapse();
      return;
    }
    expand();
  }, [collapse, expand, isExpanded]);

  const navigateToResult = useCallback((item) => {
    if (!item) return;

    if (item.type === 'object') {
      const { lat, lng } = item.object ?? {};
      flyTo(lat, lng, OBJECT_FLY_ZOOM);
    } else if (item.type === 'country') {
      const feature = findCountryFeature(geoData, item.country?.iso_code);
      if (feature) {
        const bounds = L.geoJSON(feature).getBounds();
        if (bounds?.isValid?.()) {
          flyToBounds(bounds, COUNTRY_BOUNDS_OPTIONS);
        }
      }
    }

    collapse();
  }, [collapse, flyTo, flyToBounds, geoData]);

  const handleHighlight = useCallback((index, { hoverOnly = false } = {}) => {
    setHighlightIndex(index);
    if (!hoverOnly && results.flat[index]) {
      navigateToResult(results.flat[index]);
    }
  }, [navigateToResult, results.flat]);

  useEffect(() => {
    if (!isExpanded) return undefined;

    const handleClickOutside = (event) => {
      if (containerRef.current?.contains(event.target)) return;
      collapse();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [collapse, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isExpanded]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  const handleInputKeyDown = (event) => {
    const { flat } = results;

    if (event.key === 'Escape') {
      event.preventDefault();
      collapse();
      return;
    }

    if (!showDropdown || flat.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      navigateToResult(flat[highlightIndex]);
    }
  };

  let flatIndex = 0;

  return (
    <div
      ref={containerRef}
      className={`map-search-control${isExpanded ? ' map-search-control--expanded' : ''}`}
    >
      <button
        type="button"
        className="map-search-control__toggle"
        onClick={handleToggle}
        aria-label={isExpanded ? 'Закрыть поиск' : 'Поиск по карте'}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? listId : undefined}
      >
        {isExpanded ? <CloseIcon /> : <SearchIcon />}
      </button>

      {isExpanded ? (
        <div className="map-search-control__input-wrap">
          <input
            ref={inputRef}
            type="search"
            className="map-search-control__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Объекты, страны…"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
          />

          {showDropdown ? (
            <ul
              id={listId}
              className="map-search-control__dropdown"
              role="listbox"
            >
              {results.isEmpty ? (
                <li className="map-search-control__empty">Ничего не найдено</li>
              ) : (
                <>
                  {results.countries.length > 0 ? (
                    <>
                      <li className="map-search-control__section-label" aria-hidden="true">
                        Страны
                      </li>
                      {results.countries.map((item) => {
                        const index = flatIndex;
                        flatIndex += 1;
                        return (
                          <ResultOption
                            key={`country-${item.id}`}
                            item={item}
                            index={index}
                            highlightIndex={highlightIndex}
                            onSelect={handleHighlight}
                          />
                        );
                      })}
                    </>
                  ) : null}

                  {results.objects.length > 0 ? (
                    <>
                      <li className="map-search-control__section-label" aria-hidden="true">
                        Объекты
                      </li>
                      {results.objects.map((item) => {
                        const index = flatIndex;
                        flatIndex += 1;
                        return (
                          <ResultOption
                            key={`object-${item.id}`}
                            item={item}
                            index={index}
                            highlightIndex={highlightIndex}
                            onSelect={handleHighlight}
                          />
                        );
                      })}
                    </>
                  ) : null}
                </>
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
