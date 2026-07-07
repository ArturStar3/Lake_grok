import { formatSituationDateTime, getSituationDisplayRevision } from '../../utils/situationUtils';
import './OperationalSituation.css';

export default function SituationsTable({
  data,
  selectedSituations,
  onCheckboxChange,
  onRowClick,
  onFlyTo,
  onEdit,
  onDelete,
  onCreate,
  highlightedSituationId,
}) {
  const dataIds = data.map((item) => item.id);
  const selectedSet = new Set(selectedSituations);
  const isAllSelected = data.length > 0 && dataIds.every((id) => selectedSet.has(id));

  const handleSelectAllChange = (e) => {
    const isChecked = e.target.checked;
    dataIds.forEach((id) => onCheckboxChange(id, isChecked));
  };

  return (
    <div className="situations__data">
      <div className="situations__toolbar">
        <button type="button" className="situations__create-btn" onClick={onCreate}>
          + Добавить обстановку
        </button>
      </div>
      <table className="situations__table">
        <thead>
          <tr>
            <th className="situations__head-cell situations__head-cell--checkbox">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAllChange}
                aria-label="Выбрать все"
              />
            </th>
            <th className="situations__head-cell" />
            <th>Название</th>
            <th>Дата и время</th>
            <th>Страны</th>
            <th>Цвет</th>
            <th className="situations__head-cell" />
            <th className="situations__head-cell" />
          </tr>
        </thead>
        <tbody>
          {data.map((item) => {
            const rev = getSituationDisplayRevision(item);
            const countriesLabel = rev?.countries?.map((c) => c.title).join(', ') || '—';
            return (
              <tr
                key={item.id}
                className={`situations__row${highlightedSituationId === item.id ? ' situations__row--active' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                <td className="situations__cell" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedSituations.includes(item.id)}
                    onChange={(e) => onCheckboxChange(item.id, e.target.checked)}
                    aria-label={`Показать ${rev?.title || 'обстановку'} на карте`}
                  />
                </td>
                <td className="situations__cell situations__cell--action" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="situations__icon-btn"
                    onClick={() => onFlyTo?.(item)}
                    title="Перейти на карте"
                  >
                    📍
                  </button>
                </td>
                <td className="situations__cell">{rev?.title || '—'}</td>
                <td className="situations__cell">{formatSituationDateTime(rev)}</td>
                <td className="situations__cell situations__cell--countries">{countriesLabel}</td>
                <td className="situations__cell">
                  <span
                    className="situations__color-swatch"
                    style={{ backgroundColor: rev?.color || '#2f80ed' }}
                  />
                </td>
                <td className="situations__cell situations__cell--action" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="situations__icon-btn" onClick={() => onEdit?.(item)} title="Редактировать">
                    ✎
                  </button>
                </td>
                <td className="situations__cell situations__cell--action" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="situations__icon-btn situations__icon-btn--delete"
                    onClick={() => onDelete?.(item)}
                    title="Удалить"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
