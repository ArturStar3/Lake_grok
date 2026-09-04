import { useMemo, useState } from 'react';
import {
  DEMO_EASINGS,
  DEMO_MOSAIC_EXPAND_ANIMATIONS,
  DEMO_MOSAIC_LAYOUTS,
  DEMO_MOSAIC_REVEAL,
  DEMO_MOSAIC_SLOT_LABELS,
  createDefaultMosaicPreset,
  findMosaicPreset,
  findStage,
  getMosaicLayoutDef,
  normalizeMosaicPreset,
  normalizeScenarioMosaic,
} from '../../utils/demoScenario';
import './DemoMosaicStudioModal.css';

/**
 * Конструктор мультиэкрана: пресеты раскладки и назначение этапа на каждый слот.
 */
export default function DemoMosaicStudioModal({
  mosaic,
  stages = [],
  onChange,
  onClose,
  onOpenStages,
  onPreviewMosaic,
  readOnly = false,
}) {
  const library = useMemo(() => normalizeScenarioMosaic(mosaic), [mosaic]);
  const [presetId, setPresetId] = useState(library.active_preset_id || library.presets[0]?.id || null);
  const [screenId, setScreenId] = useState('a');

  const preset = findMosaicPreset(library, presetId) || library.presets[0] || null;
  const screen = preset?.screens?.find((item) => item.id === screenId) || preset?.screens?.[0] || null;
  const assignedStage = findStage(stages, screen?.stage_id);

  const patchLibrary = (partial) => {
    onChange(normalizeScenarioMosaic({ ...library, ...partial }));
  };

  const patchPreset = (partial) => {
    if (!preset) return;
    const next = normalizeMosaicPreset({ ...preset, ...partial });
    const presets = library.presets.map((item) => (item.id === preset.id ? next : item));
    patchLibrary({ presets, active_preset_id: next.id });
    setPresetId(next.id);
  };

  const patchScreen = (partial) => {
    if (!preset || !screen) return;
    const screens = preset.screens.map((item) => (
      item.id === screen.id ? { ...item, ...partial } : item
    ));
    patchPreset({ screens });
  };

  const handleAddPreset = () => {
    const next = createDefaultMosaicPreset({
      title: `Пресет ${library.presets.length + 1}`,
      layout: '2+3',
    });
    patchLibrary({
      presets: [...library.presets, next],
      active_preset_id: next.id,
    });
    setPresetId(next.id);
    setScreenId('a');
  };

  const handleDeletePreset = () => {
    if (!preset) return;
    const presets = library.presets.filter((item) => item.id !== preset.id);
    const active = presets[0]?.id || null;
    patchLibrary({ presets, active_preset_id: active });
    setPresetId(active);
  };

  const layoutSlots = preset ? getMosaicLayoutDef(preset.layout).slots : [];
  const stageOptions = [
    { id: '', label: 'Не назначен' },
    ...stages.map((stage) => ({
      id: String(stage.id || stage.key),
      label: stage.title || 'Без названия',
    })),
  ];

  return (
    <div className="demo-mosaic-studio-modal" role="dialog" aria-modal="true">
      <div className="demo-mosaic-studio-modal__backdrop" onClick={onClose} />
      <div className="demo-mosaic-studio-modal__panel">
        <header className="demo-mosaic-studio-modal__header">
          <div>
            <h2>Конструктор мультиэкрана</h2>
            <p>Раскладка экранов. На каждый слот назначается один этап из библиотеки.</p>
          </div>
          <button type="button" className="demo-btn demo-btn--ghost" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="demo-mosaic-studio-modal__body">
          <aside className="demo-mosaic-studio-modal__presets">
            <div className="demo-mosaic-studio-modal__presets-head">
              <h3>Пресеты</h3>
              {!readOnly && (
                <button type="button" className="demo-btn demo-btn--ghost" onClick={handleAddPreset}>
                  +
                </button>
              )}
            </div>
            <ul>
              {library.presets.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === preset?.id ? 'is-active' : ''}
                    onClick={() => {
                      setPresetId(item.id);
                      setScreenId(item.screens[0]?.id || 'a');
                      patchLibrary({ active_preset_id: item.id });
                    }}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
              {!library.presets.length && (
                <li className="demo-mosaic-studio-modal__empty">Пресетов пока нет</li>
              )}
            </ul>
            {preset && !readOnly && (
              <div className="demo-mosaic-studio-modal__presets-actions">
                <button type="button" className="demo-btn demo-btn--danger" onClick={handleDeletePreset}>
                  Удалить пресет
                </button>
              </div>
            )}
          </aside>

          <section className="demo-mosaic-studio-modal__main">
            {!preset ? (
              <p className="demo-mosaic-studio-modal__empty">
                Создайте пресет, чтобы настроить раскладку и экраны.
              </p>
            ) : (
              <>
                <fieldset className="demo-inspector__group" disabled={readOnly}>
                  <legend>Раскладка</legend>
                  <label className="demo-field">
                    <span className="demo-field__label">Название</span>
                    <input
                      type="text"
                      value={preset.title}
                      onChange={(e) => patchPreset({ title: e.target.value })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Схема</span>
                    <select
                      value={preset.layout}
                      onChange={(e) => {
                        patchPreset({ layout: e.target.value });
                        setScreenId('a');
                      }}
                    >
                      {DEMO_MOSAIC_LAYOUTS.map((layout) => (
                        <option key={layout.id} value={layout.id}>{layout.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Появление</span>
                    <select
                      value={preset.reveal}
                      onChange={(e) => patchPreset({ reveal: e.target.value })}
                    >
                      <option value={DEMO_MOSAIC_REVEAL.ALL}>Все экраны сразу</option>
                      <option value={DEMO_MOSAIC_REVEAL.STAGGER}>Постепенно</option>
                    </select>
                  </label>
                  {preset.reveal === DEMO_MOSAIC_REVEAL.STAGGER && (
                    <label className="demo-field">
                      <span className="demo-field__label">Пауза между экранами, мс</span>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        step={50}
                        value={preset.stagger_ms}
                        onChange={(e) => patchPreset({ stagger_ms: Number(e.target.value) })}
                      />
                    </label>
                  )}
                  <label className="demo-field">
                    <span className="demo-field__label">Длительность появления сетки, мс</span>
                    <input
                      type="number"
                      min={200}
                      max={5000}
                      step={50}
                      value={preset.transition_ms}
                      onChange={(e) => patchPreset({ transition_ms: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Анимация разворота / свёртки</span>
                    <select
                      value={preset.expand_animation}
                      onChange={(e) => patchPreset({ expand_animation: e.target.value })}
                    >
                      {DEMO_MOSAIC_EXPAND_ANIMATIONS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Длительность разворота, мс</span>
                    <input
                      type="number"
                      min={200}
                      max={5000}
                      step={50}
                      value={preset.expand_ms}
                      onChange={(e) => patchPreset({ expand_ms: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Плавность разворота</span>
                    <select
                      value={preset.expand_easing}
                      onChange={(e) => patchPreset({ expand_easing: e.target.value })}
                    >
                      {DEMO_EASINGS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Длительность свёртки, мс</span>
                    <input
                      type="number"
                      min={200}
                      max={5000}
                      step={50}
                      value={preset.collapse_ms}
                      onChange={(e) => patchPreset({ collapse_ms: Number(e.target.value) })}
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Плавность свёртки</span>
                    <select
                      value={preset.collapse_easing}
                      onChange={(e) => patchPreset({ collapse_easing: e.target.value })}
                    >
                      {DEMO_EASINGS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <span className="demo-field__label">Разрешить полноэкран</span>
                  <div className="demo-chip-row">
                    {layoutSlots.map((id) => {
                      const checked = (preset.expandable_slots || []).includes(id);
                      return (
                        <label key={id} className="demo-checkbox">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readOnly}
                            onChange={(e) => {
                              const current = preset.expandable_slots || [];
                              const next = e.target.checked
                                ? [...current, id]
                                : current.filter((slotId) => slotId !== id);
                              patchPreset({ expandable_slots: next });
                            }}
                          />
                          <span>{DEMO_MOSAIC_SLOT_LABELS[id] || id.toUpperCase()}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className={`demo-mosaic-preview demo-mosaic-preview--${preset.layout}`}>
                  {layoutSlots.map((id) => {
                    const item = preset.screens.find((screenItem) => screenItem.id === id);
                    const stage = findStage(stages, item?.stage_id);
                    return (
                      <button
                        type="button"
                        key={id}
                        className={[
                          'demo-mosaic-preview__cell',
                          `demo-mosaic-preview__cell--${id}`,
                          id === screen?.id ? 'is-active' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setScreenId(id)}
                      >
                        <span className="demo-mosaic-preview__title">
                          {item?.label || DEMO_MOSAIC_SLOT_LABELS[id] || id.toUpperCase()}
                        </span>
                        <span className="demo-mosaic-preview__bar">
                          {stage?.title || 'Этап не назначен'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="demo-btn demo-btn--ghost demo-stage-studio__preview"
                  onClick={() => onPreviewMosaic?.(preset, stages)}
                >
                  Просмотр пресета
                </button>
              </>
            )}
          </section>

          <section className="demo-mosaic-studio-modal__screen">
            {!screen ? (
              <p className="demo-mosaic-studio-modal__empty">Выберите экран</p>
            ) : (
              <fieldset className="demo-inspector__group" disabled={readOnly}>
                <legend>
                  {DEMO_MOSAIC_SLOT_LABELS[screen.id] || screen.id.toUpperCase()}
                </legend>
                <label className="demo-field">
                  <span className="demo-field__label">Подпись панели</span>
                  <input
                    type="text"
                    value={screen.label}
                    onChange={(e) => patchScreen({ label: e.target.value })}
                  />
                </label>
                <label className="demo-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(screen.loop)}
                    onChange={(e) => patchScreen({ loop: e.target.checked })}
                  />
                  <span>Пульсация маркеров на мини-карте</span>
                </label>

                <label className="demo-field">
                  <span className="demo-field__label">Этап на этом экране</span>
                  <select
                    value={screen.stage_id || ''}
                    onChange={(e) => patchScreen({ stage_id: e.target.value || null })}
                  >
                    {stageOptions.map((option) => (
                      <option key={option.id || 'none'} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {!stages.length && (
                  <p className="demo-field__hint">
                    Сначала создайте этапы в конструкторе этапов.
                    {onOpenStages && (
                      <>
                        {' '}
                        <button type="button" className="demo-btn demo-btn--ghost" onClick={onOpenStages}>
                          Открыть этапы
                        </button>
                      </>
                    )}
                  </p>
                )}
                {assignedStage && (
                  <p className="demo-field__hint">
                    Камера и объекты берутся из этапа «{assignedStage.title || 'Без названия'}».
                  </p>
                )}
              </fieldset>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
