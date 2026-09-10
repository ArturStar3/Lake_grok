import React, { memo, useMemo } from 'react';
import { Polygon } from 'react-leaflet';
import { getZonePolygonStrokeStyle } from '../../utils/actionZoneStyle';
import { getZonePolygonPositionsList } from '../../utils/inundationZone';
import { applyDemoEffectCssVars } from './demo/eventDemoAnimations';

function geometryKey(geometry) {
  if (!geometry) return 'empty';
  try {
    return JSON.stringify(geometry);
  } catch {
    return 'invalid';
  }
}

export default memo(function SituationPolygon({
  revision,
  situationId,
  onClick,
  extraClassName = '',
  demoEffect = null,
}) {
  const revisionGeometryKey = geometryKey(revision?.geometry);
  const rings = useMemo(
    () => getZonePolygonPositionsList(revision?.geometry),
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
      className: extraClassName ? `situation-polygon ${extraClassName}` : 'situation-polygon',
    };
  }, [revision?.color, extraClassName]);

  const eventHandlers = useMemo(() => ({
    add: (event) => applyDemoEffectCssVars(event.target, demoEffect),
    click: (event) => {
      event.originalEvent?.stopPropagation();
      onClick?.(situationId, revision);
    },
  }), [situationId, revision, onClick, demoEffect]);

  if (!rings?.length || revision?.id == null) return null;

  const layerKey = `${revision.id}-${revisionGeometryKey}`;

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
