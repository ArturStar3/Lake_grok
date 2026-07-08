import React, { useMemo, memo } from 'react';
import { Polygon } from 'react-leaflet';
import { getZonePolygonStrokeStyle } from '../../utils/actionZoneStyle';
import { getZonePolygonPositions } from '../../utils/inundationZone';
import { getSituationDisplayRevision } from '../../utils/situationUtils';

const SituationPolygon = memo(function SituationPolygon({ revision, situationId, onClick }) {
  const positions = useMemo(
    () => getZonePolygonPositions(revision?.geometry),
    [revision?.geometry],
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
  }, [revision?.color]);

  const eventHandlers = useMemo(() => ({
    click: (e) => {
      e.originalEvent?.stopPropagation();
      onClick?.(situationId, revision);
    },
  }), [situationId, revision, onClick]);

  if (!positions?.length) return null;

  return (
    <Polygon
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    />
  );
});

export default memo(function OperationalSituationLayer({
  situations = [],
  selectedSituationIds = [],
  previewRevision = null,
  editingSituationId = null,
  onSituationClick,
}) {
  const selectedSet = useMemo(
    () => new Set(selectedSituationIds.map(String)),
    [selectedSituationIds],
  );

  const previewSituationId = previewRevision?.situation_id || previewRevision?.situation?.id || null;
  const previewIsSelected = previewSituationId != null
    && selectedSet.has(String(previewSituationId));

  const visibleSituations = useMemo(
    () => situations.filter((item) => selectedSet.has(String(item.id))),
    [situations, selectedSet],
  );

  return (
    <>
      {visibleSituations.map((item) => {
        if (editingSituationId && String(item.id) === String(editingSituationId)) return null;

        const usePreview = previewIsSelected && String(item.id) === String(previewSituationId);
        const rev = usePreview ? previewRevision : getSituationDisplayRevision(item);
        if (!rev) return null;

        return (
          <SituationPolygon
            key={usePreview ? `preview-${previewRevision.id}` : item.id}
            situationId={item.id}
            revision={rev}
            onClick={onSituationClick}
          />
        );
      })}
    </>
  );
});
