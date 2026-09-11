import React, { memo, useEffect, useMemo, useState } from 'react';
import SituationPolygon from '../SituationPolygon';
import { sortRevisionsBySituationDateTime } from '../../../utils/situationUtils';
import { demoRepeatCount } from './demoEffectCache';

/**
 * Накопительно показывает состояния одной оперативной обстановки:
 * новое состояние проявляется поверх уже показанных, поэтому изменения геометрии
 * остаются видны одновременно. В непрерывном режиме последовательность повторяется.
 */
export default memo(function SituationStateOverlayLayer({
  situationId,
  revisions = [],
  perStateMs = 1800,
  fadeInMs = 600,
  order = 'old_to_new',
  continuous = false,
  repeat = 1,
  runId = 0,
  onSituationClick,
  onRevisionChange,
}) {
  const ordered = useMemo(() => {
    return sortRevisionsBySituationDateTime(
      revisions,
      order === 'new_to_old' ? 'desc' : 'asc',
    );
  }, [revisions, order]);
  const revisionKey = useMemo(
    () => ordered.map((revision) => String(revision?.id ?? '')).join('|'),
    [ordered],
  );
  const [visibleCount, setVisibleCount] = useState(1);
  const [completedRuns, setCompletedRuns] = useState(0);
  const repeatCount = demoRepeatCount(repeat);

  useEffect(() => {
    setVisibleCount(1);
    setCompletedRuns(0);
  }, [continuous, repeatCount, runId, situationId, revisionKey]);

  useEffect(() => {
    if (ordered.length < 2 || !perStateMs) return undefined;
    const atFinalState = visibleCount >= ordered.length;
    if (!continuous && atFinalState && completedRuns + 1 >= repeatCount) return undefined;

    const timer = setTimeout(() => {
      if (atFinalState) {
        if (!continuous) setCompletedRuns((count) => count + 1);
        setVisibleCount(1);
      } else {
        setVisibleCount((current) => Math.min(current + 1, ordered.length));
      }
    }, perStateMs);
    return () => clearTimeout(timer);
  }, [completedRuns, continuous, ordered.length, perStateMs, repeatCount, visibleCount]);

  useEffect(() => {
    const current = ordered[Math.min(visibleCount, ordered.length) - 1];
    if (current?.id != null) onRevisionChange?.(situationId, current.id);
  }, [onRevisionChange, ordered, situationId, visibleCount]);

  if (!ordered.length) return null;

  return (
    <>
      {ordered.slice(0, visibleCount).map((revision) => (
        <SituationPolygon
          key={`${runId}-${revision.id}`}
          situationId={situationId}
          revision={revision}
          onClick={onSituationClick}
          extraClassName={fadeInMs > 0
            ? 'situation-polygon--demo-overlay demo-fade-in demo-anim--once'
            : 'situation-polygon--demo-overlay'}
          demoEffect={fadeInMs > 0 ? { durationMs: fadeInMs } : null}
        />
      ))}
    </>
  );
});
