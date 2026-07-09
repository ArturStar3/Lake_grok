import React from "react";
import "./ActionZoneFilters.css";

function QuickSelectTable({
  title,
  items,
  selectedSet,
  onToggleItem,
  onSelectAll,
}) {
  const allOn = items.length > 0 && items.every((item) => selectedSet.has(item));
  const someOn = items.some((item) => selectedSet.has(item));

  return (
    <div className="action-zone-filters__quick-table">
      <div className="action-zone-filters__quick-header">
        <label className="action-zone-filters__quick-header-label">
          <input
            type="checkbox"
            checked={allOn}
            ref={(el) => {
              if (el) el.indeterminate = !allOn && someOn;
            }}
            onChange={() => onSelectAll?.(!allOn)}
          />
          <span>{title}</span>
        </label>
        <span className="action-zone-filters__quick-count">
          {selectedSet.size} / {items.length}
        </span>
      </div>
      <div className="action-zone-filters__quick-list">
        {items.map((item) => (
          <label key={item} className="action-zone-filters__type-row">
            <input
              type="checkbox"
              checked={selectedSet.has(item)}
              onChange={() => onToggleItem?.(item)}
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ActionZoneFilters({
  actionZoneAvailableByCountry = {},
  actionZoneFilters = {},
  showZoneIntersections = false,
  setShowZoneIntersections,
  hasEnabledZones: _hasEnabledZones = true,
  toggleActionType,
  toggleAllForCountry,
  resetZoneFilters,
  allActionTypes = [],
  quickSelectTypes = new Set(),
  quickSelectCountries = new Set(),
  quickSelectCombo = new Set(),
  toggleQuickSelectType,
  toggleQuickSelectCountry,
  setAllQuickSelectTypes,
  setAllQuickSelectCountries,
  showIntersectionsControl = true,
  considerTerrain = true,
  onConsiderTerrainChange,
  losComputingCount = 0,
  losZonesCount = 0,
  variant = "tab",
}) {
  const [subTab, setSubTab] = React.useState("by-country");
  const [expanded, setExpanded] = React.useState(() => new Set());

  const currentCountries = React.useMemo(
    () => Object.keys(actionZoneAvailableByCountry).sort(),
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
      <div className="action-zone-filters__subtabs formular__tabs">
        <button
          type="button"
          className={`formular__tab${subTab === "by-country" ? " formular__tab--active" : ""}`}
          onClick={() => setSubTab("by-country")}
        >
          По странам
        </button>
        <button
          type="button"
          className={`formular__tab${subTab === "quick-select" ? " formular__tab--active" : ""}`}
          onClick={() => setSubTab("quick-select")}
        >
          Быстрый выбор
        </button>
      </div>

      <div className="formular__select-all-bar action-zone-filters__options">
        <label className="select-all-label">
          <input
            type="checkbox"
            checked={considerTerrain}
            onChange={(e) => onConsiderTerrainChange?.(e.target.checked)}
          />{' '}
          Учитывать рельеф
        </label>
        {considerTerrain && losZonesCount > 0 && losComputingCount > 0 && (
          <span className="action-zone-filters__status" role="status">
            Расчёт… {losComputingCount} / {losZonesCount}
          </span>
        )}
      </div>

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

      {subTab === "by-country" && (
        <>
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
        </>
      )}

      {subTab === "quick-select" && (
        <>
          {allActionTypes.length === 0 && currentCountries.length === 0 ? (
            <div className="action-zone-filters__empty">Нет зон действия в данных</div>
          ) : (
            <div className="action-zone-filters__quick-select">
              <QuickSelectTable
                title="Типы зон"
                items={allActionTypes}
                selectedSet={quickSelectTypes}
                onToggleItem={toggleQuickSelectType}
                onSelectAll={setAllQuickSelectTypes}
              />
              <QuickSelectTable
                title="Страны"
                items={currentCountries}
                selectedSet={quickSelectCountries}
                onToggleItem={toggleQuickSelectCountry}
                onSelectAll={setAllQuickSelectCountries}
              />
              <p className="action-zone-filters__quick-hint">
                Активно комбинаций: {quickSelectCombo.size}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
