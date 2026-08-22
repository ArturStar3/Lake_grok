import { useMemo } from 'react';
import {
  buildScenarioTimeline,
  formatDurationMs,
  getToolIcon,
  getToolLabel,
} from '../../utils/demoScenario';

/**
 * Временная шкала сценария: показывает, когда стартует каждый шаг
 * и сколько длится весь показ (аналог области анимации PowerPoint).
 */
export default function DemoTimeline({ steps = [], activeIndex = 0, onSelectStep }) {
  const { segments, totalMs } = useMemo(() => buildScenarioTimeline(steps), [steps]);

  if (!segments.length) {
    return (
      <div className="demo-timeline demo-timeline--empty">
        Добавьте шаги — здесь появится временная шкала показа.
      </div>
    );
  }

  return (
    <div className="demo-timeline">
      <div className="demo-timeline__head">
        <span className="demo-timeline__title">Временная шкала</span>
        <span className="demo-timeline__total">Всего: {formatDurationMs(totalMs)}</span>
      </div>
      <div className="demo-timeline__track">
        {segments.map((segment) => {
          const left = totalMs ? (segment.startMs / totalMs) * 100 : 0;
          const width = totalMs
            ? Math.max(1.5, ((segment.endMs - segment.startMs) / totalMs) * 100)
            : 100;
          const isActive = segment.index === activeIndex;
          return (
            <button
              type="button"
              key={segment.step.key}
              className={`demo-timeline__bar${isActive ? ' demo-timeline__bar--active' : ''}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onSelectStep?.(segment.index)}
              title={`${segment.index + 1}. ${segment.step.title || getToolLabel(segment.step.tool)} — ${formatDurationMs(segment.step.duration_ms)}`}
            >
              <span className="demo-timeline__bar-icon">{getToolIcon(segment.step.tool)}</span>
              <span className="demo-timeline__bar-label">
                {segment.step.title || getToolLabel(segment.step.tool)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="demo-timeline__scale">
        <span>0 с</span>
        <span>{formatDurationMs(totalMs / 2)}</span>
        <span>{formatDurationMs(totalMs)}</span>
      </div>
    </div>
  );
}
