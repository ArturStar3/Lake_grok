import React from "react";
import "./ActionRadiusLegendButton.css";
import { getLegendSampleStyle, LINE_TYPE_LABELS } from "../../utils/actionZoneStyle";

export default function ActionRadiusLegendButton({ actionTypes = [] }) {
  const items = (actionTypes || []).map((type) => ({
    id: type.id,
    title: type.title,
    color: type.color || "#3388ff",
    lineType: type.line_type || "solid",
    lineLabel: LINE_TYPE_LABELS[type.line_type] || LINE_TYPE_LABELS.solid,
  }));

  return (
    <div className="action-radius-legend">
      <button
        type="button"
        className="action-radius-legend__toggle"
        aria-label="Показать легенду зон действия"
      >
        <span className="action-radius-legend__icon">i</span>
      </button>
      <div className="action-radius-legend__panel">
        <div className="action-radius-legend__title">Типы зон действия</div>
        {items.length === 0 ? (
          <div className="action-radius-legend__empty">Нет типов действий</div>
        ) : (
          <ul className="action-radius-legend__list">
            {items.map((item) => (
              <li key={item.id} className="action-radius-legend__item">
                <span
                  className={`action-radius-legend__sample action-radius-legend__sample--${item.lineType}`}
                  style={getLegendSampleStyle(item.color, item.lineType)}
                />
                <span className="action-radius-legend__text">
                  <strong>{item.title}</strong>
                  <span className="action-radius-legend__desc">
                    {item.lineLabel} · {item.color}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
