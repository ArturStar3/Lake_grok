import { memo } from 'react';
import { normalizeCue } from '../../utils/demoScenario';
import './DemoCueMark.css';

/**
 * Тихая цифра позиции доклада в правом верхнем углу.
 * Пустое / невалидное значение не рисуется.
 */
function DemoCueMark({ value, size = 'md' }) {
  const cue = normalizeCue(value);
  if (cue == null) return null;
  return (
    <div
      className={`demo-cue demo-cue--${size}`}
      aria-hidden="true"
    >
      {cue}
    </div>
  );
}

export default memo(DemoCueMark);
