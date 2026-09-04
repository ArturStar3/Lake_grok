import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DemoStepInspector from './DemoStepInspector';
import {
  DEMO_START_MODE,
  DEMO_STAGE_TOOLS,
  DEMO_TOOL,
  buildStageBeats,
  createDefaultStage,
  createDefaultStep,
  describeStepSelection,
  findStage,
  formatDurationMs,
  getToolIcon,
  getToolLabel,
  makeLocalStageId,
  makeLocalStepKey,
  normalizeStage,
  normalizeText,
} from '../../utils/demoScenario';
import './DemoMosaicStudioModal.css';

const START_MODE_BADGE = {
  [DEMO_START_MODE.AFTER_PREVIOUS]: 'после предыдущего',
  [DEMO_START_MODE.WITH_PREVIOUS]: 'параллельно',
  [DEMO_START_MODE.ON_CLICK]: 'новый такт',
};

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
 * Конструктор этапов: библиотека шаблонов вида карты и шаги выбранного этапа.
 */
export default function DemoStageStudioModal({
  stages = [],
  onChange,
  onClose,
  onPreviewStep,
  onPreviewStage,
  onStartTextMapEdit,
  onTextMapApplyRef,
  alignTextOnMap,
  getMapView,
  objects,
  events,
  situations,
  zoneCatalogByCountry,
  overlayLayers,
  countriesList,
  readOnly = false,
}) {
  const [stageId, setStageId] = useState(stages[0]?.id || stages[0]?.key || null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const dragIndexRef = useRef(null);

  const stage = findStage(stages, stageId) || stages[0] || null;

  useEffect(() => {
    if (stage) return;
    if (stages[0]) setStageId(stages[0].id || stages[0].key);
  }, [stage, stages]);

  const patchStages = (next) => {
    onChange(next.map((item, index) => ({ ...item, order: index })));
  };

  const patchStage = (partial) => {
    if (!stage) return;
    const key = stage.id || stage.key;
    patchStages(stages.map((item) => (
      (item.id || item.key) === key ? normalizeStage({ ...item, ...partial }) : item
    )));
  };

  const patchSteps = (updater) => {
    if (!stage) return;
    const nextSteps = reindex(typeof updater === 'function' ? updater(stage.steps) : updater);
    patchStage({ steps: nextSteps });
  };

  const handleAddStage = () => {
    const next = createDefaultStage({
      id: makeLocalStageId(),
      title: `Этап ${stages.length + 1}`,
    });
    patchStages([...stages, next]);
    setStageId(next.id || next.key);
    setActiveStepIndex(0);
  };

  const handleDuplicateStage = () => {
    if (!stage) return;
    const next = normalizeStage({
      ...stage,
      id: makeLocalStageId(),
      title: `${stage.title || 'Этап'} (копия)`,
      steps: stage.steps.map((step) => ({ ...step, id: null, key: makeLocalStepKey() })),
    });
    const index = stages.findIndex((item) => (item.id || item.key) === (stage.id || stage.key));
    const list = [...stages];
    list.splice(index + 1, 0, next);
    patchStages(list);
    setStageId(next.id || next.key);
  };

  const handleDeleteStage = () => {
    if (!stage) return;
    const key = stage.id || stage.key;
    const next = stages.filter((item) => (item.id || item.key) !== key);
    patchStages(next);
    const fallback = next[0];
    setStageId(fallback ? (fallback.id || fallback.key) : null);
    setActiveStepIndex(0);
  };

  const handleAddStep = (tool = DEMO_TOOL.CAMERA) => {
    patchSteps((steps) => {
      const insertAt = Math.min(steps.length, activeStepIndex + 1);
      const next = [...steps];
      next.splice(insertAt, 0, createDefaultStep(tool));
      return next;
    });
    setActiveStepIndex((index) => Math.min(index + 1, (stage?.steps.length ?? 0)));
  };

  const handleDuplicateStep = (index) => {
    patchSteps((steps) => {
      const source = steps[index];
      if (!source) return steps;
      const next = [...steps];
      next.splice(index + 1, 0, { ...source, id: null, key: makeLocalStepKey() });
      return next;
    });
    setActiveStepIndex(index + 1);
  };

  const handleDeleteStep = (index) => {
    patchSteps((steps) => steps.filter((_, i) => i !== index));
    setActiveStepIndex((current) => Math.max(0, Math.min(current, (stage?.steps.length ?? 1) - 2)));
  };

  const handleMoveStep = (from, to) => {
    patchSteps((steps) => moveItem(steps, from, to));
    setActiveStepIndex(to);
  };

  const handleStepChange = (nextStep) => {
    patchSteps((steps) => steps.map((step, index) => (index === activeStepIndex ? nextStep : step)));
  };

  const handleStartTextMapEdit = useCallback(() => {
    const step = stage?.steps?.[activeStepIndex];
    if (!step) return;
    onStartTextMapEdit?.({ stepKey: step.key, text: step.text });
  }, [activeStepIndex, onStartTextMapEdit, stage]);

  useEffect(() => {
    if (!onTextMapApplyRef) return undefined;
    onTextMapApplyRef.current = (stepKey, text) => {
      const normalized = normalizeText(text);
      onChange(stages.map((item) => ({
        ...item,
        steps: (item.steps || []).map((step) => (
          step.key === stepKey ? { ...step, text: normalized } : step
        )),
      })));
    };
    return () => {
      onTextMapApplyRef.current = null;
    };
  }, [onChange, onTextMapApplyRef, stages]);

  const playback = useMemo(() => buildStageBeats(stage?.steps || []), [stage]);
  const activeStep = stage?.steps?.[activeStepIndex] || null;

  return (
    <div className="demo-mosaic-studio-modal" role="dialog" aria-modal="true">
      <div className="demo-mosaic-studio-modal__backdrop" onClick={onClose} />
      <div className="demo-mosaic-studio-modal__panel demo-stage-studio">
        <header className="demo-mosaic-studio-modal__header">
          <div>
            <h2>Конструктор этапов</h2>
            <p>Шаблоны вида карты: камера, объекты, зоны, текст. Этап можно поставить в программу или на экран мультиэкрана.</p>
          </div>
          <button type="button" className="demo-btn demo-btn--ghost" onClick={onClose}>Закрыть</button>
        </header>

        <div className="demo-mosaic-studio-modal__body">
          <aside className="demo-mosaic-studio-modal__presets">
            <div className="demo-mosaic-studio-modal__presets-head">
              <h3>Этапы</h3>
              {!readOnly && (
                <button type="button" className="demo-btn demo-btn--ghost" onClick={handleAddStage}>+</button>
              )}
            </div>
            <ul>
              {stages.map((item) => {
                const key = item.id || item.key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={key === (stage?.id || stage?.key) ? 'is-active' : ''}
                      onClick={() => {
                        setStageId(key);
                        setActiveStepIndex(0);
                      }}
                    >
                      {item.title || 'Без названия'}
                    </button>
                  </li>
                );
              })}
              {!stages.length && (
                <li className="demo-mosaic-studio-modal__empty">Этапов пока нет</li>
              )}
            </ul>
            {stage && !readOnly && (
              <div className="demo-mosaic-studio-modal__presets-actions">
                <button type="button" className="demo-btn demo-btn--ghost" onClick={handleDuplicateStage}>
                  Копировать этап
                </button>
                <button type="button" className="demo-btn demo-btn--danger" onClick={handleDeleteStage}>
                  Удалить этап
                </button>
              </div>
            )}
          </aside>

          <section className="demo-studio__steps demo-stage-studio__steps">
            {!stage ? (
              <p className="demo-mosaic-studio-modal__empty">Создайте этап, чтобы настроить шаги.</p>
            ) : (
              <>
                <label className="demo-field">
                  <span className="demo-field__label">Название этапа</span>
                  <input
                    type="text"
                    value={stage.title}
                    disabled={readOnly}
                    onChange={(e) => patchStage({ title: e.target.value })}
                  />
                </label>
                <div className="demo-studio__pane-head">
                  <span>Шаги этапа</span>
                  <span className="demo-studio__hint">{formatDurationMs(playback.durationMs)}</span>
                </div>
                <ol className="demo-studio__step-list">
                  {(stage.steps || []).map((step, index) => (
                    <Fragment key={step.key}>
                      <li
                        draggable={!readOnly}
                        onDragStart={() => { dragIndexRef.current = index; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = dragIndexRef.current;
                          dragIndexRef.current = null;
                          if (from == null) return;
                          handleMoveStep(from, index);
                        }}
                        className={[
                          'demo-studio__step',
                          index === activeStepIndex ? 'demo-studio__step--active' : '',
                        ].filter(Boolean).join(' ')}
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
                              {START_MODE_BADGE[step.start_mode]
                                ? ` · ${START_MODE_BADGE[step.start_mode]}`
                                : ''}
                            </span>
                          </span>
                          <span className="demo-studio__step-badge">
                            {formatDurationMs(step.duration_ms)}
                          </span>
                        </button>
                        {!readOnly && (
                          <div className="demo-studio__step-actions">
                            <button type="button" title="Выше" onClick={() => handleMoveStep(index, index - 1)} disabled={index === 0}>↑</button>
                            <button type="button" title="Ниже" onClick={() => handleMoveStep(index, index + 1)} disabled={index === stage.steps.length - 1}>↓</button>
                            <button type="button" title="Дублировать" onClick={() => handleDuplicateStep(index)}>⧉</button>
                            <button type="button" title="Удалить" onClick={() => handleDeleteStep(index)}>✕</button>
                          </div>
                        )}
                      </li>
                    </Fragment>
                  ))}
                  {!stage.steps?.length && (
                    <li className="demo-studio__hint">Шагов пока нет — добавьте первый.</li>
                  )}
                </ol>
                {!readOnly && (
                  <div className="demo-studio__add-step">
                    <span className="demo-studio__hint">Добавить шаг:</span>
                    <div className="demo-studio__add-step-buttons">
                      {DEMO_STAGE_TOOLS.map((item) => (
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
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost demo-stage-studio__preview"
                  onClick={() => onPreviewStage?.(stage)}
                  disabled={!stage.steps?.length}
                >
                  Просмотр этапа
                </button>
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
              onStartTextMapEdit={handleStartTextMapEdit}
              alignTextOnMap={alignTextOnMap}
              objects={objects}
              events={events}
              situations={situations}
              zoneCatalogByCountry={zoneCatalogByCountry}
              overlayLayers={overlayLayers}
              countriesList={countriesList}
              readOnly={readOnly}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
