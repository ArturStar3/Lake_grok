import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DemoStepInspector from './DemoStepInspector';
import DemoTimeline from './DemoTimeline';
import {
  DEMO_TOOL,
  DEMO_TOOLS,
  buildScenarioTimeline,
  createDefaultScenario,
  createDefaultStep,
  describeStepSelection,
  formatDurationMs,
  getToolIcon,
  getToolLabel,
  makeLocalStepKey,
  normalizeScenario,
} from '../../utils/demoScenario';
import './DemoStudioModal.css';

function reindex(steps) {
  return steps.map((step, index) => ({ ...step, order: index }));
}

function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return reindex(next);
}

/**
 * Конструктор сценариев демонстрации: слева список сценариев, в центре «слайды»
 * (шаги) с перетаскиванием, справа область анимации выбранного шага.
 */
export default function DemoStudioModal({
  isOpen,
  onClose,
  scenarios,
  loading,
  error,
  onRefresh,
  onSave,
  onDelete,
  onPlay,
  onPreviewStep,
  canWrite,
  canDelete,
  objects,
  events,
  situations,
  zoneCatalogByCountry,
  overlayLayers,
  countriesList,
  getMapView,
}) {
  const [draft, setDraft] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const dragIndexRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    onRefresh?.();
  }, [isOpen, onRefresh]);

  useEffect(() => {
    if (!isOpen || draft) return;
    setDraft(scenarios?.[0] ? normalizeScenario(scenarios[0]) : null);
    setActiveStepIndex(0);
    setDirty(false);
  }, [isOpen, scenarios, draft]);

  useEffect(() => {
    if (isOpen) return;
    setDraft(null);
    setDirty(false);
    setNotice('');
  }, [isOpen]);

  const confirmDiscard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm('Несохранённые изменения сценария будут потеряны. Продолжить?');
  }, [dirty]);

  const selectScenario = useCallback((scenario) => {
    if (!confirmDiscard()) return;
    setDraft(scenario ? normalizeScenario(scenario) : null);
    setActiveStepIndex(0);
    setDirty(false);
    setNotice('');
  }, [confirmDiscard]);

  const patchDraft = useCallback((partial) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  }, []);

  const patchSteps = useCallback((updater) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextSteps = reindex(typeof updater === 'function' ? updater(prev.steps) : updater);
      return { ...prev, steps: nextSteps };
    });
    setDirty(true);
  }, []);

  const handleCreateScenario = useCallback(() => {
    if (!confirmDiscard()) return;
    setDraft(createDefaultScenario());
    setActiveStepIndex(0);
    setDirty(true);
    setNotice('');
  }, [confirmDiscard]);

  const handleDuplicateScenario = useCallback(() => {
    if (!draft) return;
    if (!confirmDiscard()) return;
    setDraft(normalizeScenario({
      ...draft,
      id: null,
      title: `${draft.title} (копия)`,
      is_default: false,
      steps: draft.steps.map((step) => ({ ...step, id: null, key: makeLocalStepKey() })),
    }));
    setDirty(true);
  }, [confirmDiscard, draft]);

  const handleAddStep = useCallback((tool = DEMO_TOOL.CAMERA) => {
    patchSteps((steps) => {
      const insertAt = Math.min(steps.length, activeStepIndex + 1);
      const next = [...steps];
      next.splice(insertAt, 0, createDefaultStep(tool));
      return next;
    });
    setActiveStepIndex((index) => Math.min(index + 1, (draft?.steps.length ?? 0)));
  }, [activeStepIndex, draft, patchSteps]);

  const handleDuplicateStep = useCallback((index) => {
    patchSteps((steps) => {
      const source = steps[index];
      if (!source) return steps;
      const next = [...steps];
      next.splice(index + 1, 0, { ...source, id: null, key: makeLocalStepKey() });
      return next;
    });
    setActiveStepIndex(index + 1);
  }, [patchSteps]);

  const handleDeleteStep = useCallback((index) => {
    patchSteps((steps) => steps.filter((_, i) => i !== index));
    setActiveStepIndex((current) => Math.max(0, Math.min(current, (draft?.steps.length ?? 1) - 2)));
  }, [draft, patchSteps]);

  const handleMoveStep = useCallback((from, to) => {
    patchSteps((steps) => moveItem(steps, from, to));
    setActiveStepIndex(to);
  }, [patchSteps]);

  const handleStepChange = useCallback((nextStep) => {
    patchSteps((steps) => steps.map((step, index) => (index === activeStepIndex ? nextStep : step)));
  }, [activeStepIndex, patchSteps]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setNotice('Укажите название сценария.');
      return;
    }
    if (!draft.steps.length) {
      setNotice('Добавьте хотя бы один шаг.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const saved = await onSave(draft);
      setDraft(saved);
      setDirty(false);
      setNotice('Сценарий сохранён.');
    } catch (err) {
      console.error('Не удалось сохранить сценарий демонстрации', err);
      setNotice(err?.response?.data?.detail || 'Не удалось сохранить сценарий.');
    } finally {
      setBusy(false);
    }
  }, [draft, onSave]);

  const handleDelete = useCallback(async () => {
    if (!draft?.id) return;
    if (!window.confirm(`Удалить сценарий «${draft.title}»?`)) return;
    setBusy(true);
    try {
      await onDelete(draft.id);
      setDraft(null);
      setDirty(false);
      setNotice('Сценарий удалён.');
    } catch (err) {
      console.error('Не удалось удалить сценарий демонстрации', err);
      setNotice('Не удалось удалить сценарий.');
    } finally {
      setBusy(false);
    }
  }, [draft, onDelete]);

  const handlePlay = useCallback(() => {
    if (!draft?.steps.length) return;
    onPlay?.(draft);
  }, [draft, onPlay]);

  const totalMs = useMemo(
    () => buildScenarioTimeline(draft?.steps || []).totalMs,
    [draft],
  );

  const activeStep = draft?.steps?.[activeStepIndex] || null;

  if (!isOpen) return null;

  return (
    <div className="demo-studio__overlay" onClick={onClose}>
      <div
        className="demo-studio"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-studio-title"
      >
        <header className="demo-studio__header">
          <div>
            <h2 id="demo-studio-title">Настройка демонстрации</h2>
            <p className="demo-studio__subtitle">
              Сценарий из шагов: что показать на карте, как долго и с какой анимацией
            </p>
          </div>
          <div className="demo-studio__header-actions">
            <button
              type="button"
              className="demo-btn demo-btn--primary"
              onClick={handlePlay}
              disabled={!draft?.steps.length}
            >
              Воспроизвести
            </button>
            {canWrite && (
              <button
                type="button"
                className="demo-btn demo-btn--primary"
                onClick={handleSave}
                disabled={busy || !draft}
              >
                {busy ? 'Сохранение…' : 'Сохранить'}
              </button>
            )}
            <button type="button" className="demo-studio__close" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
        </header>

        {(error || notice) && (
          <div className={`demo-studio__banner${error ? ' demo-studio__banner--error' : ''}`}>
            {error || notice}
          </div>
        )}

        <div className="demo-studio__body">
          <aside className="demo-studio__scenarios">
            <div className="demo-studio__pane-head">
              <span>Сценарии</span>
              {canWrite && (
                <button type="button" className="demo-btn demo-btn--ghost" onClick={handleCreateScenario}>
                  + Новый
                </button>
              )}
            </div>
            {loading && <p className="demo-studio__hint">Загрузка…</p>}
            <ul className="demo-studio__scenario-list">
              {scenarios.map((scenario) => (
                <li key={scenario.id}>
                  <button
                    type="button"
                    className={`demo-studio__scenario${String(scenario.id) === String(draft?.id) ? ' demo-studio__scenario--active' : ''}`}
                    onClick={() => selectScenario(scenario)}
                  >
                    <span className="demo-studio__scenario-title">{scenario.title}</span>
                    <span className="demo-studio__scenario-meta">
                      {scenario.steps.length} шаг(ов)
                      {scenario.is_default ? ' · по умолчанию' : ''}
                    </span>
                  </button>
                </li>
              ))}
              {!loading && !scenarios.length && (
                <li className="demo-studio__hint">Сценариев пока нет.</li>
              )}
            </ul>

            {draft && (
              <div className="demo-studio__scenario-form">
                <label className="demo-field">
                  <span className="demo-field__label">Название</span>
                  <input
                    type="text"
                    value={draft.title}
                    disabled={!canWrite}
                    onChange={(e) => patchDraft({ title: e.target.value })}
                  />
                </label>
                <label className="demo-field">
                  <span className="demo-field__label">Описание</span>
                  <textarea
                    rows={2}
                    value={draft.description}
                    disabled={!canWrite}
                    onChange={(e) => patchDraft({ description: e.target.value })}
                  />
                </label>
                <label className="demo-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.loop}
                    disabled={!canWrite}
                    onChange={(e) => patchDraft({ loop: e.target.checked })}
                  />
                  <span>Зацикливать показ</span>
                </label>
                <label className="demo-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.is_default}
                    disabled={!canWrite}
                    onChange={(e) => patchDraft({ is_default: e.target.checked })}
                  />
                  <span>Запускать по умолчанию</span>
                </label>
                {canDelete && draft.id && (
                  <button
                    type="button"
                    className="demo-btn demo-btn--danger"
                    onClick={handleDelete}
                    disabled={busy}
                  >
                    Удалить сценарий
                  </button>
                )}
                {canWrite && (
                  <button type="button" className="demo-btn demo-btn--ghost" onClick={handleDuplicateScenario}>
                    Создать копию
                  </button>
                )}
              </div>
            )}
          </aside>

          <section className="demo-studio__steps">
            <div className="demo-studio__pane-head">
              <span>Шаги показа</span>
              <span className="demo-studio__hint">{formatDurationMs(totalMs)}</span>
            </div>

            {!draft ? (
              <p className="demo-studio__hint">
                Выберите сценарий слева или создайте новый.
              </p>
            ) : (
              <>
                <ol className="demo-studio__step-list">
                  {draft.steps.map((step, index) => (
                    <li
                      key={step.key}
                      draggable={canWrite}
                      onDragStart={() => { dragIndexRef.current = index; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = dragIndexRef.current;
                        dragIndexRef.current = null;
                        if (from == null) return;
                        handleMoveStep(from, index);
                      }}
                      className={`demo-studio__step${index === activeStepIndex ? ' demo-studio__step--active' : ''}`}
                    >
                      <button
                        type="button"
                        className="demo-studio__step-main"
                        onClick={() => setActiveStepIndex(index)}
                      >
                        <span className="demo-studio__step-num">{index + 1}</span>
                        <span className="demo-studio__step-icon" aria-hidden="true">
                          {getToolIcon(step.tool)}
                        </span>
                        <span className="demo-studio__step-text">
                          <span className="demo-studio__step-title">
                            {step.title || getToolLabel(step.tool)}
                          </span>
                          <span className="demo-studio__step-sub">
                            {describeStepSelection(step)}
                          </span>
                        </span>
                        <span className="demo-studio__step-badge">
                          {formatDurationMs(step.duration_ms)}
                        </span>
                      </button>
                      {canWrite && (
                        <div className="demo-studio__step-actions">
                          <button type="button" title="Выше" onClick={() => handleMoveStep(index, index - 1)} disabled={index === 0}>↑</button>
                          <button type="button" title="Ниже" onClick={() => handleMoveStep(index, index + 1)} disabled={index === draft.steps.length - 1}>↓</button>
                          <button type="button" title="Дублировать" onClick={() => handleDuplicateStep(index)}>⧉</button>
                          <button type="button" title="Удалить" onClick={() => handleDeleteStep(index)}>✕</button>
                        </div>
                      )}
                    </li>
                  ))}
                  {!draft.steps.length && (
                    <li className="demo-studio__hint">Шагов пока нет — добавьте первый.</li>
                  )}
                </ol>

                {canWrite && (
                  <div className="demo-studio__add-step">
                    <span className="demo-studio__hint">Добавить шаг:</span>
                    <div className="demo-studio__add-step-buttons">
                      {DEMO_TOOLS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="demo-btn demo-btn--ghost"
                          onClick={() => handleAddStep(item.id)}
                        >
                          {item.icon} {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="demo-studio__inspector">
            <DemoStepInspector
              step={activeStep}
              stepNumber={activeStepIndex + 1}
              onChange={handleStepChange}
              onPreview={() => onPreviewStep?.(activeStep)}
              onPickCameraFromMap={getMapView}
              objects={objects}
              events={events}
              situations={situations}
              zoneCatalogByCountry={zoneCatalogByCountry}
              overlayLayers={overlayLayers}
              countriesList={countriesList}
              readOnly={!canWrite}
            />
          </section>
        </div>

        <footer className="demo-studio__footer">
          <DemoTimeline
            steps={draft?.steps || []}
            activeIndex={activeStepIndex}
            onSelectStep={setActiveStepIndex}
          />
        </footer>
      </div>
    </div>
  );
}
