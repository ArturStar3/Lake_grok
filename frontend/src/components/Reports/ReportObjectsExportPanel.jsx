import { useCallback, useMemo } from 'react';
import FormatToggle from './FormatToggle';
import ReportObjectsPicker from './ReportObjectsPicker';

function normalizeIds(ids = []) {
  return [...new Set(
    (ids || [])
      .map((id) => String(id))
      .filter((id) => id && id !== 'null' && id !== 'undefined' && id !== '0'),
  )];
}

function idsKey(ids = []) {
  return normalizeIds(ids).join('\0');
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
  const formTargetKey = idsKey(form?.targetIds);
  const targetIds = useMemo(
    () => normalizeIds(form?.targetIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- content key avoids new array identity
    [formTargetKey],
  );
  const mapTargetKey = idsKey(mapTargetIds);
  const normalizedMapIds = useMemo(
    () => normalizeIds(mapTargetIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- content key avoids new array identity
    [mapTargetKey],
  );
  const selectedCount = targetIds.length;
  const mapCount = normalizedMapIds.length;
  const disabled = busy;

  const patchForm = useCallback((partial) => {
    onChange?.({ ...(form || {}), ...partial });
  }, [form, onChange]);

  const applyFromMap = useCallback(() => {
    patchForm({ targetIds: normalizedMapIds });
  }, [patchForm, normalizedMapIds]);

  const handleTargetsChange = useCallback((nextIds) => {
    const next = normalizeIds(nextIds);
    if (idsKey(next) === formTargetKey) return;
    patchForm({ targetIds: next });
  }, [patchForm, formTargetKey]);

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
            onChange={(e) => patchForm({ name: e.target.value })}
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
