import React from 'react';
import { getLegendSampleStyle } from '../../utils/actionZoneStyle';
import './ControlPanel.css';

/**
 * Панель управления отображением карты и зон.
 */
export default function ControlPanel({
  actionTypes = [],
  isTerrainEnabled,
  onTerrainTypeToggle,
  onEnableAllTerrainTypes,
  onDisableAllTerrainTypes,
  losComputingCount = 0,
  losZonesCount = 0,
}) {
  const sortedTypes = [...actionTypes].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', 'ru'),
  );

  return (
    <div className="control-panel">
      <section className="control-panel__section" aria-labelledby="control-panel-terrain-heading">
        <h3 id="control-panel-terrain-heading" className="control-panel__heading">
          Учёт рельефа
        </h3>
        <p className="control-panel__hint">
          Выберите типы зон действия, для которых строить полигон по DEM вместо окружности.
          Расчёт выполняется автоматически при отображении зоны в фильтрах.
        </p>

        {sortedTypes.length > 0 && (
          <div className="control-panel__bulk-actions">
            <button
              type="button"
              className="control-panel__bulk-btn"
              onClick={() => onEnableAllTerrainTypes?.()}
            >
              Все
            </button>
            <button
              type="button"
              className="control-panel__bulk-btn"
              onClick={() => onDisableAllTerrainTypes?.()}
            >
              Ничего
            </button>
          </div>
        )}

        {sortedTypes.length === 0 ? (
          <p className="control-panel__empty">Типы зон действия не загружены</p>
        ) : (
          <ul className="control-panel__type-list">
            {sortedTypes.map((type) => {
              const enabled = isTerrainEnabled?.(type.id);
              return (
                <li key={type.id}>
                  <label className={`control-panel__type-row${enabled ? ' control-panel__type-row--active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(enabled)}
                      onChange={() => onTerrainTypeToggle?.(type.id)}
                    />
                    <span
                      className={`control-panel__type-sample control-panel__type-sample--${type.line_type || 'solid'}`}
                      style={getLegendSampleStyle(type.color, type.line_type)}
                      aria-hidden
                    />
                    <span className="control-panel__type-body">
                      <span className="control-panel__type-title">{type.title || 'Без названия'}</span>
                      {type.zone_mode === 'los_radar' && (
                        <span className="control-panel__type-desc">Режим LOS по умолчанию</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {losZonesCount > 0 && losComputingCount > 0 && (
          <p className="control-panel__status" role="status">
            Расчёт зон с учётом рельефа… ({losComputingCount} из {losZonesCount})
          </p>
        )}
      </section>
    </div>
  );
}
