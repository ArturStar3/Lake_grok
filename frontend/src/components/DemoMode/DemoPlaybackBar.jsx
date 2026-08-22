import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToolIcon, getToolLabel } from '../../utils/demoScenario';
import './DemoPlaybackBar.css';

const AUTO_HIDE_MS = 4000;

/**
 * HUD управления показом: пауза, переход по шагам, прогресс, выход.
 * Скрывается сам, пока мышь не двигается, чтобы не мешать демонстрации.
 */
export default function DemoPlaybackBar({
  playback,
  onToggle,
  onNext,
  onPrev,
  onStop,
}) {
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (!playback?.isActive) return undefined;

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    };
    const wake = () => {
      setVisible(true);
      scheduleHide();
    };

    scheduleHide();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playback?.isActive]);

  useEffect(() => {
    if (!playback?.isActive) return undefined;

    const handleKey = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;

      switch (event.key) {
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          onToggle?.();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNext?.();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onPrev?.();
          break;
        case 'Escape':
          event.preventDefault();
          onStop?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playback?.isActive, onToggle, onNext, onPrev, onStop]);

  if (!playback?.isActive) return null;

  const stepLabel = playback.stepTitle
    || playback.stepTools.map((tool) => getToolLabel(tool)).join(' + ')
    || 'Шаг';

  return createPortal(
    <div className={`demo-playbar${visible ? '' : ' demo-playbar--hidden'}`}>
      <div className="demo-playbar__progress" aria-hidden="true">
        <div
          className="demo-playbar__progress-fill"
          style={{ width: `${Math.round(playback.scenarioProgress * 100)}%` }}
        />
      </div>

      <div className="demo-playbar__row">
        <div className="demo-playbar__controls">
          <button type="button" onClick={onPrev} title="Предыдущий шаг (←)" aria-label="Предыдущий шаг">◀◀</button>
          <button
            type="button"
            className="demo-playbar__play"
            onClick={onToggle}
            title={playback.isPlaying ? 'Пауза (Space)' : 'Продолжить (Space)'}
            aria-label={playback.isPlaying ? 'Пауза' : 'Продолжить'}
          >
            {playback.isPlaying ? '❚❚' : '▶'}
          </button>
          <button type="button" onClick={onNext} title="Следующий шаг (→)" aria-label="Следующий шаг">▶▶</button>
        </div>

        <div className="demo-playbar__info">
          <span className="demo-playbar__scenario">{playback.scenarioTitle}</span>
          <span className="demo-playbar__step">
            <span aria-hidden="true">{getToolIcon(playback.stepTools[0])}</span>
            {' '}
            {stepLabel}
          </span>
        </div>

        <div className="demo-playbar__counter">
          {playback.cueIndex + 1} / {playback.cueCount}
          {playback.loop ? ' · цикл' : ''}
        </div>

        <div className="demo-playbar__step-progress" aria-hidden="true">
          <div
            className="demo-playbar__step-progress-fill"
            style={{ width: `${Math.round(playback.cueProgress * 100)}%` }}
          />
        </div>

        <button type="button" className="demo-playbar__exit" onClick={onStop} title="Выход (Esc)">
          Выход
        </button>
      </div>
    </div>,
    document.body,
  );
}
