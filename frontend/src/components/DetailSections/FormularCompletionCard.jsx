import React, { useState } from 'react';
import './FormularCompletionCard.css';

export default function FormularCompletionCard({ sections = [], targets = [], onTargetEdit }) {
  const [viewMode, setViewMode] = useState('list');
  const canEditTarget = typeof onTargetEdit === 'function';

  const handleTargetClick = (target) => {
    if (!target?.id || !canEditTarget) return;
    onTargetEdit(target.id);
  };

  const renderTargetLabel = (target) => (
    <>
      <div className="formular-completion__title">{target.title}</div>
      {target.label && (
        <div className="formular-completion__label">{target.label}</div>
      )}
    </>
  );

  if (!targets.length) {
    return <p className="formular-completion__empty">Нет объектов для отображения заполненности.</p>;
  }

  return (
    <div className={`formular-completion${viewMode === 'table' ? ' formular-completion--table' : ''}`}>
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
            <li
              key={target.id}
              className={`formular-completion__row${canEditTarget ? ' formular-completion__row--clickable' : ''}`}
            >
              {canEditTarget ? (
                <button
                  type="button"
                  className="formular-completion__row-button"
                  onClick={() => handleTargetClick(target)}
                >
                  <div className="formular-completion__row-header">
                    <div>{renderTargetLabel(target)}</div>
                    <span className="formular-completion__percent">{target.percent}%</span>
                  </div>
                  <div className="formular-completion__bar" aria-hidden>
                    <div
                      className="formular-completion__bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, target.percent))}%` }}
                    />
                  </div>
                </button>
              ) : (
                <>
                  <div className="formular-completion__row-header">
                    <div>{renderTargetLabel(target)}</div>
                    <span className="formular-completion__percent">{target.percent}%</span>
                  </div>
                  <div className="formular-completion__bar" aria-hidden>
                    <div
                      className="formular-completion__bar-fill"
                      style={{ width: `${Math.min(100, Math.max(0, target.percent))}%` }}
                    />
                  </div>
                </>
              )}
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
                  <td className={canEditTarget ? 'formular-completion__object-cell--clickable' : undefined}>
                    {canEditTarget ? (
                      <button
                        type="button"
                        className="formular-completion__object-button"
                        onClick={() => handleTargetClick(target)}
                      >
                        {renderTargetLabel(target)}
                      </button>
                    ) : (
                      renderTargetLabel(target)
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
