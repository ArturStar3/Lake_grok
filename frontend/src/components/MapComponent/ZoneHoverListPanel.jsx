import React from 'react';
import './ZoneHoverListPanel.css';
import { formatZoneListLine } from '../../utils/buildVisibleZones';
import { getLegendSampleStyle } from '../../utils/actionZoneStyle';
import { isTerrainZoneEnabled } from '../../utils/computeLosZone';

const ZoneHoverListPanel = React.memo(function ZoneHoverListPanel({
  zones = [],
  isPinned = false,
  selectedEntryId = null,
  onSelectZone,
  onClose,
  considerTerrain,
}) {
  if (!zones.length) return null;

  const rootClass = `zone-hover-list${isPinned ? ' zone-hover-list--pinned' : ''}`;

  return (
    <div
      className={rootClass}
      role={isPinned ? 'dialog' : 'status'}
      aria-live={isPinned ? 'off' : 'polite'}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="zone-hover-list__header">
        <div className="zone-hover-list__title">Зоны действия</div>
        {isPinned && (
          <button
            type="button"
            className="zone-hover-list__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        )}
      </div>

      <ul className="zone-hover-list__items">
        {zones.map((zone) => {
          const key = zone.entryId || zone.zoneKey;
          const isSelected = isPinned && selectedEntryId === zone.entryId;
          const itemClass = `zone-hover-list__item${isSelected ? ' zone-hover-list__item--selected' : ''}`;
          const sample = (
            <span
              className={`zone-hover-list__sample zone-hover-list__sample--${zone.lineType || 'solid'}`}
              style={getLegendSampleStyle(zone.color, zone.lineType)}
              aria-hidden
            />
          );
          const terrainLabel = isTerrainZoneEnabled(zone, considerTerrain) ? ' · рельеф' : '';
          const text = (
            <span className="zone-hover-list__text">
              {formatZoneListLine(zone)}
              {terrainLabel}
            </span>
          );

          if (isPinned) {
            return (
              <li key={key}>
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => onSelectZone?.(zone.entryId)}
                >
                  {sample}
                  {text}
                </button>
              </li>
            );
          }

          return (
            <li key={key} className={itemClass}>
              {sample}
              {text}
            </li>
          );
        })}
      </ul>
    </div>
  );
});

export default ZoneHoverListPanel;
