import React, { useState } from 'react';
import './FormularCompletionCard.css';

export default function FormularCompletionCard({ sections = [], targets = [] }) {
  const [viewMode, setViewMode] = useState('list');

  if (!targets.length) {
    return <p className="formular-completion__empty">Нет объектов для отображения заполненности.</p>;
  }

  return (
    <div className="formular-completion">
      <div className="formular-completion__tabs" role="tablist" aria-label="Режим отображения">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'list'}
          className={`formular-completion__tab${viewMode === 'list' ? ' formular-completion__tab--active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          Список
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'table'}
          className={`formular-completion__tab${viewMode === 'table' ? ' formular-completion__tab--active' : ''}`}
          onClick={() => setViewMode('table')}
        >
          Таблица
        </button>
      </div>

      {viewMode === 'list' ? (
        <ul className="formular-completion__list">
          {targets.map((target) => (
            <li key={target.id} className="formular-completion__row">
              <div className="formular-completion__row-header">
                <div>
                  <div className="formular-completion__title">{target.title}</div>
                  {target.label && (
                    <div className="formular-completion__label">{target.label}</div>
                  )}
                </div>
                <span className="formular-completion__percent">{target.percent}%</span>
              </div>
              <div className="formular-completion__bar" aria-hidden>
                <div
                  className="formular-completion__bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, target.percent))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="formular-completion__table-wrap">
          <table className="formular-completion__table">
            <thead>
              <tr>
                <th>Объект</th>
                {sections.map((section) => (
                  <th key={section.id} title={section.title}>
                    {section.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => (
                <tr key={target.id}>
                  <td>
                    <div className="formular-completion__title">{target.title}</div>
                    {target.label && (
                      <div className="formular-completion__label">{target.label}</div>
                    )}
                  </td>
                  {sections.map((section) => {
                    const filled = Boolean(target.sections?.[String(section.id)] ?? target.sections?.[section.id]);
                    return (
                      <td
                        key={`${target.id}-${section.id}`}
                        className={filled ? 'formular-completion__cell--filled' : 'formular-completion__cell--empty'}
                        aria-label={filled ? 'Заполнено' : 'Не заполнено'}
                      >
                        {filled ? '✓' : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
