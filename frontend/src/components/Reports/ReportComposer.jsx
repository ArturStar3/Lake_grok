import { useRef, useState } from 'react';
import FormatToggle from './FormatToggle';
import { MultiSelect } from './ReportSectionFilters';
import { createEmptySection } from './reportTemplateUtils';

export default function ReportComposer({
  form,
  onChange,
  sectionTypes = [],
  countries = [],
  globalCountryIds = [],
  onGlobalCountryIdsChange,
  canWrite = false,
  busy = false,
  error = '',
  exportFormat = 'pdf',
  onExportFormatChange,
  onPreview,
  onSave,
  onDownload,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const dragOverIndex = useRef(null);
  const formatLabel = String(exportFormat || 'pdf').toUpperCase();

  const patch = (partial) => onChange({ ...form, ...partial });
  const enabledTypes = new Set((form.sections || []).map((s) => s.section_type));

  const typeLabel = (value) => sectionTypes.find((t) => t.value === value)?.label || value;

  const setSectionEnabled = (sectionType, enabled) => {
    if (enabled) {
      if (enabledTypes.has(sectionType)) return;
      const label = typeLabel(sectionType);
      const section = createEmptySection(sectionType, label, form.sections.length);
      patch({ sections: [...form.sections, section] });
      return;
    }
    patch({
      sections: form.sections.filter((s) => s.section_type !== sectionType),
    });
  };

  const selectAll = () => {
    const next = sectionTypes.map((type, index) => {
      const existing = form.sections.find((s) => s.section_type === type.value);
      if (existing) return { ...existing, order: index };
      return createEmptySection(type.value, type.label, index);
    });
    patch({ sections: next });
  };

  const deselectAll = () => {
    patch({ sections: [] });
  };

  const moveSection = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= form.sections.length || fromIndex === toIndex) return;
    const next = [...form.sections];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    patch({ sections: next });
  };

  const handleDragStart = (index) => (event) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index) => (event) => {
    event.preventDefault();
    dragOverIndex.current = index;
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index) => (event) => {
    event.preventDefault();
    const from = dragIndex ?? Number(event.dataTransfer.getData('text/plain'));
    setDragIndex(null);
    dragOverIndex.current = null;
    if (Number.isNaN(from)) return;
    moveSection(from, index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    dragOverIndex.current = null;
  };

  const disabled = !canWrite || busy;
  const canGenerate = (form.sections || []).length > 0;

  // Ordered rows: enabled sections first (draggable), then unchecked types
  const uncheckedTypes = sectionTypes.filter((t) => !enabledTypes.has(t.value));

  return (
    <div className="report-composer">
      {error && <p className="report-status report-status--error">{error}</p>}

      <div className="report-composer__meta">
        <div className="report-filters__field">
          <label className="report-filters__label">Название шаблона</label>
          <input
            className="report-filters__input"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Например: Сводка по странам"
            disabled={disabled}
          />
        </div>
      </div>

      <section className="report-composer__block">
        <div className="report-composer__block-header">
          <h3>Состав отчёта</h3>
          <div className="report-composer__block-actions">
            <button
              type="button"
              className="report-btn report-btn--ghost"
              onClick={selectAll}
              disabled={disabled || sectionTypes.length === 0}
            >
              Выбрать все
            </button>
            <button
              type="button"
              className="report-btn report-btn--ghost"
              onClick={deselectAll}
              disabled={disabled || form.sections.length === 0}
            >
              Снять все
            </button>
          </div>
        </div>
        <p className="report-composer__hint">
          Отметьте разделы и перетащите их для изменения порядка (или используйте стрелки).
        </p>

        <ul className="report-composer__sections">
          {form.sections.map((section, index) => (
            <li
              key={section.clientKey}
              className={`report-composer__section${dragIndex === index ? ' report-composer__section--dragging' : ''}`}
              draggable={!disabled}
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <span className="report-composer__drag" title="Перетащить" aria-hidden>
                ⋮⋮
              </span>
              <label className="report-composer__check">
                <input
                  type="checkbox"
                  checked
                  disabled={disabled}
                  onChange={() => setSectionEnabled(section.section_type, false)}
                />
                <span>{section.title || typeLabel(section.section_type)}</span>
              </label>
              <div className="report-composer__reorder">
                <button
                  type="button"
                  className="report-icon-btn"
                  aria-label="Выше"
                  disabled={disabled || index === 0}
                  onClick={() => moveSection(index, index - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="report-icon-btn"
                  aria-label="Ниже"
                  disabled={disabled || index === form.sections.length - 1}
                  onClick={() => moveSection(index, index + 1)}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}

          {uncheckedTypes.map((type) => (
            <li key={type.value} className="report-composer__section report-composer__section--off">
              <span className="report-composer__drag report-composer__drag--muted" aria-hidden>
                ⋮⋮
              </span>
              <label className="report-composer__check">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={disabled}
                  onChange={() => setSectionEnabled(type.value, true)}
                />
                <span>{type.label}</span>
              </label>
            </li>
          ))}
        </ul>

        {sectionTypes.length === 0 && (
          <p className="report-status">Типы разделов не загружены.</p>
        )}
      </section>

      <section className="report-composer__block">
        <h3>Фильтры по странам</h3>
        <p className="report-composer__hint">
          Страны задаются для всего отчёта и применяются ко всем выбранным разделам.
        </p>
        <MultiSelect
          label="Страны"
          options={countries}
          values={globalCountryIds}
          onChange={(ids) => onGlobalCountryIdsChange?.(ids)}
        />
      </section>

      <section className="report-composer__block">
        <h3>Формат отчёта</h3>
        <FormatToggle
          value={exportFormat}
          onChange={onExportFormatChange}
          disabled={busy}
          name="report-composer-format"
        />
      </section>

      <div className="report-composer__footer">
        {canWrite && (
          <button
            type="button"
            className="report-btn report-btn--ghost"
            onClick={onSave}
            disabled={busy || !form.name.trim()}
          >
            Сохранить
          </button>
        )}
        <button
          type="button"
          className="report-btn report-btn--ghost"
          onClick={onPreview}
          disabled={busy || !canGenerate}
        >
          Предпросмотр PDF
        </button>
        <button
          type="button"
          className="report-btn report-btn--primary"
          onClick={onDownload}
          disabled={busy || !canGenerate}
        >
          {busy ? 'Формирование…' : `Скачать ${formatLabel}`}
        </button>
      </div>
    </div>
  );
}
