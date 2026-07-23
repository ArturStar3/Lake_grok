import { useState } from 'react';
import FormatToggle from './FormatToggle';
import ReportSectionFilters from './ReportSectionFilters';

const KINDS = [
  {
    value: 'country_full',
    label: 'По странам',
    hint: 'Досье страны и подробные формуляры всех объектов выбранных стран (зоны, техника, уязвимости).',
  },
  {
    value: 'objects_full',
    label: 'По объектам',
    hint: 'Подробные формуляры выбранных объектов: разделы формуляра, зоны, вооружение, уязвимости.',
  },
];

export default function ReportPresetPanel({
  countries = [],
  targets = [],
  busy = false,
  error = '',
  exportFormat = 'pdf',
  onExportFormatChange,
  onGenerate,
}) {
  const [kind, setKind] = useState('country_full');
  const [filters, setFilters] = useState({ country_ids: [], target_ids: [] });

  const activeKind = KINDS.find((item) => item.value === kind) || KINDS[0];
  const formatLabel = String(exportFormat || 'pdf').toUpperCase();

  const canGenerate = kind === 'country_full'
    ? (filters.country_ids || []).length > 0
    : (filters.target_ids || []).length > 0 || (filters.country_ids || []).length > 0;

  const handleGenerate = () => {
    onGenerate?.({
      kind,
      country_ids: filters.country_ids || [],
      target_ids: filters.target_ids || [],
      name: activeKind.label === 'По странам' ? 'Полный отчёт по стране' : 'Полный отчёт по объектам',
      format: exportFormat || 'pdf',
    });
  };

  return (
    <div className="report-preset">
      <p className="report-list__hint">
        Выберите тип отчёта и интересующие страны или объекты, затем сформируйте файл.
      </p>

      <div className="report-preset__kinds" role="radiogroup" aria-label="Тип отчёта">
        {KINDS.map((item) => (
          <label
            key={item.value}
            className={`report-preset__kind${kind === item.value ? ' report-preset__kind--active' : ''}`}
          >
            <input
              type="radio"
              name="report-preset-kind"
              value={item.value}
              checked={kind === item.value}
              onChange={() => {
                setKind(item.value);
                setFilters({ country_ids: [], target_ids: [] });
              }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <p className="report-filters__hint">{activeKind.hint}</p>

      <ReportSectionFilters
        sectionType={kind}
        filters={filters}
        onChange={setFilters}
        countries={countries}
        targets={targets}
      />

      {error && <p className="report-status report-status--error">{error}</p>}

      <div className="report-preset__actions">
        <FormatToggle
          value={exportFormat}
          onChange={onExportFormatChange}
          disabled={busy}
          name="report-preset-format"
        />
        <button
          type="button"
          className="report-btn report-btn--primary"
          onClick={handleGenerate}
          disabled={busy || !canGenerate}
        >
          {busy ? 'Формирование…' : `Сформировать ${formatLabel}`}
        </button>
      </div>
    </div>
  );
}
