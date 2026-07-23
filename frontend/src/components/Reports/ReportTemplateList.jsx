import FormatToggle from './FormatToggle';

export default function ReportTemplateList({
  templates,
  loading,
  error,
  canWrite,
  canDelete,
  onCreate,
  onEdit,
  onGenerate,
  onDelete,
  busyId,
  exportFormat = 'pdf',
  onExportFormatChange,
}) {
  const formatLabel = String(exportFormat || 'pdf').toUpperCase();

  return (
    <div className="report-list">
      <div className="report-list__toolbar">
        <p className="report-list__hint">
          Сохраняйте шаблоны с нужными разделами и фильтрами, затем формируйте PDF или DOCX.
        </p>
        <div className="report-list__toolbar-actions">
          <FormatToggle
            value={exportFormat}
            onChange={onExportFormatChange}
            name="report-list-format"
            compact
          />
          {canWrite && (
            <button type="button" className="report-btn report-btn--primary" onClick={onCreate}>
              Создать шаблон
            </button>
          )}
        </div>
      </div>

      {loading && <p className="report-status">Загрузка…</p>}
      {error && <p className="report-status report-status--error">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <p className="report-status">Шаблонов пока нет. Создайте первый шаблон отчёта.</p>
      )}

      {templates.length > 0 && (
        <table className="report-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Описание</th>
              <th>Разделов</th>
              <th>Обновлён</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl) => (
              <tr key={tpl.id}>
                <td>
                  <strong>{tpl.name}</strong>
                </td>
                <td className="report-table__muted">{tpl.description || '—'}</td>
                <td>{tpl.sections_count ?? tpl.sections?.length ?? 0}</td>
                <td className="report-table__muted">
                  {tpl.updated_at ? new Date(tpl.updated_at).toLocaleString('ru-RU') : '—'}
                </td>
                <td>
                  <div className="report-list__actions">
                    <button
                      type="button"
                      className="report-btn report-btn--ghost"
                      onClick={() => onGenerate(tpl)}
                      disabled={busyId === tpl.id}
                    >
                      {formatLabel}
                    </button>
                    <button
                      type="button"
                      className="report-btn report-btn--ghost"
                      onClick={() => onEdit(tpl)}
                    >
                      Открыть
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="report-btn report-btn--danger"
                        onClick={() => onDelete(tpl)}
                        disabled={busyId === tpl.id}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
