import React, { useMemo, memo } from 'react';
import { Polygon } from 'react-leaflet';
import { getZonePolygonStrokeStyle } from '../../utils/actionZoneStyle';
import { getZonePolygonPositions } from '../../utils/inundationZone';
import { getSituationDisplayRevision } from '../../utils/situationUtils';

function SituationPolygon({ revision, situationId, onClick }) {
  const positions = useMemo(
    () => getZonePolygonPositions(revision?.geometry),
    [revision?.geometry],
  );
  if (!positions?.length) return null;

  const style = getZonePolygonStrokeStyle(revision?.color || '#2f80ed', 'solid');
  const pathOptions = {
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    dashArray: style.dashArray,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    className: 'situation-polygon',
  };

  return (
    <Polygon
      positions={positions}
      pathOptions={pathOptions}
      eventHandlers={{
        click: (e) => {
          e.originalEvent?.stopPropagation();
          onClick?.(situationId, revision);
        },
      }}
    />
  );
}

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

  return (
    <>
      {situations
        .filter((item) => selectedSet.has(String(item.id)))
        .map((item) => {
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
