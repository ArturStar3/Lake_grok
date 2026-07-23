import { ENTITY_LABELS } from './entityLabels';

export default function ImportConflictsList({
  conflicts = [],
  decisions,
  onDecisionChange,
  onSetAllDecisions,
  busy,
}) {
  if (!conflicts.length) {
    return (
      <p className="data-exchange-panel__hint">
        Конфликтов нет — можно применять импорт: будут добавлены только новые записи.
      </p>
    );
  }

  return (
    <div className="data-exchange-conflicts">
      <p className="data-exchange-panel__hint">
        По умолчанию локальные данные сохраняются. «Импорт» — полная замена записи.
        «Объединить» — заполнить пустые локальные поля из бандла, склеить различающиеся
        тексты и добавить отсутствующие элементы списков (зоны, техника и т.п.).
      </p>
      <div className="data-exchange-bulk-actions">
        <button
          type="button"
          className="data-exchange-btn"
          disabled={busy}
          onClick={() => onSetAllDecisions?.('keep_local')}
        >
          Для всех — Локальное
        </button>
        <button
          type="button"
          className="data-exchange-btn"
          disabled={busy}
          onClick={() => onSetAllDecisions?.('use_imported')}
        >
          Для всех — Импорт
        </button>
        <button
          type="button"
          className="data-exchange-btn data-exchange-btn--primary"
          disabled={busy}
          onClick={() => onSetAllDecisions?.('merge')}
        >
          Для всех — Объединить
        </button>
      </div>
      <table className="data-exchange-table">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Запись</th>
            <th>Статус</th>
            <th>Решение</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((item) => {
            const decision = decisions[item.id] || 'keep_local';
            return (
              <tr key={item.id}>
                <td>{ENTITY_LABELS[item.entity_type] || item.entity_type}</td>
                <td>
                  <strong>{item.label || item.natural_key}</strong>
                </td>
                <td>
                  {item.status === 'ambiguous' ? 'Неоднозначно' : 'Конфликт'}
                </td>
                <td>
                  <div className="data-exchange-decision" role="radiogroup">
                    <label>
                      <input
                        type="radio"
                        name={`dec-${item.id}`}
                        checked={decision === 'keep_local'}
                        disabled={busy}
                        onChange={() => onDecisionChange(item.id, 'keep_local')}
                      />
                      Локальное
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`dec-${item.id}`}
                        checked={decision === 'use_imported'}
                        disabled={busy}
                        onChange={() => onDecisionChange(item.id, 'use_imported')}
                      />
                      Импорт
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`dec-${item.id}`}
                        checked={decision === 'merge'}
                        disabled={busy}
                        onChange={() => onDecisionChange(item.id, 'merge')}
                      />
                      Объединить
                    </label>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
