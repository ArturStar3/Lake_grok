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

      {Object.keys(actionZoneAvailableByCountry).length === 0 && (
        <div className="action-zone-filters__empty">Нет зон у выбранных объектов</div>
      )}

      {Object.entries(actionZoneAvailableByCountry).map(([cTitle, typesSet]) => {
        const types = Array.from(typesSet).sort();
        const enabledSet = actionZoneFilters[cTitle] || new Set(types);
        const allOn = types.length > 0 && types.every((t) => enabledSet.has(t));
        const someOn = types.some((t) => enabledSet.has(t));

        return (
          <div key={cTitle} className="action-zone-filters__country">
            <label className="action-zone-filters__country-label">
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = !allOn && someOn;
                }}
                onChange={() => toggleAllForCountry?.(cTitle, types, !allOn)}
              />{' '}
              {cTitle} <span className="action-zone-filters__count">({types.length})</span>
            </label>
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
          </div>
        );
      })}

      <div className="action-zone-filters__buttons">
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
