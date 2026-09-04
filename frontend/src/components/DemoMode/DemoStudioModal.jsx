import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DemoMosaicStudioModal from './DemoMosaicStudioModal';
import DemoStageStudioModal from './DemoStageStudioModal';
import DemoTimeline from './DemoTimeline';
import {
  DEMO_EASINGS,
  DEMO_MOSAIC_ACTION,
  DEMO_MOSAIC_EXPAND_ANIMATIONS,
  DEMO_MOSAIC_SLOT_LABELS,
  DEMO_PROGRAM_ENTER_EFFECTS,
  DEMO_PROGRAM_EXIT_EFFECTS,
  DEMO_SEQUENCE_MOSAIC_ACTIONS,
  DEMO_SEQUENCE_TYPE,
  buildProgramPlayback,
  createDefaultScenario,
  createDefaultSequenceItem,
  findMosaicPreset,
  findStage,
  formatDurationMs,
  getMosaicLayoutDef,
  makeLocalSequenceKey,
  makeLocalStageId,
  makeLocalStepKey,
  normalizeMosaicPreset,
  normalizeScenario,
  normalizeScenarioMosaic,
} from '../../utils/demoScenario';
import './DemoStudioModal.css';

function moveItem(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Генеральный конструктор демонстрации: программа показа из этапов и мультиэкранов.
 */
export default function DemoStudioModal({
  isOpen,
  mapTextEditActive = false,
  onClose,
  scenarios,
  loading,
  error,
  onRefresh,
  onSave,
  onDelete,
  onPlay,
  onPreviewStep,
  onPreviewStage,
  onPreviewMosaic,
  onPreviewProgramItem,
  canWrite,
  canDelete,
  objects,
  events,
  situations,
  zoneCatalogByCountry,
  overlayLayers,
  countriesList,
  getMapView,
  onStartTextMapEdit,
  onTextMapApplyRef,
  alignTextOnMap,
}) {
  const [draft, setDraft] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mosaicStudioOpen, setMosaicStudioOpen] = useState(false);
  const [stageStudioOpen, setStageStudioOpen] = useState(false);
  const dragIndexRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    onRefresh?.();
  }, [isOpen, onRefresh]);

  useEffect(() => {
    if (!isOpen || draft) return;
    setDraft(scenarios?.[0] ? normalizeScenario(scenarios[0]) : null);
    setActiveIndex(0);
    setDirty(false);
  }, [isOpen, scenarios, draft]);

  useEffect(() => {
    if (isOpen) return;
    setDraft(null);
    setDirty(false);
    setNotice('');
    setMosaicStudioOpen(false);
    setStageStudioOpen(false);
  }, [isOpen]);

  const confirmDiscard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm('Несохранённые изменения сценария будут потеряны. Продолжить?');
  }, [dirty]);

  const selectScenario = useCallback((scenario) => {
    if (!confirmDiscard()) return;
    setDraft(scenario ? normalizeScenario(scenario) : null);
    setActiveIndex(0);
    setDirty(false);
    setNotice('');
  }, [confirmDiscard]);

  const patchDraft = useCallback((partial) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setDirty(true);
  }, []);

  const patchSequence = useCallback((updater) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(prev.sequence || []) : updater;
      return { ...prev, sequence: next };
    });
    setDirty(true);
  }, []);

  const handleCreateScenario = useCallback(() => {
    if (!confirmDiscard()) return;
    setDraft(createDefaultScenario());
    setActiveIndex(0);
    setDirty(true);
    setNotice('');
  }, [confirmDiscard]);

  const handleDuplicateScenario = useCallback(() => {
    if (!draft) return;
    if (!confirmDiscard()) return;
    const stages = (draft.stages || []).map((stage) => {
      const id = makeLocalStageId();
      return {
        ...stage,
        id,
        key: id,
        steps: (stage.steps || []).map((step) => ({ ...step, id: null, key: makeLocalStepKey() })),
      };
    });
    const idMap = {};
    (draft.stages || []).forEach((stage, index) => {
      idMap[String(stage.id || stage.key)] = stages[index].id;
    });
    const mosaic = normalizeScenarioMosaic({
      ...(draft.mosaic || {}),
      presets: (draft.mosaic?.presets || []).map((preset) => ({
        ...preset,
        screens: (preset.screens || []).map((screen) => ({
          ...screen,
          stage_id: screen.stage_id ? (idMap[String(screen.stage_id)] || null) : null,
        })),
      })),
    });
    setDraft(normalizeScenario({
      ...draft,
      id: null,
      title: `${draft.title} (копия)`,
      is_default: false,
      stages,
      mosaic,
      sequence: (draft.sequence || []).map((item) => ({
        ...item,
        key: makeLocalSequenceKey(),
        stage_id: item.stage_id ? (idMap[String(item.stage_id)] || null) : null,
      })),
    }));
    setDirty(true);
  }, [confirmDiscard, draft]);

  const handleAddBlock = useCallback((type) => {
    if (type === DEMO_SEQUENCE_TYPE.STAGE) {
      if (!draft?.stages?.length) {
        setStageStudioOpen(true);
        setNotice('Сначала создайте этап в конструкторе этапов.');
        return;
      }
      const stage = draft.stages[0];
      patchSequence((items) => {
        const next = [...items];
        next.splice(Math.min(items.length, activeIndex + 1), 0, createDefaultSequenceItem({
          type: DEMO_SEQUENCE_TYPE.STAGE,
          stage_id: stage.id || stage.key,
          wait_for_presenter: !draft.auto_advance,
        }));
        return next;
      });
    } else {
      if (!draft?.mosaic?.presets?.length) {
        setMosaicStudioOpen(true);
        setNotice('Сначала создайте пресет в конструкторе мультиэкрана.');
        return;
      }
      const preset = findMosaicPreset(draft.mosaic, draft.mosaic.active_preset_id);
      patchSequence((items) => {
        const next = [...items];
        next.splice(Math.min(items.length, activeIndex + 1), 0, createDefaultSequenceItem({
          type: DEMO_SEQUENCE_TYPE.MOSAIC,
          preset_id: preset?.id || draft.mosaic.presets[0]?.id,
          mosaic_action: DEMO_MOSAIC_ACTION.SHOW_GRID,
          wait_for_presenter: !draft.auto_advance,
        }));
        return next;
      });
    }
    setActiveIndex((index) => index + 1);
  }, [activeIndex, draft, patchSequence]);

  const handleDuplicateBlock = useCallback((index) => {
    patchSequence((items) => {
      const source = items[index];
      if (!source) return items;
      const next = [...items];
      next.splice(index + 1, 0, { ...source, key: makeLocalSequenceKey() });
      return next;
    });
    setActiveIndex(index + 1);
  }, [patchSequence]);

  const handleDeleteBlock = useCallback((index) => {
    patchSequence((items) => items.filter((_, i) => i !== index));
    setActiveIndex((current) => Math.max(0, Math.min(current, (draft?.sequence.length ?? 1) - 2)));
  }, [draft, patchSequence]);

  const handleMoveBlock = useCallback((from, to) => {
    patchSequence((items) => moveItem(items, from, to));
    setActiveIndex(to);
  }, [patchSequence]);

  const handleBlockChange = useCallback((partial) => {
    patchSequence((items) => items.map((item, index) => (
      index === activeIndex ? { ...item, ...partial } : item
    )));
  }, [activeIndex, patchSequence]);

  const handleActivePresetChange = useCallback((partial) => {
    const current = draft?.sequence?.[activeIndex];
    if (!draft?.mosaic || !current?.preset_id) return;
    patchDraft({
      mosaic: normalizeScenarioMosaic({
        ...draft.mosaic,
        presets: (draft.mosaic.presets || []).map((preset) => (
          preset.id === current.preset_id
            ? normalizeMosaicPreset({ ...preset, ...partial })
            : preset
        )),
      }),
    });
  }, [activeIndex, draft, patchDraft]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setNotice('Укажите название сценария.');
      return;
    }
    if (!draft.sequence.length) {
      setNotice('Добавьте хотя бы один блок в программу показа.');
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
    if (!draft?.sequence.length) return;
    onPlay?.(draft);
  }, [draft, onPlay]);

  const program = useMemo(() => buildProgramPlayback(draft || {}), [draft]);
  const activeItem = draft?.sequence?.[activeIndex] || null;
  const activeStage = findStage(draft?.stages, activeItem?.stage_id);
  const activePreset = findMosaicPreset(draft?.mosaic, activeItem?.preset_id);

  if (!isOpen) return null;

  return (
    <div
      className={['demo-studio__overlay', mapTextEditActive ? 'demo-studio__overlay--map-edit' : '']
        .filter(Boolean)
        .join(' ')}
      onClick={onClose}
      aria-hidden={mapTextEditActive ? true : undefined}
    >
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
              Программа показа: этапы и мультиэкран, их вход и выход
            </p>
          </div>
          <div className="demo-studio__header-actions">
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              disabled={!draft}
              onClick={() => setStageStudioOpen(true)}
            >
              Этапы…
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              disabled={!draft}
              onClick={() => setMosaicStudioOpen(true)}
            >
              Мультиэкран…
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--primary"
              onClick={handlePlay}
              disabled={!draft?.sequence.length}
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
                      {(scenario.sequence || []).length} блок(ов)
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
                    checked={draft.auto_advance}
                    disabled={!canWrite}
                    onChange={(e) => patchDraft({ auto_advance: e.target.checked })}
                  />
                  <span className="demo-checkbox__text">
                    Переключать блоки автоматически
                    <span className="demo-field__hint">
                      Значение по умолчанию для новых блоков. У каждого блока можно выбрать переход по времени или по клику.
                    </span>
                  </span>
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
              <span>Программа показа</span>
              <span className="demo-studio__hint">{formatDurationMs(program.totalMs)}</span>
            </div>
            {!draft ? (
              <p className="demo-studio__hint">Выберите сценарий слева или создайте новый.</p>
            ) : (
              <>
                <ol className="demo-studio__step-list">
                  {(draft.sequence || []).map((item, index) => {
                    const playback = program.items[index];
                    const title = playback?.title
                      || (item.type === DEMO_SEQUENCE_TYPE.MOSAIC ? 'Мультиэкран' : 'Этап');
                    return (
                      <li
                        key={item.key}
                        draggable={canWrite}
                        onDragStart={() => { dragIndexRef.current = index; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = dragIndexRef.current;
                          dragIndexRef.current = null;
                          if (from == null) return;
                          handleMoveBlock(from, index);
                        }}
                        className={[
                          'demo-studio__step',
                          index === activeIndex ? 'demo-studio__step--active' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <button
                          type="button"
                          className="demo-studio__step-main"
                          onClick={() => setActiveIndex(index)}
                        >
                          <span className="demo-studio__step-num">{index + 1}</span>
                          <span className="demo-studio__step-icon" aria-hidden="true">
                            {item.type === DEMO_SEQUENCE_TYPE.MOSAIC ? '▦' : '▶'}
                          </span>
                          <span className="demo-studio__step-text">
                            <span className="demo-studio__step-title">{title}</span>
                            <span className="demo-studio__step-sub">
                              {item.type === DEMO_SEQUENCE_TYPE.MOSAIC ? 'мультиэкран' : 'этап'}
                              {item.wait_for_presenter ? ' · по клику' : ' · по времени'}
                              {item.mosaic_action && item.mosaic_action !== DEMO_MOSAIC_ACTION.SHOW_GRID
                                ? ` · ${item.mosaic_action === DEMO_MOSAIC_ACTION.EXPAND ? 'разворот' : 'свёртка'}`
                                : ''}
                              {item.enter?.effect && item.enter.effect !== 'none'
                                ? ` · вход: ${item.enter.effect}`
                                : ''}
                            </span>
                          </span>
                          <span className="demo-studio__step-badge">
                            {formatDurationMs(playback?.durationMs || item.duration_ms)}
                          </span>
                        </button>
                        {canWrite && (
                          <div className="demo-studio__step-actions">
                            <button type="button" title="Выше" onClick={() => handleMoveBlock(index, index - 1)} disabled={index === 0}>↑</button>
                            <button type="button" title="Ниже" onClick={() => handleMoveBlock(index, index + 1)} disabled={index === draft.sequence.length - 1}>↓</button>
                            <button type="button" title="Дублировать" onClick={() => handleDuplicateBlock(index)}>⧉</button>
                            <button type="button" title="Удалить" onClick={() => handleDeleteBlock(index)}>✕</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {!draft.sequence.length && (
                    <li className="demo-studio__hint">Программа пуста — добавьте этап или мультиэкран.</li>
                  )}
                </ol>
                {canWrite && (
                  <div className="demo-studio__add-step">
                    <span className="demo-studio__hint">Добавить в программу:</span>
                    <div className="demo-studio__add-step-buttons">
                      <button type="button" className="demo-btn demo-btn--ghost" onClick={() => handleAddBlock(DEMO_SEQUENCE_TYPE.STAGE)}>
                        + Этап
                      </button>
                      <button type="button" className="demo-btn demo-btn--ghost" onClick={() => handleAddBlock(DEMO_SEQUENCE_TYPE.MOSAIC)}>
                        + Мультиэкран
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="demo-studio__inspector">
            {!activeItem ? (
              <div className="demo-inspector demo-inspector--empty">
                <p>Выберите блок программы или добавьте новый.</p>
              </div>
            ) : (
              <div className="demo-inspector">
                <header className="demo-inspector__header">
                  <h3>Блок {activeIndex + 1}</h3>
                </header>
                <fieldset className="demo-inspector__group" disabled={!canWrite}>
                  <legend>Содержание</legend>
                  {activeItem.type === DEMO_SEQUENCE_TYPE.STAGE ? (
                    <label className="demo-field">
                      <span className="demo-field__label">Этап</span>
                      <select
                        value={activeItem.stage_id || ''}
                        onChange={(e) => handleBlockChange({ stage_id: e.target.value || null })}
                      >
                        <option value="">Выберите этап</option>
                        {(draft.stages || []).map((stage) => (
                          <option key={stage.id || stage.key} value={stage.id || stage.key}>
                            {stage.title || 'Без названия'}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <label className="demo-field">
                        <span className="demo-field__label">Пресет мультиэкрана</span>
                        <select
                          value={activeItem.preset_id || ''}
                          onChange={(e) => handleBlockChange({ preset_id: e.target.value || null })}
                        >
                          <option value="">Выберите пресет</option>
                          {(draft.mosaic?.presets || []).map((preset) => (
                            <option key={preset.id} value={preset.id}>{preset.title}</option>
                          ))}
                        </select>
                      </label>
                      {activePreset && (
                        <>
                          <p className="demo-field__hint">
                            {activePreset.layout} · экранов: {activePreset.screens?.length || 0}
                          </p>
                          <span className="demo-field__label">Разрешить полноэкран</span>
                          <div className="demo-chip-row">
                            {getMosaicLayoutDef(activePreset.layout).slots.map((slotId) => {
                              const checked = (activePreset.expandable_slots || []).includes(slotId);
                              return (
                                <label key={slotId} className="demo-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const current = activePreset.expandable_slots || [];
                                      const next = e.target.checked
                                        ? [...current, slotId]
                                        : current.filter((id) => id !== slotId);
                                      handleActivePresetChange({ expandable_slots: next });
                                    }}
                                  />
                                  <span>{DEMO_MOSAIC_SLOT_LABELS[slotId] || slotId.toUpperCase()}</span>
                                </label>
                              );
                            })}
                          </div>
                          <label className="demo-field">
                            <span className="demo-field__label">Действие блока</span>
                            <select
                              value={activeItem.mosaic_action || DEMO_MOSAIC_ACTION.SHOW_GRID}
                              onChange={(e) => handleBlockChange({ mosaic_action: e.target.value })}
                            >
                              {DEMO_SEQUENCE_MOSAIC_ACTIONS.map((action) => (
                                <option key={action.id} value={action.id}>{action.label}</option>
                              ))}
                            </select>
                          </label>
                          {activeItem.mosaic_action === DEMO_MOSAIC_ACTION.EXPAND && (
                            <label className="demo-field">
                              <span className="demo-field__label">Экран</span>
                              <select
                                value={activeItem.slot || ''}
                                onChange={(e) => handleBlockChange({ slot: e.target.value || null })}
                              >
                                <option value="">Выберите экран</option>
                                {(activePreset.expandable_slots || []).map((slotId) => (
                                  <option key={slotId} value={slotId}>
                                    {DEMO_MOSAIC_SLOT_LABELS[slotId] || slotId.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {(activeItem.mosaic_action === DEMO_MOSAIC_ACTION.EXPAND
                            || activeItem.mosaic_action === DEMO_MOSAIC_ACTION.COLLAPSE) && (
                            <>
                              <p className="demo-field__hint">
                                Анимация слота: значения «как в пресете» берут настройки из конструктора
                                мультиэкрана.
                              </p>
                              <label className="demo-field">
                                <span className="demo-field__label">Тип анимации</span>
                                <select
                                  value={activeItem.expand_animation || ''}
                                  onChange={(e) => handleBlockChange({
                                    expand_animation: e.target.value || null,
                                  })}
                                >
                                  <option value="">
                                    Как в пресете
                                    {activePreset.expand_animation
                                      ? ` (${DEMO_MOSAIC_EXPAND_ANIMATIONS.find(
                                        (a) => a.id === activePreset.expand_animation,
                                      )?.label || activePreset.expand_animation})`
                                      : ''}
                                  </option>
                                  {DEMO_MOSAIC_EXPAND_ANIMATIONS.map((item) => (
                                    <option key={item.id} value={item.id}>{item.label}</option>
                                  ))}
                                </select>
                              </label>
                              {activeItem.mosaic_action === DEMO_MOSAIC_ACTION.EXPAND ? (
                                <>
                                  <label className="demo-field">
                                    <span className="demo-field__label">Длительность разворота, мс</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={5000}
                                      step={50}
                                      value={activeItem.expand_ms ?? 0}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        handleBlockChange({
                                          expand_ms: value > 0 ? value : null,
                                        });
                                      }}
                                    />
                                    <span className="demo-field__hint">
                                      0 — как в пресете ({activePreset.expand_ms || activePreset.transition_ms || 700} мс)
                                    </span>
                                  </label>
                                  <label className="demo-field">
                                    <span className="demo-field__label">Плавность разворота</span>
                                    <select
                                      value={activeItem.expand_easing || ''}
                                      onChange={(e) => handleBlockChange({
                                        expand_easing: e.target.value || null,
                                      })}
                                    >
                                      <option value="">
                                        Как в пресете
                                        {activePreset.expand_easing
                                          ? ` (${DEMO_EASINGS.find((a) => a.id === activePreset.expand_easing)?.label
                                            || activePreset.expand_easing})`
                                          : ''}
                                      </option>
                                      {DEMO_EASINGS.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              ) : (
                                <>
                                  <label className="demo-field">
                                    <span className="demo-field__label">Длительность свёртки, мс</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={5000}
                                      step={50}
                                      value={activeItem.collapse_ms ?? 0}
                                      onChange={(e) => {
                                        const value = Number(e.target.value);
                                        handleBlockChange({
                                          collapse_ms: value > 0 ? value : null,
                                        });
                                      }}
                                    />
                                    <span className="demo-field__hint">
                                      0 — как в пресете ({activePreset.collapse_ms || activePreset.transition_ms || 700} мс)
                                    </span>
                                  </label>
                                  <label className="demo-field">
                                    <span className="demo-field__label">Плавность свёртки</span>
                                    <select
                                      value={activeItem.collapse_easing || ''}
                                      onChange={(e) => handleBlockChange({
                                        collapse_easing: e.target.value || null,
                                      })}
                                    >
                                      <option value="">
                                        Как в пресете
                                        {activePreset.collapse_easing
                                          ? ` (${DEMO_EASINGS.find((a) => a.id === activePreset.collapse_easing)?.label
                                            || activePreset.collapse_easing})`
                                          : ''}
                                      </option>
                                      {DEMO_EASINGS.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {activeItem.type === DEMO_SEQUENCE_TYPE.STAGE && activeStage && (
                    <p className="demo-field__hint">
                      Шагов в этапе: {activeStage.steps?.length || 0}
                    </p>
                  )}
                </fieldset>
                <fieldset className="demo-inspector__group" disabled={!canWrite}>
                  <legend>Переход к следующему</legend>
                  <div className="demo-radio-group">
                    <label className="demo-checkbox">
                      <input
                        type="radio"
                        name={`advance-${activeItem.key}`}
                        checked={!activeItem.wait_for_presenter}
                        onChange={() => handleBlockChange({ wait_for_presenter: false })}
                      />
                      <span>По времени — после длительности блока</span>
                    </label>
                    <label className="demo-checkbox">
                      <input
                        type="radio"
                        name={`advance-${activeItem.key}`}
                        checked={Boolean(activeItem.wait_for_presenter)}
                        onChange={() => handleBlockChange({ wait_for_presenter: true })}
                      />
                      <span>По клику — ждать докладчика</span>
                    </label>
                  </div>
                  <label className="demo-field">
                    <span className="demo-field__label">Длительность, мс</span>
                    <input
                      type="number"
                      min={0}
                      max={600000}
                      step={500}
                      value={activeItem.duration_ms}
                      onChange={(e) => handleBlockChange({ duration_ms: Number(e.target.value) })}
                    />
                    <span className="demo-field__hint">
                      {activeItem.wait_for_presenter
                        ? '0 — сразу ждать клик. Иначе сначала выдержать время.'
                        : '0 — взять длительность этапа, пресета или анимации разворота'}
                    </span>
                  </label>
                </fieldset>
                <fieldset className="demo-inspector__group" disabled={!canWrite}>
                  <legend>Вход</legend>
                  <label className="demo-field">
                    <span className="demo-field__label">Эффект</span>
                    <select
                      value={activeItem.enter?.effect || 'none'}
                      onChange={(e) => handleBlockChange({
                        enter: { ...activeItem.enter, effect: e.target.value },
                      })}
                    >
                      {DEMO_PROGRAM_ENTER_EFFECTS.map((effect) => (
                        <option key={effect.id} value={effect.id}>{effect.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Длительность, мс</span>
                    <input
                      type="number"
                      min={0}
                      max={20000}
                      step={50}
                      value={activeItem.enter?.duration_ms ?? 400}
                      onChange={(e) => handleBlockChange({
                        enter: { ...activeItem.enter, duration_ms: Number(e.target.value) },
                      })}
                    />
                  </label>
                </fieldset>
                <fieldset className="demo-inspector__group" disabled={!canWrite}>
                  <legend>Выход</legend>
                  <label className="demo-field">
                    <span className="demo-field__label">Эффект</span>
                    <select
                      value={activeItem.exit?.effect || 'none'}
                      onChange={(e) => handleBlockChange({
                        exit: { ...activeItem.exit, effect: e.target.value },
                      })}
                    >
                      {DEMO_PROGRAM_EXIT_EFFECTS.map((effect) => (
                        <option key={effect.id} value={effect.id}>{effect.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Длительность, мс</span>
                    <input
                      type="number"
                      min={0}
                      max={20000}
                      step={50}
                      value={activeItem.exit?.duration_ms ?? 400}
                      onChange={(e) => handleBlockChange({
                        exit: { ...activeItem.exit, duration_ms: Number(e.target.value) },
                      })}
                    />
                  </label>
                </fieldset>
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost"
                  onClick={() => onPreviewProgramItem?.(draft, activeItem)}
                  disabled={
                    (activeItem.type === DEMO_SEQUENCE_TYPE.STAGE && !activeItem.stage_id)
                    || (activeItem.type === DEMO_SEQUENCE_TYPE.MOSAIC && !activeItem.preset_id)
                  }
                >
                  Просмотр блока
                </button>
              </div>
            )}
          </section>
        </div>

        {draft && stageStudioOpen && (
          <DemoStageStudioModal
            stages={draft.stages || []}
            onChange={(stages) => patchDraft({ stages })}
            onClose={() => setStageStudioOpen(false)}
            onPreviewStep={onPreviewStep}
            onPreviewStage={onPreviewStage}
            onStartTextMapEdit={onStartTextMapEdit}
            onTextMapApplyRef={onTextMapApplyRef}
            alignTextOnMap={alignTextOnMap}
            getMapView={getMapView}
            objects={objects}
            events={events}
            situations={situations}
            zoneCatalogByCountry={zoneCatalogByCountry}
            overlayLayers={overlayLayers}
            countriesList={countriesList}
            readOnly={!canWrite}
          />
        )}

        {draft && mosaicStudioOpen && (
          <DemoMosaicStudioModal
            mosaic={draft.mosaic}
            stages={draft.stages || []}
            onChange={(mosaic) => patchDraft({ mosaic: normalizeScenarioMosaic(mosaic) })}
            onClose={() => setMosaicStudioOpen(false)}
            onPreviewMosaic={onPreviewMosaic}
            onOpenStages={() => {
              setMosaicStudioOpen(false);
              setStageStudioOpen(true);
            }}
            readOnly={!canWrite}
          />
        )}

        <footer className="demo-studio__footer">
          <DemoTimeline
            program={program}
            activeIndex={activeIndex}
            onSelectItem={setActiveIndex}
          />
        </footer>
      </div>
    </div>
  );
}
