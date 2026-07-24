import FormatToggle from './FormatToggle';
import ReportObjectsPicker from './ReportObjectsPicker';

function normalizeIds(ids = []) {
  return [...new Set(
    (ids || [])
      .map((id) => String(id))
      .filter((id) => id && id !== 'null' && id !== 'undefined' && id !== '0'),
  )];
}

export default function ReportObjectsExportPanel({
  form,
  onChange,
  targets = [],
  targetTypes = [],
  mapTargetIds = [],
  canWrite = false,
  busy = false,
  error = '',
  exportFormat = 'pdf',
  onExportFormatChange,
  onSave,
  onGenerate,
}) {
  const formatLabel = String(exportFormat || 'pdf').toUpperCase();
  const targetIds = normalizeIds(form?.targetIds);
  const selectedCount = targetIds.length;
  const mapCount = normalizeIds(mapTargetIds).length;
  const disabled = busy;

  const patch = (partial) => onChange?.({ ...form, ...partial });

  const applyFromMap = () => {
    patch({ targetIds: normalizeIds(mapTargetIds) });
  };

  const handleTargetsChange = (nextIds) => {
    patch({ targetIds: normalizeIds(nextIds) });
  };

  const canGenerate = selectedCount > 0 && Boolean(form?.name?.trim());

  return (
    <div className="report-composer report-objects-composer">
      {error && <p className="report-status report-status--error">{error}</p>}

      <div className="report-composer__meta">
        <label className="report-filters__field">
          <span className="report-filters__label">Название шаблона</span>
          <input
            type="text"
            className="report-filters__input"
            value={form?.name || ''}
            disabled={!canWrite || disabled}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Отчёт по объектам"
          />
        </label>
      </div>

      <div className="report-composer__block report-objects-composer__picker-block">
        <div className="report-composer__block-header">
          <h3>Объекты</h3>
          <div className="report-composer__block-actions">
            <span className="report-objects-export__count">
              Выбрано: {selectedCount}
              {mapCount > 0 ? ` · на карте: ${mapCount}` : ''}
            </span>
            <button
              type="button"
              className="report-btn report-btn--ghost"
              onClick={applyFromMap}
              disabled={disabled || mapCount === 0}
              title={mapCount === 0 ? 'На карте нет отмеченных объектов' : undefined}
            >
              Взять с карты
            </button>
          </div>
        </div>
        <p className="report-composer__hint">
          Отметьте страну целиком или отдельные объекты — как в таблице объектов.
          В отчёт попадут формуляры, зоны, техника и уязвимости.
        </p>
        <ReportObjectsPicker
          targets={targets}
          targetTypes={targetTypes}
          selectedIds={targetIds}
          onChange={handleTargetsChange}
        />
      </div>

      <div className="report-composer__footer">
        <FormatToggle
          value={exportFormat}
          onChange={onExportFormatChange}
          disabled={disabled}
          name="report-objects-format"
        />
        <div className="report-composer__footer-actions">
          {canWrite && (
            <button
              type="button"
              className="report-btn report-btn--ghost"
              onClick={onSave}
              disabled={disabled || !form?.name?.trim()}
            >
              Сохранить
            </button>
          )}
          <button
            type="button"
            className="report-btn report-btn--primary"
            onClick={onGenerate}
            disabled={disabled || !canGenerate}
          >
            {busy ? 'Формирование…' : `Сформировать ${formatLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
