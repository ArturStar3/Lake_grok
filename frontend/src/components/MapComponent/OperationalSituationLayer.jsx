import React, { useMemo, memo } from 'react';
import { Polygon } from 'react-leaflet';
import { getZonePolygonStrokeStyle } from '../../utils/actionZoneStyle';
import { getZonePolygonPositionsList } from '../../utils/inundationZone';
import { resolveSituationMapRevision } from '../../utils/situationUtils';

function geometryKey(geometry) {
  if (!geometry) return 'empty';
  try {
    return JSON.stringify(geometry);
  } catch {
    return 'invalid';
  }
}

const SituationPolygon = memo(function SituationPolygon({ revision, situationId, onClick }) {
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
      className: 'situation-polygon',
    };
  }, [revision?.id, revision?.color]);

  const eventHandlers = useMemo(() => ({
    click: (e) => {
      e.originalEvent?.stopPropagation();
      onClick?.(situationId, revision);
    },
  }), [situationId, revision, onClick]);

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
          />
        );
      })}
    </>
  );
});
