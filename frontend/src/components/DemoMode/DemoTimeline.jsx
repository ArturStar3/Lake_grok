import { useMemo } from 'react';
import {
  DEMO_SEQUENCE_TYPE,
  buildProgramPlayback,
  formatDurationMs,
} from '../../utils/demoScenario';

/**
 * Временная шкала программы показа: блоки этапов и мультиэкрана.
 */
export default function DemoTimeline({
  program: programProp = null,
  scenario = null,
  activeIndex = 0,
  onSelectItem,
}) {
  const program = useMemo(
    () => programProp || buildProgramPlayback(scenario || {}),
    [programProp, scenario],
  );
  const { items, totalMs } = program;

  if (!items.length) {
    return (
      <div className="demo-timeline demo-timeline--empty">
        Добавьте блоки в программу — здесь появится временная шкала показа.
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
        {items.map((item) => {
          const left = totalMs ? (item.startMs / totalMs) * 100 : 0;
          const width = totalMs
            ? Math.max(2.5, ((item.endMs - item.startMs) / totalMs) * 100)
            : 100;
          const isActive = item.index === activeIndex;
          const mosaic = item.kind === DEMO_SEQUENCE_TYPE.MOSAIC;
          return (
            <button
              type="button"
              key={item.item.key || item.index}
              className={`demo-timeline__bar${isActive ? ' demo-timeline__bar--active' : ''}${mosaic ? ' demo-timeline__bar--slot-a' : ''}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => onSelectItem?.(item.index)}
              title={`${item.index + 1}. ${item.title} — ${formatDurationMs(item.endMs - item.startMs)}`}
            >
              <span className="demo-timeline__bar-icon">{mosaic ? '▦' : '▶'}</span>
              <span className="demo-timeline__bar-label">{item.title}</span>
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
