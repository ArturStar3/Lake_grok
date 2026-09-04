import { useMemo } from 'react';
import DemoEntityPicker from './DemoEntityPicker';
import DemoTextEditor from './DemoTextEditor';
import {
  DEMO_CAMERA_MODE,
  DEMO_CAMERA_MODES,
  DEMO_DIRECTIONS,
  DEMO_EASINGS,
  DEMO_EFFECT,
  DEMO_START_MODE,
  DEMO_START_MODES,
  DEMO_STEP_MAX_DURATION_MS,
  DEMO_STEP_MIN_DURATION_MS,
  DEMO_STAGE_TOOLS,
  DEMO_TOOL,
  getEffectsForTool,
  getToolLabel,
  isContinuousByDefault,
} from '../../utils/demoScenario';

function NumberField({ label, value, onChange, min, max, step = 100, suffix, hint }) {
  return (
    <label className="demo-field">
      <span className="demo-field__label">{label}</span>
      <span className="demo-field__control">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix ? <span className="demo-field__suffix">{suffix}</span> : null}
      </span>
      {hint ? <span className="demo-field__hint">{hint}</span> : null}
    </label>
  );
}

const START_MODE_HINTS = {
  [DEMO_START_MODE.ON_CLICK]: 'Начинает новый такт внутри этапа',
  [DEMO_START_MODE.AFTER_PREVIOUS]: 'Стартует, когда отыграет предыдущий элемент',
  [DEMO_START_MODE.WITH_PREVIOUS]: 'Идёт одновременно с предыдущим элементом',
};

function SelectField({ label, value, options, onChange, hint }) {
  return (
    <label className="demo-field">
      <span className="demo-field__label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      {hint ? <span className="demo-field__hint">{hint}</span> : null}
    </label>
  );
}

/**
 * «Область анимации» — правая колонка конструктора: инструмент, содержимое,
 * камера и параметры эффекта выбранного шага.
 */
export default function DemoStepInspector({
  step,
  stepNumber,
  onChange,
  onPreview,
  onPickCameraFromMap,
  onStartTextMapEdit,
  alignTextOnMap,
  mapCenter,
  objects,
  events,
  situations,
  zoneCatalogByCountry,
  overlayLayers,
  countriesList,
  readOnly = false,
}) {
  const effects = useMemo(() => getEffectsForTool(step?.tool), [step?.tool]);

  if (!step) {
    return (
      <div className="demo-inspector demo-inspector--empty">
        <p>Выберите шаг слева или добавьте новый, чтобы настроить анимацию.</p>
      </div>
    );
  }

  const patch = (partial) => onChange({ ...step, ...partial });
  const patchCamera = (partial) => patch({ camera: { ...step.camera, ...partial } });
  const patchAnimation = (partial) => patch({ animation: { ...step.animation, ...partial } });
  const patchStateCycle = (partial) => patchAnimation({
    state_cycle: { ...step.animation.state_cycle, ...partial },
  });

  const handleToolChange = (tool) => {
    const allowed = getEffectsForTool(tool).map((effect) => effect.id);
    const nextEffect = allowed.includes(step.animation.effect) ? step.animation.effect : allowed[0];
    patch({
      tool,
      title: step.title || getToolLabel(tool),
      animation: {
        ...step.animation,
        effect: nextEffect,
        continuous: isContinuousByDefault(nextEffect),
      },
    });
  };

  const isCameraStep = step.tool === DEMO_TOOL.CAMERA;
  const isTextStep = step.tool === DEMO_TOOL.TEXT;
  const showDirection = step.animation.effect === DEMO_EFFECT.DIRECTIONAL_WIPE;
  const showStateCycle = step.animation.effect === DEMO_EFFECT.STATE_CYCLE;
  const showFlyToFields = step.camera.mode === DEMO_CAMERA_MODE.FLY_TO;
  const showCameraTiming = step.camera.mode !== DEMO_CAMERA_MODE.NONE;

  return (
    <div className="demo-inspector">
      <header className="demo-inspector__header">
        <h3>Шаг {stepNumber}</h3>
        <button type="button" className="demo-btn demo-btn--ghost" onClick={onPreview}>
          Просмотр шага
        </button>
      </header>

      <fieldset className="demo-inspector__group" disabled={readOnly}>
        <legend>Что показываем</legend>
        <label className="demo-field">
          <span className="demo-field__label">Название шага</span>
          <input
            type="text"
            value={step.title}
            placeholder={getToolLabel(step.tool)}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <SelectField
          label="Инструмент"
          value={step.tool}
          options={DEMO_STAGE_TOOLS}
          onChange={handleToolChange}
        />
        <div className="demo-inspector__picker">
          {!isTextStep && (
            <DemoEntityPicker
              tool={step.tool}
              selection={step.selection}
              onSelectionChange={(selection) => patch({ selection })}
              objects={objects}
              events={events}
              situations={situations}
              zoneCatalogByCountry={zoneCatalogByCountry}
              overlayLayers={overlayLayers}
              countriesList={countriesList}
            />
          )}
          {(step.tool === DEMO_TOOL.FORMULAR || step.tool === DEMO_TOOL.COUNTRY) ? (
            <p className="demo-field__hint">
              Несколько объектов или стран показываются по очереди. Отмеченные пункты открываются сразу (тоже по очереди).
            </p>
          ) : null}
          {step.tool === DEMO_TOOL.SITUATIONS ? (
            <p className="demo-field__hint">
              На шаге показывается одна обстановка: карта и карточка подробностей. Смена состояний синхронизирована с карточкой.
            </p>
          ) : null}
        </div>
      </fieldset>

      {isTextStep && (
        <DemoTextEditor
          text={step.text}
          onChange={(text) => patch({ text })}
          onPickPointFromMap={onPickCameraFromMap}
          onStartMapEdit={readOnly ? undefined : onStartTextMapEdit}
          alignTextOnMap={readOnly ? undefined : alignTextOnMap}
          mapCenter={mapCenter}
        />
      )}

      <fieldset className="demo-inspector__group" disabled={readOnly}>
        <legend>Тайминг</legend>
        <SelectField
          label="Начало"
          value={step.start_mode}
          options={DEMO_START_MODES}
          onChange={(start_mode) => patch({ start_mode })}
          hint={START_MODE_HINTS[step.start_mode]}
        />
        <NumberField
          label="Длительность шага"
          value={step.duration_ms}
          min={DEMO_STEP_MIN_DURATION_MS}
          max={DEMO_STEP_MAX_DURATION_MS}
          step={500}
          suffix="мс"
          hint={step.start_mode === DEMO_START_MODE.ON_CLICK
            ? 'В ручном режиме это время до следующего элемента внутри этапа'
            : undefined}
          onChange={(duration_ms) => patch({ duration_ms })}
        />
        <label className="demo-checkbox">
          <input
            type="checkbox"
            checked={step.hold_previous}
            onChange={(e) => patch({ hold_previous: e.target.checked })}
          />
          <span>Не убирать содержимое предыдущего шага</span>
        </label>
      </fieldset>

      <fieldset className="demo-inspector__group" disabled={readOnly}>
          <legend>Камера</legend>
          <SelectField
            label="Режим"
            value={step.camera.mode}
            options={isCameraStep || isTextStep
              ? DEMO_CAMERA_MODES.filter((mode) => mode.id !== DEMO_CAMERA_MODE.FIT_SELECTION)
              : DEMO_CAMERA_MODES}
            onChange={(mode) => patchCamera({ mode })}
          />
          {showFlyToFields && (
            <>
              <div className="demo-inspector__row">
                <NumberField
                  label="Широта"
                  value={step.camera.lat ?? ''}
                  min={-90}
                  max={90}
                  step={0.001}
                  onChange={(lat) => patchCamera({ lat })}
                />
                <NumberField
                  label="Долгота"
                  value={step.camera.lng ?? ''}
                  min={-180}
                  max={180}
                  step={0.001}
                  onChange={(lng) => patchCamera({ lng })}
                />
              </div>
              <NumberField
                label="Масштаб"
                value={step.camera.zoom}
                min={1}
                max={20}
                step={1}
                onChange={(zoom) => patchCamera({ zoom })}
              />
              <button
                type="button"
                className="demo-btn demo-btn--ghost"
                onClick={() => {
                  const view = onPickCameraFromMap?.();
                  if (!view) return;
                  patchCamera({
                    mode: DEMO_CAMERA_MODE.FLY_TO,
                    lat: view.lat,
                    lng: view.lng,
                    zoom: view.zoom,
                  });
                }}
              >
                Взять с карты
              </button>
            </>
          )}
          {showCameraTiming && (
            <>
              <NumberField
                label="Длительность камеры"
                value={step.camera.duration_ms}
                min={0}
                max={60000}
                step={100}
                suffix="мс"
                onChange={(duration_ms) => patchCamera({ duration_ms })}
              />
              <NumberField
                label="Плавность"
                value={step.camera.ease_linearity}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(ease_linearity) => patchCamera({ ease_linearity })}
              />
            </>
          )}
        </fieldset>

      {!isTextStep && (
        <fieldset className="demo-inspector__group" disabled={readOnly}>
          <legend>Анимация</legend>
          <SelectField
            label="Эффект"
            value={step.animation.effect}
            options={effects}
            onChange={(effect) => patchAnimation({
              effect,
              continuous: isContinuousByDefault(effect),
            })}
          />
          {showDirection && (
            <SelectField
              label="Направление"
              value={step.animation.direction}
              options={DEMO_DIRECTIONS}
              onChange={(direction) => patchAnimation({ direction })}
            />
          )}
          <NumberField
            label="Длительность эффекта"
            value={step.animation.duration_ms}
            min={0}
            max={60000}
            step={100}
            suffix="мс"
            onChange={(duration_ms) => patchAnimation({ duration_ms })}
          />
          <NumberField
            label="Задержка"
            value={step.animation.delay_ms}
            min={0}
            max={60000}
            step={100}
            suffix="мс"
            onChange={(delay_ms) => patchAnimation({ delay_ms })}
          />
          <SelectField
            label="Сглаживание"
            value={step.animation.easing}
            options={DEMO_EASINGS}
            onChange={(easing) => patchAnimation({ easing })}
          />
          <label className="demo-checkbox">
            <input
              type="checkbox"
              checked={Boolean(step.animation.continuous)}
              onChange={(e) => patchAnimation({ continuous: e.target.checked })}
            />
            <span>Непрерывно</span>
          </label>
          {showStateCycle && (
            <>
              <NumberField
                label="Время на состояние"
                value={step.animation.state_cycle.per_state_ms}
                min={200}
                max={60000}
                step={100}
                suffix="мс"
                onChange={(per_state_ms) => patchStateCycle({ per_state_ms })}
              />
              <NumberField
                label="Перекрёстное растворение"
                value={step.animation.state_cycle.cross_fade_ms}
                min={0}
                max={20000}
                step={100}
                suffix="мс"
                onChange={(cross_fade_ms) => patchStateCycle({ cross_fade_ms })}
              />
              <SelectField
                label="Порядок состояний"
                value={step.animation.state_cycle.order}
                options={[
                  { id: 'old_to_new', label: 'От старых к новым' },
                  { id: 'new_to_old', label: 'От новых к старым' },
                ]}
                onChange={(order) => patchStateCycle({ order })}
              />
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}
