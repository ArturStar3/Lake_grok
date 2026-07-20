import { formatZoneListLine } from '../../utils/buildVisibleZones';
import './TargetZonesPreviewCard.css';

function formatTargetZoneLabel(zone) {
  let primary = '';
  if (zone.isEquipmentZone) {
    const eq = (zone.equipmentTitle || '').trim();
    const param = (zone.parameterTitle || 'Техника').trim();
    primary = eq ? `${param} · ${eq}` : param;
  } else {
    primary = (zone.actionTitle || 'Зона действия').trim();
  }

  if (zone.isPolygonZone) {
    return `${primary} (полигон)`;
  }
  if (zone.radiusMeters > 0) {
    const km = zone.radiusMeters / 1000;
    const radiusLabel = km >= 10 ? `${Math.round(km)} км` : `${km.toFixed(1)} км`;
    return `${primary} · ${radiusLabel}`;
  }
  return primary || formatZoneListLine(zone);
}

export default function TargetZonesPreviewCard({
  zones = [],
  enabledKeys,
  onToggleZone,
  onShowAll,
  onHideAll,
}) {
  if (!zones.length) {
    return <p className="target-zones-preview__empty">У объекта нет зон действия.</p>;
  }

  const enabled = enabledKeys || new Set();
  const enabledCount = zones.filter((z) => enabled.has(z.zoneKey)).length;

  return (
    <div className="target-zones-preview">
      <p className="target-zones-preview__hint">
        Отметьте зоны, чтобы показать их на карте. Выбор синхронизирован с меню
        «Зоны действия» (кнопки «Всё» / «Ничего» тоже управляют отображением).
      </p>
      <div className="target-zones-preview__actions">
        <button type="button" className="target-zones-preview__link" onClick={onShowAll}>
          Показать все
        </button>
        <button type="button" className="target-zones-preview__link" onClick={onHideAll}>
          Скрыть все
        </button>
        <span className="target-zones-preview__count">
          на карте: {enabledCount} из {zones.length}
        </span>
      </div>
      <ul className="target-zones-preview__list">
        {zones.map((zone) => {
          const checked = enabled.has(zone.zoneKey);
          return (
            <li key={zone.zoneKey} className="target-zones-preview__item">
              <label
                className={`target-zones-preview__label${checked ? ' target-zones-preview__label--on' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleZone?.(zone.zoneKey)}
                />
                <span
                  className="target-zones-preview__swatch"
                  style={{ background: zone.color || '#64748b' }}
                  aria-hidden
                />
                <span className="target-zones-preview__text">{formatTargetZoneLabel(zone)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
