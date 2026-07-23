import { useState } from 'react';
import FormatToggle from './FormatToggle';
import ReportSectionFilters from './ReportSectionFilters';
import { createEmptySection } from './reportTemplateUtils';

export default function ReportTemplateEditor({
  form,
  onChange,
  sectionTypes,
  reference,
  canWrite,
  busy,
  error,
  onBack,
  onPreview,
  onSave,
  onSaveAndGenerate,
  exportFormat = 'pdf',
  onExportFormatChange,
}) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const formatLabel = String(exportFormat || 'pdf').toUpperCase();

  const patch = (partial) => onChange({ ...form, ...partial });

  const updateSection = (clientKey, partial) => {
    patch({
      sections: form.sections.map((section) => (
        section.clientKey === clientKey ? { ...section, ...partial } : section
      )),
    });
  };

  const moveSection = (index, direction) => {
    const next = [...form.sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ sections: next });
  };

  const removeSection = (clientKey) => {
    patch({ sections: form.sections.filter((s) => s.clientKey !== clientKey) });
    if (expandedKey === clientKey) setExpandedKey(null);
  };

  const addSection = (sectionType) => {
    const label = sectionTypes.find((t) => t.value === sectionType)?.label || sectionType;
    const section = createEmptySection(sectionType, label, form.sections.length);
    patch({ sections: [...form.sections, section] });
    setExpandedKey(section.clientKey);
    setAddOpen(false);
  };

  const typeLabel = (value) => sectionTypes.find((t) => t.value === value)?.label || value;

  return (
    <div className="report-editor">
      <div className="report-editor__toolbar">
        <button type="button" className="report-btn report-btn--ghost" onClick={onBack}>
          ← К списку
        </button>
        <div className="report-editor__actions">
          <button
            type="button"
            className="report-btn report-btn--ghost"
            onClick={onPreview}
            disabled={busy || form.sections.length === 0}
          >
            Предпросмотр PDF
          </button>
          {canWrite && (
            <>
              <button
                type="button"
                className="report-btn report-btn--ghost"
                onClick={onSave}
                disabled={busy || !form.name.trim()}
              >
                Сохранить
              </button>
              <FormatToggle
                value={exportFormat}
                onChange={onExportFormatChange}
                disabled={busy}
                name="report-editor-format"
                compact
              />
              <button
                type="button"
                className="report-btn report-btn--primary"
                onClick={onSaveAndGenerate}
                disabled={busy || !form.name.trim() || form.sections.length === 0}
              >
                {`Сохранить и ${formatLabel}`}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="report-status report-status--error">{error}</p>}

      <div className="report-editor__meta">
        <div className="report-filters__field">
          <label className="report-filters__label">Название шаблона</label>
          <input
            className="report-filters__input"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Например: Сводка по объектам и событиям"
            disabled={!canWrite}
          />
        </div>
        <div className="report-filters__field">
          <label className="report-filters__label">Описание</label>
          <textarea
            className="report-filters__textarea"
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            disabled={!canWrite}
          />
        </div>
      </div>

      <div className="report-editor__sections-header">
        <h3>Разделы</h3>
        {canWrite && (
          <div className="report-editor__add-wrap">
            <button
              type="button"
              className="report-btn report-btn--primary"
              onClick={() => setAddOpen((v) => !v)}
            >
              Добавить раздел
            </button>
            {addOpen && (
              <div className="report-editor__add-menu">
                {sectionTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className="report-editor__add-item"
                    onClick={() => addSection(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {form.sections.length === 0 && (
        <p className="report-status">Добавьте хотя бы один раздел для формирования отчёта.</p>
      )}

      <div className="report-editor__sections">
        {form.sections.map((section, index) => {
          const isExpanded = expandedKey === section.clientKey;
          return (
            <article key={section.clientKey} className="report-section-card">
              <header className="report-section-card__header">
                <span className="report-section-card__badge">{typeLabel(section.section_type)}</span>
                <input
                  className="report-section-card__title"
                  value={section.title}
                  onChange={(e) => updateSection(section.clientKey, { title: e.target.value })}
                  disabled={!canWrite}
                />
                <div className="report-section-card__controls">
                  <button
                    type="button"
                    className="report-icon-btn"
                    title="Выше"
                    disabled={!canWrite || index === 0}
                    onClick={() => moveSection(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="report-icon-btn"
                    title="Ниже"
                    disabled={!canWrite || index === form.sections.length - 1}
                    onClick={() => moveSection(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="report-btn report-btn--ghost"
                    onClick={() => setExpandedKey(isExpanded ? null : section.clientKey)}
                  >
                    {isExpanded ? 'Скрыть выборку' : 'Выборка'}
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      className="report-btn report-btn--danger"
                      onClick={() => removeSection(section.clientKey)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </header>

              <label className="report-section-card__break">
                <input
                  type="checkbox"
                  checked={Boolean(section.page_break_before)}
                  onChange={(e) => updateSection(section.clientKey, {
                    page_break_before: e.target.checked,
                  })}
                  disabled={!canWrite}
                />
                Разрыв страницы перед разделом
              </label>

              {isExpanded && (
                <div className="report-section-card__filters">
                  <ReportSectionFilters
                    sectionType={section.section_type}
                    filters={section.filters}
                    onChange={(filters) => updateSection(section.clientKey, { filters })}
                    countries={reference.countries}
                    eventTypes={reference.eventTypes}
                    actionTypes={reference.actionTypes}
                    targetTypes={reference.targetTypes}
                    equipmentCategories={reference.equipmentCategories}
                    targets={reference.targets}
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
