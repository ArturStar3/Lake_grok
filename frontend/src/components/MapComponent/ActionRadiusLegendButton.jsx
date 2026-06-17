import React from "react";
import "./ActionRadiusLegendButton.css";

const LEGEND_ITEMS = [
  { type: "radar", label: "Радар", desc: "Зона обнаружения — круг + радиальные линии (как экран РЛС)" },
  { type: "solid", label: "Сплошная", desc: "Базовый тип (сплошной контур)" },
  { type: "dashed", label: "Пунктир", desc: "Патрулирование, периметр" },
  { type: "dotdash", label: "Точка-тире", desc: "Комбинированные зоны" },
  { type: "dashcross", label: "Тире-крест / вариации", desc: "Особые периметры и типы" },
  { type: "other", label: "Другие типы", desc: "Разная штриховка по action_type (цвет + стиль)" },
];

export default function ActionRadiusLegendButton() {
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
        <div className="action-radius-legend__title">Визуальные стили зон (по action_type)</div>
        <ul className="action-radius-legend__list">
          {LEGEND_ITEMS.map((item) => (
            <li key={item.type} className="action-radius-legend__item">
              <span className={`action-radius-legend__sample action-radius-legend__sample--${item.type}`} />
              <span className="action-radius-legend__text">
                <strong>{item.label}</strong>
                <span className="action-radius-legend__desc">{item.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

