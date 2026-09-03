import { useEffect, useMemo, useState } from 'react';
import DemoTextAlignPresets from './DemoTextAlignPresets';
import DemoTextItem from '../MapComponent/demo/DemoTextItem';
import {
  DEMO_DIRECTIONS,
  DEMO_EASINGS,
  DEMO_TEXT_ALIGNS,
  DEMO_TEXT_ANCHOR,
  DEMO_TEXT_ANCHORS,
  DEMO_TEXT_ENTER_EFFECTS,
  DEMO_TEXT_EXIT_EFFECTS,
  DEMO_TEXT_FONTS,
  DEMO_TEXT_MAX_LENGTH,
  DEMO_TEXT_WEIGHTS,
} from '../../utils/demoScenario';
import { demoTextExitDuration } from '../../utils/demoTextStyle';
import '../MapComponent/demo/DemoTextLayer.css';

const PREVIEW_HOLD_MS = 800;

function previewEnterDurationMs(text) {
  const enter = text?.enter;
  if (!enter || enter.effect === 'none') return 400;
  return Math.max(300, (enter.duration_ms ?? 600) + (enter.delay_ms ?? 0));
}

function previewCycleSignature(text) {
  const enter = text?.enter || {};
  const exit = text?.exit || {};
  return [
    text?.content,
    enter.effect,
    enter.duration_ms,
    enter.delay_ms,
    enter.direction,
    enter.easing,
    exit.effect,
    exit.duration_ms,
    exit.delay_ms,
    exit.direction,
    exit.easing,
  ].join('|');
}

function Field({ label, hint, children }) {
  return (
    <label className="demo-field">
      <span className="demo-field__label">{label}</span>
      {children}
      {hint ? <span className="demo-field__hint">{hint}</span> : null}
    </label>
  );
}

function Select({ label, value, options, onChange, hint }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1, suffix, hint }) {
  return (
    <Field label={label} hint={hint}>
      <span className="demo-field__control">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        {suffix ? <span className="demo-field__suffix">{suffix}</span> : null}
      </span>
    </Field>
  );
}

function ColorInput({ label, value, onChange }) {
  // Нативная палитра понимает только #rrggbb; rgba() из сценария показываем текстом.
  const hex = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#ffffff';
  return (
    <Field label={label}>
      <span className="demo-field__control demo-field__control--color">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </span>
    </Field>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="demo-checkbox">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Редактор шага «Текст на карте»: содержимое, положение, оформление и
 * эффекты входа/выхода. Превью использует тот же компонент, что и карта,
 * поэтому показывает результат один в один.
 */
export default function DemoTextEditor({
  text,
  onChange,
  onPickPointFromMap,
  onStartMapEdit,
  alignTextOnMap,
  mapCenter,
}) {
  const value = text || {};
  const style = value.style || {};

  const patch = (partial) => onChange({ ...value, ...partial });
  const patchStyle = (partial) => patch({ style: { ...style, ...partial } });
  const patchBlock = (block, partial) => patchStyle({ [block]: { ...(style[block] || {}), ...partial } });
  const patchEnter = (partial) => patch({ enter: { ...(value.enter || {}), ...partial } });
  const patchExit = (partial) => patch({ exit: { ...(value.exit || {}), ...partial } });

  const isGeo = value.anchor === DEMO_TEXT_ANCHOR.GEO;
  const canAlignGeo = Boolean(alignTextOnMap);
  const handleAlign = (axis) => {
    if (isGeo) {
      const next = alignTextOnMap?.(value, axis);
      if (next) onChange(next);
      return;
    }
    patch({
      screen: {
        ...(value.screen || {}),
        ...(axis.x != null ? { x: axis.x } : {}),
        ...(axis.y != null ? { y: axis.y } : {}),
      },
    });
  };
  const previewText = useMemo(
    () => ({ ...(text || {}), content: text?.content || 'Пример текста' }),
    [text],
  );
  const previewSignature = previewCycleSignature(value);
  const [previewCycle, setPreviewCycle] = useState({ phase: 'enter', gen: 0 });

  useEffect(() => {
    let cancelled = false;
    let timeoutId;
    const enterMs = previewEnterDurationMs(value);
    const exitMs = Math.max(200, demoTextExitDuration(value) || 400);

    const step = (phase, gen) => {
      if (cancelled) return;
      setPreviewCycle({ phase, gen });
      const wait = phase === 'enter'
        ? enterMs + PREVIEW_HOLD_MS
        : exitMs + PREVIEW_HOLD_MS;
      const nextPhase = phase === 'enter' ? 'exit' : 'enter';
      const nextGen = phase === 'exit' ? gen + 1 : gen;
      timeoutId = setTimeout(() => step(nextPhase, nextGen), wait);
    };

    step('enter', 0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // Цикл завязан на подпись настроек, а не на весь объект шага.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSignature]);

  return (
    <div className="demo-text-editor">
      <fieldset className="demo-inspector__group">
        <legend>Текст</legend>
        <Field
          label="Содержимое"
          hint={`Перенос строки сохраняется. Осталось символов: ${DEMO_TEXT_MAX_LENGTH - (value.content?.length || 0)}`}
        >
          <textarea
            rows={3}
            maxLength={DEMO_TEXT_MAX_LENGTH}
            value={value.content || ''}
            placeholder="Например: Кавказский регион"
            onChange={(e) => patch({ content: e.target.value })}
          />
        </Field>

        {onStartMapEdit && (
          <button
            type="button"
            className="demo-btn demo-btn--primary demo-text-editor__map-btn"
            onClick={onStartMapEdit}
          >
            Настроить на карте
          </button>
        )}

        <div className="demo-text-editor__preview">
          <span className="demo-text-editor__preview-label">Предпросмотр входа и выхода</span>
          <div className="demo-text-editor__preview-canvas">
            <DemoTextItem
              key={`${previewCycle.phase}-${previewCycle.gen}`}
              text={previewText}
              phase={previewCycle.phase}
              anchorStyle={{ left: '50%', top: '50%' }}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="demo-inspector__group">
        <legend>Положение</legend>
        <Select
          label="Привязка"
          value={value.anchor || DEMO_TEXT_ANCHOR.SCREEN}
          options={DEMO_TEXT_ANCHORS}
          onChange={(anchor) => patch({ anchor })}
          hint={isGeo
            ? 'Текст стоит в точке карты и едет вместе с ней'
            : 'Текст остаётся на месте, как титр поверх карты'}
        />

        {isGeo ? (
          <>
            <div className="demo-inspector__row">
              <NumberInput
                label="Широта"
                value={value.lat}
                min={-90}
                max={90}
                step={0.001}
                onChange={(lat) => patch({ lat })}
              />
              <NumberInput
                label="Долгота"
                value={value.lng}
                min={-180}
                max={180}
                step={0.001}
                onChange={(lng) => patch({ lng })}
              />
            </div>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={() => {
                const center = onPickPointFromMap?.() || mapCenter;
                if (center) patch({ lat: center.lat, lng: center.lng });
              }}
            >
              Взять центр текущего вида карты
            </button>
            <Toggle
              label="Масштабировать вместе с картой"
              checked={style.scale_with_map}
              onChange={(scale_with_map) => patchStyle({ scale_with_map })}
            />
          </>
        ) : (
          <div className="demo-inspector__row">
            <NumberInput
              label="По горизонтали"
              value={Math.round((value.screen?.x ?? 0.5) * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(x) => patch({ screen: { ...(value.screen || {}), x: (x ?? 50) / 100 } })}
            />
            <NumberInput
              label="По вертикали"
              value={Math.round((value.screen?.y ?? 0.15) * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(y) => patch({ screen: { ...(value.screen || {}), y: (y ?? 15) / 100 } })}
            />
          </div>
        )}

        <DemoTextAlignPresets
          onAlign={handleAlign}
          disabled={isGeo && !canAlignGeo}
          hint={isGeo
            ? (canAlignGeo
              ? 'Точка ставится относительно текущего вида карты'
              : 'Выравнивание по краям экрана доступно в режиме «Настроить на карте»')
            : null}
        />

        <div className="demo-inspector__row">
          <NumberInput
            label="Сдвиг по X"
            value={value.offset?.x ?? 0}
            min={-2000}
            max={2000}
            suffix="px"
            onChange={(x) => patch({ offset: { ...(value.offset || {}), x: x ?? 0 } })}
          />
          <NumberInput
            label="Сдвиг по Y"
            value={value.offset?.y ?? 0}
            min={-2000}
            max={2000}
            suffix="px"
            onChange={(y) => patch({ offset: { ...(value.offset || {}), y: y ?? 0 } })}
          />
        </div>

        <NumberInput
          label="Ширина блока"
          value={value.width}
          min={40}
          max={2000}
          step={10}
          suffix="px"
          hint="Пусто — ширина по содержимому"
          onChange={(width) => patch({ width })}
        />
      </fieldset>

      <fieldset className="demo-inspector__group">
        <legend>Шрифт</legend>
        <Select
          label="Гарнитура"
          value={style.font_family || 'Roboto'}
          options={DEMO_TEXT_FONTS}
          onChange={(font_family) => patchStyle({ font_family })}
          hint="Встроен только Roboto; остальные берутся из шрифтов системы"
        />
        <div className="demo-inspector__row">
          <NumberInput
            label="Размер"
            value={style.font_size ?? 32}
            min={8}
            max={200}
            suffix="px"
            onChange={(font_size) => patchStyle({ font_size: font_size ?? 32 })}
          />
          <Select
            label="Насыщенность"
            value={String(style.font_weight ?? 700)}
            options={DEMO_TEXT_WEIGHTS.map((item) => ({ id: String(item.id), label: item.label }))}
            onChange={(font_weight) => patchStyle({ font_weight: Number(font_weight) })}
          />
        </div>
        <div className="demo-inspector__row">
          <NumberInput
            label="Межстрочный интервал"
            value={style.line_height ?? 1.2}
            min={0.6}
            max={4}
            step={0.05}
            onChange={(line_height) => patchStyle({ line_height: line_height ?? 1.2 })}
          />
          <NumberInput
            label="Межбуквенный интервал"
            value={style.letter_spacing ?? 0}
            min={-10}
            max={40}
            step={0.5}
            suffix="px"
            onChange={(letter_spacing) => patchStyle({ letter_spacing: letter_spacing ?? 0 })}
          />
        </div>
        <Select
          label="Выравнивание"
          value={style.text_align || 'center'}
          options={DEMO_TEXT_ALIGNS}
          onChange={(text_align) => patchStyle({ text_align })}
        />
        <div className="demo-text-editor__toggles">
          <Toggle label="Курсив" checked={style.italic} onChange={(italic) => patchStyle({ italic })} />
          <Toggle label="Подчёркивание" checked={style.underline} onChange={(underline) => patchStyle({ underline })} />
        </div>
      </fieldset>

      <fieldset className="demo-inspector__group">
        <legend>Оформление</legend>
        <ColorInput
          label="Цвет заливки"
          value={style.color}
          onChange={(color) => patchStyle({ color })}
        />

        <Toggle
          label="Градиентная заливка"
          checked={style.gradient?.enabled}
          onChange={(enabled) => patchBlock('gradient', { enabled })}
        />
        {style.gradient?.enabled && (
          <>
            <div className="demo-inspector__row">
              <ColorInput label="Начало" value={style.gradient?.from} onChange={(from) => patchBlock('gradient', { from })} />
              <ColorInput label="Конец" value={style.gradient?.to} onChange={(to) => patchBlock('gradient', { to })} />
            </div>
            <NumberInput
              label="Угол"
              value={style.gradient?.angle ?? 90}
              min={0}
              max={360}
              suffix="°"
              onChange={(angle) => patchBlock('gradient', { angle: angle ?? 90 })}
            />
          </>
        )}

        <Toggle
          label="Абрис (обводка)"
          checked={style.stroke?.enabled}
          onChange={(enabled) => patchBlock('stroke', { enabled })}
        />
        {style.stroke?.enabled && (
          <div className="demo-inspector__row">
            <ColorInput label="Цвет абриса" value={style.stroke?.color} onChange={(color) => patchBlock('stroke', { color })} />
            <NumberInput
              label="Толщина"
              value={style.stroke?.width ?? 2}
              min={0}
              max={20}
              step={0.5}
              suffix="px"
              onChange={(width) => patchBlock('stroke', { width: width ?? 0 })}
            />
          </div>
        )}

        <Toggle
          label="Подложка"
          checked={style.background?.enabled}
          onChange={(enabled) => patchBlock('background', { enabled })}
        />
        {style.background?.enabled && (
          <>
            <ColorInput label="Цвет подложки" value={style.background?.color} onChange={(color) => patchBlock('background', { color })} />
            <div className="demo-inspector__row">
              <NumberInput
                label="Прозрачность"
                value={style.background?.opacity ?? 0.6}
                min={0}
                max={1}
                step={0.05}
                onChange={(opacity) => patchBlock('background', { opacity: opacity ?? 0.6 })}
              />
              <NumberInput
                label="Скругление"
                value={style.background?.radius ?? 8}
                min={0}
                max={80}
                suffix="px"
                onChange={(radius) => patchBlock('background', { radius: radius ?? 0 })}
              />
            </div>
            <NumberInput
              label="Внутренний отступ"
              value={style.background?.padding ?? 12}
              min={0}
              max={120}
              suffix="px"
              onChange={(padding) => patchBlock('background', { padding: padding ?? 0 })}
            />
          </>
        )}

        <Toggle
          label="Тень"
          checked={style.shadow?.enabled}
          onChange={(enabled) => patchBlock('shadow', { enabled })}
        />
        {style.shadow?.enabled && (
          <>
            <ColorInput label="Цвет тени" value={style.shadow?.color} onChange={(color) => patchBlock('shadow', { color })} />
            <div className="demo-inspector__row">
              <NumberInput
                label="Размытие"
                value={style.shadow?.blur ?? 12}
                min={0}
                max={80}
                suffix="px"
                onChange={(blur) => patchBlock('shadow', { blur: blur ?? 0 })}
              />
              <NumberInput
                label="Смещение Y"
                value={style.shadow?.y ?? 2}
                min={-40}
                max={40}
                suffix="px"
                onChange={(y) => patchBlock('shadow', { y: y ?? 0 })}
              />
            </div>
          </>
        )}

        <div className="demo-inspector__row">
          <NumberInput
            label="Наклон блока"
            value={style.rotation ?? 0}
            min={-180}
            max={180}
            suffix="°"
            onChange={(rotation) => patchStyle({ rotation: rotation ?? 0 })}
          />
          <NumberInput
            label="Непрозрачность"
            value={style.opacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) => patchStyle({ opacity: opacity ?? 1 })}
          />
        </div>
      </fieldset>

      <fieldset className="demo-inspector__group">
        <legend>Появление</legend>
        <Select
          label="Эффект входа"
          value={value.enter?.effect || 'fade'}
          options={DEMO_TEXT_ENTER_EFFECTS}
          onChange={(effect) => patchEnter({ effect })}
        />
        {value.enter?.effect === 'slide' && (
          <Select
            label="Откуда выезжает"
            value={value.enter?.direction || 'bottom'}
            options={DEMO_DIRECTIONS}
            onChange={(direction) => patchEnter({ direction })}
          />
        )}
        {value.enter?.effect !== 'none' && (
          <>
            <div className="demo-inspector__row">
              <NumberInput
                label="Длительность"
                value={value.enter?.duration_ms ?? 600}
                min={0}
                max={20000}
                step={100}
                suffix="мс"
                onChange={(duration_ms) => patchEnter({ duration_ms: duration_ms ?? 0 })}
              />
              <NumberInput
                label="Задержка"
                value={value.enter?.delay_ms ?? 0}
                min={0}
                max={20000}
                step={100}
                suffix="мс"
                onChange={(delay_ms) => patchEnter({ delay_ms: delay_ms ?? 0 })}
              />
            </div>
            {value.enter?.effect !== 'typewriter' && (
              <Select
                label="Сглаживание"
                value={value.enter?.easing || 'ease_out'}
                options={DEMO_EASINGS}
                onChange={(easing) => patchEnter({ easing })}
              />
            )}
          </>
        )}
      </fieldset>

      <fieldset className="demo-inspector__group">
        <legend>Исчезновение</legend>
        <Select
          label="Эффект выхода"
          value={value.exit?.effect || 'fade'}
          options={DEMO_TEXT_EXIT_EFFECTS}
          onChange={(effect) => patchExit({ effect })}
          hint="Проигрывается, когда текст снимается следующим этапом"
        />
        {value.exit?.effect === 'slide' && (
          <Select
            label="Куда уезжает"
            value={value.exit?.direction || 'top'}
            options={DEMO_DIRECTIONS}
            onChange={(direction) => patchExit({ direction })}
          />
        )}
        {value.exit?.effect !== 'none' && (
          <NumberInput
            label="Длительность"
            value={value.exit?.duration_ms ?? 400}
            min={0}
            max={20000}
            step={100}
            suffix="мс"
            onChange={(duration_ms) => patchExit({ duration_ms: duration_ms ?? 0 })}
          />
        )}
      </fieldset>
    </div>
  );
}
