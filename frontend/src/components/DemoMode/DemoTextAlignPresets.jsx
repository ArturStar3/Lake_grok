import { DEMO_TEXT_ALIGN_PRESETS } from '../../utils/demoScenario';
import './DemoTextAlignPresets.css';

/**
 * Независимые шаблоны выравнивания: сначала горизонталь, потом вертикаль
 * (или наоборот). Каждая кнопка задаёт только свою ось.
 */
export default function DemoTextAlignPresets({ onAlign, disabled = false, hint }) {
  return (
    <div className="demo-text-align">
      <div className="demo-text-align__group">
        <span className="demo-text-align__label">По горизонтали</span>
        <div className="demo-text-align__buttons" role="group" aria-label="Выравнивание по горизонтали">
          {DEMO_TEXT_ALIGN_PRESETS.horizontal.map((item) => (
            <button
              key={item.id}
              type="button"
              className="demo-text-align__btn"
              disabled={disabled}
              onClick={() => onAlign?.({ x: item.x })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="demo-text-align__group">
        <span className="demo-text-align__label">По вертикали</span>
        <div className="demo-text-align__buttons" role="group" aria-label="Выравнивание по вертикали">
          {DEMO_TEXT_ALIGN_PRESETS.vertical.map((item) => (
            <button
              key={item.id}
              type="button"
              className="demo-text-align__btn"
              disabled={disabled}
              onClick={() => onAlign?.({ y: item.y })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {hint ? <p className="demo-text-align__hint">{hint}</p> : null}
    </div>
  );
}
