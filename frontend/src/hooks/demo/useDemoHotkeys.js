import { useEffect, useRef } from 'react';
import { DEMO_BLACKOUT } from './useDemoPlayer';

/** Пауза между цифрами при наборе номера этапа. */
const DIGIT_TIMEOUT_MS = 1200;

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
    || target.isContentEditable;
}

/**
 * Клавиатурное управление показом.
 *
 * Живёт отдельно от HUD, потому что панель прячется во время демонстрации, а
 * клавиши должны работать всегда. Раскладка совместима с презентерами
 * (Logitech, Kensington и подобные): пульты — это обычные HID-клавиатуры и
 * шлют PageUp/PageDown, Space, точку и B, как ожидает PowerPoint.
 */
export function useDemoHotkeys({
  active,
  onNext,
  onPrev,
  onTogglePause,
  onStop,
  onRestart,
  onGoToStage,
  onBlackout,
  stageCount = 0,
}) {
  const handlersRef = useRef({});
  handlersRef.current = {
    onNext, onPrev, onTogglePause, onStop, onRestart, onGoToStage, onBlackout, stageCount,
  };

  const digitBufferRef = useRef('');
  const digitTimerRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    const resetDigits = () => {
      digitBufferRef.current = '';
      if (digitTimerRef.current) {
        clearTimeout(digitTimerRef.current);
        digitTimerRef.current = null;
      }
    };

    const handleKey = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const api = handlersRef.current;
      const key = event.key;

      // Набор номера этапа: «12» + Enter переводит на 12-й этап.
      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        digitBufferRef.current = (digitBufferRef.current + key).slice(-3);
        if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
        digitTimerRef.current = setTimeout(resetDigits, DIGIT_TIMEOUT_MS);
        return;
      }

      switch (key) {
        case 'Enter': {
          event.preventDefault();
          const wanted = Number(digitBufferRef.current);
          resetDigits();
          if (wanted >= 1 && wanted <= api.stageCount) api.onGoToStage?.(wanted - 1);
          else api.onNext?.();
          break;
        }
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Spacebar':
        case 'n':
        case 'N':
        case 'т':
        case 'Т':
          // Space и PageDown иначе прокручивают страницу под картой.
          event.preventDefault();
          resetDigits();
          api.onNext?.();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
        case 'p':
        case 'P':
        case 'з':
        case 'З':
          event.preventDefault();
          resetDigits();
          api.onPrev?.();
          break;
        case 'Home':
          event.preventDefault();
          resetDigits();
          api.onGoToStage?.(0);
          break;
        case 'End':
          event.preventDefault();
          resetDigits();
          if (api.stageCount) api.onGoToStage?.(api.stageCount - 1);
          break;
        case 'F5':
          event.preventDefault();
          resetDigits();
          api.onRestart?.();
          break;
        case 's':
        case 'S':
        case 'ы':
        case 'Ы':
          event.preventDefault();
          resetDigits();
          api.onTogglePause?.();
          break;
        case 'b':
        case 'B':
        case 'и':
        case 'И':
        case '.':
          event.preventDefault();
          resetDigits();
          api.onBlackout?.(DEMO_BLACKOUT.BLACK);
          break;
        case 'w':
        case 'W':
        case 'ц':
        case 'Ц':
        case ',':
          event.preventDefault();
          resetDigits();
          api.onBlackout?.(DEMO_BLACKOUT.WHITE);
          break;
        case 'Escape':
          event.preventDefault();
          resetDigits();
          api.onStop?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      resetDigits();
    };
  }, [active]);
}
