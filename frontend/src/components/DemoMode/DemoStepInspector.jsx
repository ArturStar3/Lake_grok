import { useMemo } from 'react';
import DemoEntityPicker from './DemoEntityPicker';
import {
  DEMO_CAMERA_MODE,
  DEMO_CAMERA_MODES,
  DEMO_DIRECTIONS,
  DEMO_EASINGS,
  DEMO_EFFECT,
  DEMO_START_MODES,
  DEMO_STEP_MAX_DURATION_MS,
  DEMO_STEP_MIN_DURATION_MS,
  DEMO_TOOL,
  DEMO_TOOLS,
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
          options={DEMO_TOOLS}
          onChange={handleToolChange}
        />
        <div className="demo-inspector__picker">
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

      <fieldset className="demo-inspector__group" disabled={readOnly}>
        <legend>Тайминг</legend>
        <NumberField
          label="Длительность шага"
          value={step.duration_ms}
          min={DEMO_STEP_MIN_DURATION_MS}
          max={DEMO_STEP_MAX_DURATION_MS}
          step={500}
          suffix="мс"
        onChange={(duration_ms) => patch({ duration_ms })}
        />
        <SelectField
          label="Начало"
          value={step.start_mode}
          options={DEMO_START_MODES}
          onChange={(start_mode) => patch({ start_mode })}
          hint="«Вместе с предыдущим» показывает шаги одновременно"
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
          options={isCameraStep
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
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={() => {
                const center = onPickCameraFromMap?.() || mapCenter;
                if (center) patchCamera({ lat: center.lat, lng: center.lng, zoom: center.zoom ?? step.camera.zoom });
              }}
            >
              Взять текущий вид карты
            </button>
          </>
        )}
        {showCameraTiming && (
          <div className="demo-inspector__row">
            <NumberField
              label={step.camera.mode === DEMO_CAMERA_MODE.FIT_SELECTION ? 'Макс. масштаб' : 'Масштаб'}
              value={step.camera.zoom}
              min={1}
              max={20}
              step={1}
              onChange={(zoom) => patchCamera({ zoom })}
            />
            <NumberField
              label="Длительность перелёта"
              value={step.camera.duration_ms}
              min={0}
              max={60000}
              step={250}
              suffix="мс"
              onChange={(duration_ms) => patchCamera({ duration_ms })}
            />
          </div>
        )}
        {step.camera.mode === DEMO_CAMERA_MODE.FIT_SELECTION && (
          <NumberField
            label="Отступ от краёв"
            value={step.camera.padding}
            min={0}
            max={400}
            step={8}
            suffix="px"
            onChange={(padding) => patchCamera({ padding })}
          />
        )}
      </fieldset>

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
          hint={effects.length === 1 ? 'Для этого инструмента эффекты не предусмотрены' : undefined}
        />
        {showDirection && (
          <SelectField
            label="Направление"
            value={step.animation.direction}
            options={DEMO_DIRECTIONS}
            onChange={(direction) => patchAnimation({ direction })}
          />
        )}
        {step.animation.effect !== DEMO_EFFECT.NONE && !showStateCycle && (
          <div className="demo-inspector__row">
            <NumberField
              label="Длительность"
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
          </div>
        )}
        {step.animation.effect !== DEMO_EFFECT.NONE && !showStateCycle && (
          <SelectField
            label="Сглаживание"
            value={step.animation.easing}
            options={DEMO_EASINGS}
            onChange={(easing) => patchAnimation({ easing })}
          />
        )}
        {showStateCycle && (
          <>
            <div className="demo-inspector__row">
              <NumberField
                label="Показ состояния"
                value={step.animation.state_cycle.per_state_ms}
                min={200}
                max={60000}
                step={100}
                suffix="мс"
                onChange={(per_state_ms) => patchStateCycle({ per_state_ms })}
              />
              <NumberField
                label="Кросс-фейд"
                value={step.animation.state_cycle.cross_fade_ms}
                min={0}
                max={20000}
                step={100}
                suffix="мс"
                onChange={(cross_fade_ms) => patchStateCycle({ cross_fade_ms })}
              />
            </div>
            <SelectField
              label="Порядок состояний"
              value={step.animation.state_cycle.order}
              options={[
                { id: 'old_to_new', label: 'От старого к новому' },
                { id: 'new_to_old', label: 'От нового к старому' },
              ]}
              onChange={(order) => patchStateCycle({ order })}
            />
          </>
        )}
        {step.animation.effect !== DEMO_EFFECT.NONE && (
          <label className="demo-checkbox">
            <input
              type="checkbox"
              checked={Boolean(step.animation.continuous)}
              onChange={(e) => patchAnimation({ continuous: e.target.checked })}
            />
            <span className="demo-checkbox__text">
              Непрерывное действие
              <span className="demo-field__hint">
                Повторять эффект, пока идёт шаг. Длительность — один цикл.
              </span>
            </span>
          </label>
        )}
      </fieldset>
    </div>
  );
}
