import React, { useMemo, memo } from 'react';
import { Polygon } from 'react-leaflet';
import { getZonePolygonStrokeStyle } from '../../utils/actionZoneStyle';
import { getZonePolygonPositionsList } from '../../utils/inundationZone';
import { filterRevisionsForSituation, resolveSituationMapRevision } from '../../utils/situationUtils';
import { DEMO_EFFECT } from '../../utils/demoScenario';
import { applyDemoEffectCssVars, resolveSituationDemoEffect } from './demo/eventDemoAnimations';
import SituationStateCycleLayer from './demo/SituationStateCycleLayer';

function geometryKey(geometry) {
  if (!geometry) return 'empty';
  try {
    return JSON.stringify(geometry);
  } catch {
    return 'invalid';
  }
}

const SituationPolygon = memo(function SituationPolygon({ revision, situationId, onClick, extraClassName = '', demoEffect = null }) {
  const revisionGeometryKey = geometryKey(revision?.geometry);
  const rings = useMemo(
    () => getZonePolygonPositionsList(revision?.geometry),
    [revision?.geometry, revision?.id, revisionGeometryKey],
  );

  const pathOptions = useMemo(() => {
    const style = getZonePolygonStrokeStyle(revision?.color || '#2f80ed', 'solid');
    return {
      color: style.color,
      weight: style.weight,
      opacity: style.opacity,
      dashArray: style.dashArray,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      className: extraClassName ? `situation-polygon ${extraClassName}` : 'situation-polygon',
    };
  }, [revision?.id, revision?.color, extraClassName]);

  const eventHandlers = useMemo(() => ({
    add: (e) => applyDemoEffectCssVars(e.target, demoEffect),
    click: (e) => {
      e.originalEvent?.stopPropagation();
      onClick?.(situationId, revision);
    },
  }), [situationId, revision, onClick, demoEffect]);

  if (!rings?.length || revision?.id == null) return null;

  const layerKey = `${revision.id}-${geometryKey(revision.geometry)}`;

  return (
    <>
      {rings.map((positions, ringIndex) => (
        <Polygon
          key={`${layerKey}-${ringIndex}`}
          positions={positions}
          pathOptions={pathOptions}
          eventHandlers={eventHandlers}
        />
      ))}
    </>
  );
});

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
            key={`${item.id}-${rev.id}-${geometryKey(rev.geometry)}`}
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
