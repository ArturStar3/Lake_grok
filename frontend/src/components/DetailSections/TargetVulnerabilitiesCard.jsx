import { useState } from 'react';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import VulnerabilityDetailModal from '../MapComponent/VulnerabilityDetailModal';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './TargetVulnerabilitiesCard.css';

export default function TargetVulnerabilitiesCard({
  items = [],
  showOnMap,
  onShowOnMapChange,
}) {
  const [selectedPoint, setSelectedPoint] = useState(null);

  return (
    <div className="target-vulnerabilities-card">
      <label className="target-vulnerabilities-card__toggle">
        <input
          type="checkbox"
          checked={Boolean(showOnMap)}
          onChange={(e) => onShowOnMapChange?.(e.target.checked)}
        />
        Показать уязвимости на карте
      </label>
      {showOnMap ? (
        <p className="target-vulnerabilities-card__hint">
          Точки остаются на карте после закрытия окна. Снимите галочку, чтобы скрыть.
          Клик по точке на карте открывает подробности с фото.
        </p>
      ) : null}
      {!items.length ? (
        <p className="target-vulnerabilities-card__empty">Уязвимые места не заданы.</p>
      ) : (
        <ul className="target-vulnerabilities-card__list">
          {items.map((item) => {
            const image = resolveMediaUrl(item.image);
            return (
              <li key={item.id} className="target-vulnerabilities-card__item">
                <button
                  type="button"
                  className="target-vulnerabilities-card__item-btn"
                  onClick={() => setSelectedPoint(item)}
                >
                  <div className="target-vulnerabilities-card__item-main">
                    <div className="target-vulnerabilities-card__title">{item.title}</div>
                    {item.description ? (
                      <MarkdownContent className="target-vulnerabilities-card__desc">
                        {item.description}
                      </MarkdownContent>
                    ) : null}
                  </div>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="target-vulnerabilities-card__photo"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selectedPoint ? (
        <VulnerabilityDetailModal
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      ) : null}
    </div>
  );
}
