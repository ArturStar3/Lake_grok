import { createPortal } from 'react-dom';
import { DEMO_BLACKOUT } from '../../hooks/demo/useDemoPlayer';

/**
 * Затемнение экрана во время показа (клавиши B и W, как в PowerPoint):
 * докладчик гасит картинку, чтобы переключить внимание аудитории на себя.
 */
export default function DemoBlackout({ mode, onDismiss }) {
  if (!mode || mode === DEMO_BLACKOUT.NONE) return null;

  return createPortal(
    <div
      className={`demo-blackout demo-blackout--${mode}`}
      role="presentation"
      onClick={() => onDismiss?.(mode)}
    >
      <span className="demo-blackout__hint">
        Нажмите ту же клавишу или щёлкните, чтобы вернуть изображение
      </span>
    </div>,
    document.body,
  );
}
