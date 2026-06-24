import React from "react";
import "./ActionZoneFilters.css";

export default function ActionZoneFilters({
  actionZoneAvailableByCountry = {},
  actionZoneFilters = {},
  showZoneIntersections = false,
  setShowZoneIntersections,
  toggleActionType,
  toggleAllForCountry,
  resetZoneFilters,
  showIntersectionsControl = true,
  variant = "tab",
}) {
  const [expanded, setExpanded] = React.useState(() => new Set());

  const currentCountries = React.useMemo(
    () => Object.keys(actionZoneAvailableByCountry),
    [actionZoneAvailableByCountry],
  );

  React.useEffect(() => {
    setExpanded((prev) => {
      const valid = new Set(currentCountries);
      return new Set([...prev].filter((c) => valid.has(c)));
    });
  }, [currentCountries]);

  const isExpanded = (cTitle) => expanded.has(cTitle);

  const toggleExpanded = (cTitle) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cTitle)) next.delete(cTitle);
      else next.add(cTitle);
      return next;
    });
  };

  const expandAllCountries = () => setExpanded(new Set(currentCountries));
  const collapseAllCountries = () => setExpanded(new Set());

  const rootClass = variant === "tab"
    ? "action-zone-filters action-zone-filters--tab"
    : "action-zone-filters";

  return (
    <div className={rootClass}>
      {showIntersectionsControl && (
        <div className="formular__select-all-bar">
          <label className="select-all-label">
            <input
              type="checkbox"
              checked={showZoneIntersections}
              onChange={(e) => setShowZoneIntersections?.(e.target.checked)}
            />{' '}
            Показывать точки пересечения
          </label>
        </div>
      )}

      <div className="expand-controls">
        <button type="button" className="expand-btn" onClick={expandAllCountries}>
          Развернуть
        </button>
        <button type="button" className="expand-btn" onClick={collapseAllCountries}>
          Свернуть
        </button>
        <button type="button" className="expand-btn" onClick={() => resetZoneFilters?.(true)}>
          Всё
        </button>
        <button type="button" className="expand-btn" onClick={() => resetZoneFilters?.(false)}>
          Ничего
        </button>
      </div>

      {currentCountries.length === 0 && (
        <div className="action-zone-filters__empty">Нет зон действия в данных</div>
      )}

      <div className="formular__country-groups">
        {Object.entries(actionZoneAvailableByCountry).map(([cTitle, typesSet]) => {
          const types = Array.from(typesSet).sort();
          const enabledSet = actionZoneFilters[cTitle] ?? new Set();
          const allOn = types.length > 0 && types.every((t) => enabledSet.has(t));
          const someOn = types.some((t) => enabledSet.has(t));
          const open = isExpanded(cTitle);

          return (
            <details key={cTitle} className="country-group" open={open}>
              <summary
                className="country-header"
                onClick={(e) => {
                  if (e.target.closest('input[type="checkbox"]')) return;
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
                />
                <span className="country-name">{cTitle}</span>
                <span className="country-count">({types.length})</span>
                {!allOn && someOn && <span className="country-partial">частично</span>}
              </summary>

              <div className="country-objects">
                {types.map((t) => (
                  <label key={t} className="action-zone-filters__type-row">
                    <input
                      type="checkbox"
                      checked={enabledSet.has(t)}
                      onChange={() => toggleActionType?.(cTitle, t)}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
