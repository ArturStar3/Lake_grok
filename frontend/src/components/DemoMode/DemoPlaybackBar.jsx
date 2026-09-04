import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DemoBlackout from './DemoBlackout';
import { DEMO_BLACKOUT } from '../../hooks/demo/useDemoPlayer';
import { getToolIcon, getToolLabel } from '../../utils/demoScenario';
import './DemoPlaybackBar.css';

const AUTO_HIDE_MS = 4000;

/**
 * HUD управления показом: переход по этапам, пауза автопрокрутки, прогресс, выход.
 * Скрывается сам, пока мышь не двигается, чтобы не мешать демонстрации.
 *
 * Клавиатура обрабатывается отдельно (useDemoHotkeys) — панель может быть
 * скрыта, а управление стрелками и пультом обязано работать всегда.
 *
 * Полосы прогресса двигаются подпиской на плеер и правкой стиля напрямую:
 * прогресс в состоянии React перерисовывал бы весь экран показа ради
 * нескольких пикселей ширины.
 */
function DemoPlaybackBar({
  playback,
  onToggle,
  onNext,
  onPrev,
  onStop,
  onGoToStage,
  onBlackout,
}) {
  const [visible, setVisible] = useState(true);
  const [stagesOpen, setStagesOpen] = useState(false);
  const hideTimerRef = useRef(null);
  const scenarioFillRef = useRef(null);
  const stageFillRef = useRef(null);

  const isActive = Boolean(playback?.isActive);
  const subscribeProgress = playback?.subscribeProgress;

  useEffect(() => {
    if (!isActive || !subscribeProgress) return undefined;
    let scenarioPainted = -1;
    let stagePainted = -1;
    return subscribeProgress((progress) => {
      const scenario = Math.round(progress.scenarioProgress * 1000);
      if (scenario !== scenarioPainted && scenarioFillRef.current) {
        scenarioPainted = scenario;
        scenarioFillRef.current.style.transform = `scaleX(${scenario / 1000})`;
      }
      const stage = Math.round(progress.stageProgress * 1000);
      if (stage !== stagePainted && stageFillRef.current) {
        stagePainted = stage;
        stageFillRef.current.style.transform = `scaleX(${stage / 1000})`;
      }
    });
  }, [isActive, subscribeProgress]);

  useEffect(() => {
    if (!isActive) return undefined;

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setStagesOpen(false);
      }, AUTO_HIDE_MS);
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
  }, [isActive]);

  useEffect(() => {
    if (!isActive) setStagesOpen(false);
  }, [isActive]);

  if (!isActive) return null;

  const stageLabel = playback.stageTitle
    || playback.stepTitle
    || playback.stepTools.map((tool) => getToolLabel(tool)).join(' + ')
    || 'Этап';

  const waiting = playback.waitingForPresenter;

  return (
    <>
      <DemoBlackout mode={playback.blackout} onDismiss={onBlackout} />
      {createPortal(
        <div className={`demo-playbar${visible ? '' : ' demo-playbar--hidden'}`}>
          <div className="demo-playbar__progress" aria-hidden="true">
            <div
              ref={scenarioFillRef}
              className="demo-playbar__progress-fill"
              style={{ transform: `scaleX(${playback.scenarioProgress})` }}
            />
          </div>

          {stagesOpen && (
            <ul className="demo-playbar__stages">
              {playback.stages.map((stage) => (
                <li key={stage.index}>
                  <button
                    type="button"
                    className={`demo-playbar__stage${stage.index === playback.stageIndex ? ' demo-playbar__stage--active' : ''}`}
                    onClick={() => {
                      onGoToStage?.(stage.index);
                      setStagesOpen(false);
                    }}
                  >
                    <span className="demo-playbar__stage-num">{stage.index + 1}</span>
              <span className="demo-playbar__stage-title">
                      {stage.title
                        || (stage.kind === 'mosaic' ? 'Мультиэкран' : stage.tools.map((tool) => getToolLabel(tool)).join(' + '))}
                    </span>
                    {stage.beatCount > 1 && (
                      <span className="demo-playbar__stage-beats">{stage.beatCount} элем.</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="demo-playbar__row">
            <div className="demo-playbar__controls">
              <button type="button" onClick={onPrev} title="Предыдущий этап (←, PageUp)" aria-label="Предыдущий этап">◀◀</button>
              <button
                type="button"
                className={`demo-playbar__play${waiting ? ' demo-playbar__play--waiting' : ''}`}
                onClick={onNext}
                title="Следующий этап (→, Space, PageDown)"
                aria-label="Следующий этап"
              >
                ▶
              </button>
              <button type="button" onClick={onNext} title="Следующий этап (→, PageDown)" aria-label="Дальше">▶▶</button>
            </div>

            <div className="demo-playbar__info">
              <span className="demo-playbar__scenario">{playback.scenarioTitle}</span>
              <span className="demo-playbar__step">
                <span aria-hidden="true">
                  {playback.kind === 'mosaic' ? '▦' : getToolIcon(playback.stepTools[0])}
                </span>
                {' '}
                {stageLabel}
              </span>
            </div>

            {waiting ? (
              <span className="demo-playbar__waiting">Ждём докладчика · →</span>
            ) : (
              <button
                type="button"
                className="demo-playbar__pause"
                onClick={onToggle}
                title={playback.isPlaying ? 'Пауза автопрокрутки (S)' : 'Продолжить автопрокрутку (S)'}
              >
                {playback.isPlaying ? '❚❚' : '▶'}
              </button>
            )}

            <button
              type="button"
              className="demo-playbar__counter"
              onClick={() => setStagesOpen((open) => !open)}
              title="Перейти к этапу (номер этапа + Enter)"
              aria-expanded={stagesOpen}
            >
              Шаг программы {playback.stageIndex + 1} / {playback.stageCount}
              {playback.beatCount > 1 ? ` · ${playback.beatIndex + 1} из ${playback.beatCount}` : ''}
              {playback.loop ? ' · цикл' : ''}
            </button>

            <div className="demo-playbar__step-progress" aria-hidden="true">
              <div
                ref={stageFillRef}
                className="demo-playbar__step-progress-fill"
                style={{ transform: `scaleX(${playback.stageProgress})` }}
              />
            </div>

            <button
              type="button"
              className="demo-playbar__icon-btn"
              onClick={() => onBlackout?.(DEMO_BLACKOUT.BLACK)}
              title="Затемнить экран (B)"
              aria-label="Затемнить экран"
            >
              ◐
            </button>

            <button type="button" className="demo-playbar__exit" onClick={onStop} title="Выход (Esc)">
              Выход
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default memo(DemoPlaybackBar);
