import React from "react";

export default function ActionZoneFilters({
  actionZoneAvailableByCountry = {},
  actionZoneFilters = {},
  showZoneIntersections = true,
  setShowZoneIntersections,
  toggleActionType,
  toggleAllForCountry,
  resetZoneFilters,
  // When false, hides the top "Показывать точки пересечения" checkbox
  // (used in fullScreen Features when the "Настройка отображения" submode is active)
  showIntersectionsControl = true
}) {
  // Local controlled state for collapsed/expanded country groups.
  // Default: all collapsed (empty set) to keep long lists manageable.
  const [expanded, setExpanded] = React.useState(() => new Set());

  // Clean up countries that are no longer present (e.g. after changing selection)
  const currentCountries = React.useMemo(
    () => Object.keys(actionZoneAvailableByCountry),
    [actionZoneAvailableByCountry]
  );

  React.useEffect(() => {
    setExpanded((prev) => {
      const valid = new Set(currentCountries);
      const next = new Set([...prev].filter((c) => valid.has(c)));
      return next;
    });
  }, [currentCountries]);

  const isExpanded = (cTitle) => expanded.has(cTitle);

  const toggleExpanded = (cTitle) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cTitle)) {
        next.delete(cTitle);
      } else {
        next.add(cTitle);
      }
      return next;
    });
  };

  const expandAllCountries = () => {
    setExpanded(new Set(currentCountries));
  };

  const collapseAllCountries = () => {
    setExpanded(new Set());
  };

  return (
    <div className="action-zone-filters">
      <div className="action-zone-filters__header">
        Зоны действия — отображение
      </div>

      {showIntersectionsControl && (
        <label className="action-zone-filters__checkbox">
          <input
            type="checkbox"
            checked={showZoneIntersections}
            onChange={(e) => setShowZoneIntersections?.(e.target.checked)}
          />{' '}
          Показывать точки пересечения
        </label>
      )}

      <div className="action-zone-filters__section">
        По странам и типам зон:
      </div>

      {currentCountries.length === 0 && (
        <div className="action-zone-filters__empty">Нет зон у выбранных объектов</div>
      )}

      {Object.entries(actionZoneAvailableByCountry).map(([cTitle, typesSet]) => {
        const types = Array.from(typesSet).sort();
        const enabledSet = actionZoneFilters[cTitle] || new Set(types);
        const allOn = types.length > 0 && types.every((t) => enabledSet.has(t));
        const someOn = types.some((t) => enabledSet.has(t));
        const open = isExpanded(cTitle);

        return (
          <details
            key={cTitle}
            className="action-zone-filters__country"
            open={open}
          >
            <summary
              className="action-zone-filters__country-label"
              onClick={(e) => {
                // Do not toggle collapse when clicking the country checkbox itself
                if (e.target.closest('input[type="checkbox"]')) {
                  return;
                }
                e.preventDefault();
                toggleExpanded(cTitle);
              }}
            >
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = !allOn && someOn;
                }}
                onChange={() => toggleAllForCountry?.(cTitle, types, !allOn)}
                onClick={(e) => e.stopPropagation()}
              />{' '}
              {cTitle} <span className="action-zone-filters__count">({types.length})</span>
            </summary>

            <div className="action-zone-filters__types">
              {types.map((t) => (
                <label key={t} className="action-zone-filters__type">
                  <input
                    type="checkbox"
                    checked={enabledSet.has(t)}
                    onChange={() => toggleActionType?.(cTitle, t)}
                  />{' '}
                  {t}
                </label>
              ))}
            </div>
          </details>
        );
      })}

      <div className="action-zone-filters__buttons">
        <button
          type="button"
          className="action-zone-filters__btn"
          onClick={expandAllCountries}
          title="Развернуть все страны"
        >
          Развернуть
        </button>
        <button
          type="button"
          className="action-zone-filters__btn"
          onClick={collapseAllCountries}
          title="Свернуть все страны"
        >
          Свернуть
        </button>
        <button
          type="button"
          className="action-zone-filters__btn"
          onClick={() => resetZoneFilters?.(true)}
        >
          Всё
        </button>
        <button
          type="button"
          className="action-zone-filters__btn"
          onClick={() => resetZoneFilters?.(false)}
        >
          Ничего
        </button>
      </div>
      <div className="action-zone-filters__hint">
        Наведи/кликни на зону на карте для подсветки и выбора объекта
      </div>
    </div>
  );
}
