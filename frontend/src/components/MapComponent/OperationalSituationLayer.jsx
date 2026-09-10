import React, { useMemo, memo } from 'react';
import { filterRevisionsForSituation, resolveSituationMapRevision } from '../../utils/situationUtils';
import { DEMO_EFFECT } from '../../utils/demoScenario';
import { resolveSituationDemoEffect } from './demo/eventDemoAnimations';
import SituationPolygon from './SituationPolygon';
import SituationStateCycleLayer from './demo/SituationStateCycleLayer';
import SituationStateOverlayLayer from './demo/SituationStateOverlayLayer';

function geometryKey(geometry) {
  if (!geometry) return 'empty';
  try {
    return JSON.stringify(geometry);
  } catch {
    return 'invalid';
  }
}

export default memo(function OperationalSituationLayer({
  situations = [],
  selectedSituationIds = [],
  activeSituationId = null,
  timelineRevisionId = null,
  situationRevisions = [],
  editingSituationId = null,
  onSituationClick,
  onDemoRevisionChange,
  demoAnimation = null,
}) {
  const selectedSet = useMemo(
    () => new Set(selectedSituationIds.map(String)),
    [selectedSituationIds],
  );

  const visibleSituations = useMemo(
    () => situations.filter((item) => selectedSet.has(String(item.id))),
    [situations, selectedSet],
  );

  return (
    <>
      {visibleSituations.map((item) => {
        if (editingSituationId && String(item.id) === String(editingSituationId)) return null;

        const demoEffect = resolveSituationDemoEffect(item.id, demoAnimation);
        if (demoEffect?.effect === DEMO_EFFECT.STATE_CYCLE) {
          const cycleRevisions = filterRevisionsForSituation(situationRevisions, item.id);
          if (cycleRevisions.length > 1) {
            return (
              <SituationStateCycleLayer
                key={`${item.id}-cycle-${demoEffect.runId}`}
                situationId={item.id}
                revisions={cycleRevisions}
                perStateMs={demoEffect.perStateMs}
                crossFadeMs={demoEffect.crossFadeMs}
                order={demoEffect.order}
                continuous={demoEffect.continuous}
                repeat={demoEffect.repeat}
                runId={demoEffect.runId}
                onSituationClick={onSituationClick}
                onRevisionChange={onDemoRevisionChange}
              />
            );
          }
        }
        if (demoEffect?.effect === DEMO_EFFECT.STATE_OVERLAY) {
          const overlayRevisions = filterRevisionsForSituation(situationRevisions, item.id);
          if (overlayRevisions.length > 1) {
            return (
              <SituationStateOverlayLayer
                key={`${item.id}-overlay-${demoEffect.runId}`}
                situationId={item.id}
                revisions={overlayRevisions}
                perStateMs={demoEffect.perStateMs}
                fadeInMs={demoEffect.crossFadeMs}
                order={demoEffect.order}
                continuous={demoEffect.continuous}
                repeat={demoEffect.repeat}
                runId={demoEffect.runId}
                onSituationClick={onSituationClick}
                onRevisionChange={onDemoRevisionChange}
              />
            );
          }
        }

        const rev = resolveSituationMapRevision(item, {
          activeSituationId,
          timelineRevisionId,
          revisions: situationRevisions,
        });
        if (!rev) return null;

        return (
          <SituationPolygon
            key={`${item.id}-${rev.id}-${geometryKey(rev.geometry)}-${demoEffect?.runId ?? 0}-${demoEffect?.repeat ?? 0}`}
            situationId={item.id}
            revision={rev}
            onClick={onSituationClick}
            extraClassName={[
              demoEffect?.effect === DEMO_EFFECT.FADE_IN ? 'demo-fade-in' : '',
              demoEffect?.effect === DEMO_EFFECT.FADE_IN
                ? (demoEffect.continuous ? 'demo-anim--continuous' : 'demo-anim--once')
                : '',
            ].filter(Boolean).join(' ')}
            demoEffect={demoEffect}
          />
        );
      })}
    </>
  );
});
