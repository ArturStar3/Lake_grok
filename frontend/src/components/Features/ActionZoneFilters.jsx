import React from "react";
import { getAllLeavesForActionType } from "../../utils/buildVisibleZones";
import { makeParamLeaf, ZONE_LEAF_MANUAL } from "../../utils/inundationZone";
import "./ActionZoneFilters.css";

const MANUAL_ZONE_LABEL = "Зона объекта";
const EXPAND_SEP = "\u0001";

function countCountryLeaves(groups) {
  return groups.reduce((sum, group) => sum + getAllLeavesForActionType(group).length, 0);
}

function countEnabledCountryLeaves(countryFilters, groups) {
  let enabled = 0;
  groups.forEach((group) => {
    const leafSet = countryFilters?.[String(group.actionTypeId)] || new Set();
    getAllLeavesForActionType(group).forEach((leaf) => {
      if (leafSet.has(leaf)) enabled += 1;
    });
  });
  return enabled;
}

function getActionTypeCheckState(countryFilters, group) {
  const leaves = getAllLeavesForActionType(group);
  const leafSet = countryFilters?.[String(group.actionTypeId)] || new Set();
  const enabledCount = leaves.filter((leaf) => leafSet.has(leaf)).length;
  return {
    allOn: leaves.length > 0 && enabledCount === leaves.length,
    someOn: enabledCount > 0 && enabledCount < leaves.length,
    enabledCount,
    total: leaves.length,
  };
}

function QuickSelectTable({
  title,
  items,
  getItemKey,
  getItemLabel,
  selectedSet,
  onToggleItem,
  onSelectAll,
}) {
  const allOn = items.length > 0 && items.every((item) => selectedSet.has(getItemKey(item)));
  const someOn = items.some((item) => selectedSet.has(getItemKey(item)));

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
        {items.map((item) => {
          const key = getItemKey(item);
          return (
            <label key={key} className="action-zone-filters__type-row">
              <input
                type="checkbox"
                checked={selectedSet.has(key)}
                onChange={() => onToggleItem?.(key)}
              />
              <span>{getItemLabel(item)}</span>
            </label>
          );
        })}
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
  toggleZoneLeaf,
  toggleAllForActionType,
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
  const [expandedCountries, setExpandedCountries] = React.useState(() => new Set());
  const [expandedActionTypes, setExpandedActionTypes] = React.useState(() => new Set());

  const currentCountries = React.useMemo(
    () => Object.keys(actionZoneAvailableByCountry).sort(),
    [actionZoneAvailableByCountry],
  );

  React.useEffect(() => {
    setExpandedCountries((prev) => {
      const valid = new Set(currentCountries);
      return new Set([...prev].filter((c) => valid.has(c)));
    });
  }, [currentCountries]);

  const actionTypeExpandKey = (country, actionTypeId) =>
    `${country}${EXPAND_SEP}${actionTypeId}`;

  const isCountryExpanded = (cTitle) => expandedCountries.has(cTitle);
  const isActionTypeExpanded = (country, actionTypeId) =>
    expandedActionTypes.has(actionTypeExpandKey(country, actionTypeId));

  const toggleCountryExpanded = (cTitle) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(cTitle)) next.delete(cTitle);
      else next.add(cTitle);
      return next;
    });
  };

  const toggleActionTypeExpanded = (country, actionTypeId) => {
    const key = actionTypeExpandKey(country, actionTypeId);
    setExpandedActionTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllCountries = () => setExpandedCountries(new Set(currentCountries));
  const collapseAllCountries = () => {
    setExpandedCountries(new Set());
    setExpandedActionTypes(new Set());
  };

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
          />{" "}
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
            />{" "}
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
            {Object.entries(actionZoneAvailableByCountry).map(([cTitle, groups]) => {
              const countryFilters = actionZoneFilters[cTitle] || {};
              const totalLeaves = countCountryLeaves(groups);
              const enabledLeaves = countEnabledCountryLeaves(countryFilters, groups);
              const allOn = totalLeaves > 0 && enabledLeaves === totalLeaves;
              const someOn = enabledLeaves > 0 && enabledLeaves < totalLeaves;
              const open = isCountryExpanded(cTitle);

              return (
                <details key={cTitle} className="country-group" open={open}>
                  <summary
                    className="country-header"
                    onClick={(e) => {
                      if (e.target.closest('input[type="checkbox"]')) return;
                      e.preventDefault();
                      toggleCountryExpanded(cTitle);
                    }}
                  >
                    <span
                      className={`action-zone-filters__chevron${open ? " action-zone-filters__chevron--expanded" : ""}`}
                      aria-hidden="true"
                    />
                    <input
                      type="checkbox"
                      checked={allOn}
                      ref={(el) => {
                        if (el) el.indeterminate = !allOn && someOn;
                      }}
                      onChange={() => toggleAllForCountry?.(cTitle, groups, !allOn)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="country-name">{cTitle}</span>
                    <span className="country-count">({groups.length})</span>
                    {!allOn && someOn && <span className="country-partial">частично</span>}
                  </summary>

                  <div className="country-objects">
                    {groups.map((group) => {
                      const actionTypeId = String(group.actionTypeId);
                      const typeState = getActionTypeCheckState(countryFilters, group);
                      const typeOpen = isActionTypeExpanded(cTitle, actionTypeId);
                      const leafSet = countryFilters[actionTypeId] || new Set();

                      return (
                        <details
                          key={actionTypeId}
                          className="action-zone-filters__action-type-group"
                          open={typeOpen}
                        >
                          <summary
                            className="action-zone-filters__action-type-header"
                            onClick={(e) => {
                              if (e.target.closest('input[type="checkbox"]')) return;
                              e.preventDefault();
                              toggleActionTypeExpanded(cTitle, actionTypeId);
                            }}
                          >
                            <span
                              className={`action-zone-filters__chevron${typeOpen ? " action-zone-filters__chevron--expanded" : ""}`}
                              aria-hidden="true"
                            />
                            <input
                              type="checkbox"
                              checked={typeState.allOn}
                              ref={(el) => {
                                if (el) el.indeterminate = typeState.someOn;
                              }}
                              onChange={() =>
                                toggleAllForActionType?.(cTitle, group, !typeState.allOn)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="action-zone-filters__action-type-title">
                              {group.actionTypeTitle}
                            </span>
                            <span className="action-zone-filters__action-type-count">
                              ({typeState.total})
                            </span>
                          </summary>

                          <div className="action-zone-filters__leaf-list">
                            {group.hasManual && (
                              <label className="action-zone-filters__leaf-row">
                                <input
                                  type="checkbox"
                                  checked={leafSet.has(ZONE_LEAF_MANUAL)}
                                  onChange={() =>
                                    toggleZoneLeaf?.(cTitle, actionTypeId, ZONE_LEAF_MANUAL)
                                  }
                                />
                                <span>{MANUAL_ZONE_LABEL}</span>
                              </label>
                            )}
                            {group.ttxParameters.map((param) => {
                              const leaf = makeParamLeaf(param.parameterId);
                              return (
                                <label
                                  key={param.parameterId}
                                  className="action-zone-filters__leaf-row"
                                >
                                  <input
                                    type="checkbox"
                                    checked={leafSet.has(leaf)}
                                    onChange={() =>
                                      toggleZoneLeaf?.(cTitle, actionTypeId, leaf)
                                    }
                                  />
                                  <span>{param.title}</span>
                                </label>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
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
                title="Типы действия"
                items={allActionTypes}
                getItemKey={(item) => item.actionTypeId}
                getItemLabel={(item) => item.actionTypeTitle}
                selectedSet={quickSelectTypes}
                onToggleItem={toggleQuickSelectType}
                onSelectAll={setAllQuickSelectTypes}
              />
              <QuickSelectTable
                title="Страны"
                items={currentCountries}
                getItemKey={(item) => item}
                getItemLabel={(item) => item}
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
