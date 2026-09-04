import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeatureGroup, Polygon, useMap } from 'react-leaflet';
import { getZonePolygonStrokeStyle } from '../../../utils/actionZoneStyle';
import { getZonePolygonPositionsList } from '../../../utils/inundationZone';
import { registerDemoAnimation, unregisterDemoAnimation } from './demoRafDriver';

function buildPathOptions(revision) {
  const style = getZonePolygonStrokeStyle(revision?.color || '#2f80ed', 'solid');
  return {
    color: style.color,
    weight: style.weight,
    opacity: style.opacity,
    dashArray: style.dashArray,
    fillColor: style.fillColor,
    fillOpacity: style.fillOpacity,
    className: 'situation-polygon situation-polygon--demo',
  };
}

/**
 * Одно состояние обстановки как группа контуров с управляемой прозрачностью.
 * Прозрачность меняется напрямую через Leaflet (`setStyle`), без ре-рендера React,
 * иначе кросс-фейд заставлял бы перерисовываться весь слой десятки раз в секунду.
 */
const CrossFadeState = memo(function CrossFadeState({
  revision,
  situationId,
  onClick,
  phase,
  crossFadeMs,
  cycleTick,
  onFadeOutDone,
}) {
  const groupRef = useRef(null);
  const map = useMap();
  const pathOptions = useMemo(() => buildPathOptions(revision), [revision?.id, revision?.color]);
  const rings = useMemo(
    () => getZonePolygonPositionsList(revision?.geometry),
    [revision?.geometry],
  );

  const eventHandlers = useMemo(() => ({
    click: (e) => {
      e.originalEvent?.stopPropagation();
      onClick?.(situationId, revision);
    },
  }), [situationId, revision, onClick]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;

    const applyFactor = (factor) => {
      group.setStyle({
        opacity: pathOptions.opacity * factor,
        fillOpacity: pathOptions.fillOpacity * factor,
      });
    };

    if (!crossFadeMs) {
      applyFactor(phase === 'out' ? 0 : 1);
      if (phase === 'out') onFadeOutDone?.();
      return undefined;
    }

    const key = `situation-fade:${situationId}:${revision?.id}:${phase}:${cycleTick}`;
    applyFactor(phase === 'in' ? 0 : 1);

    let done = false;
    registerDemoAnimation(key, {
      map,
      update: (elapsed) => {
        if (done) return;
        const progress = Math.min(1, elapsed / crossFadeMs);
        applyFactor(phase === 'in' ? progress : 1 - progress);
        if (progress >= 1) {
          done = true;
          unregisterDemoAnimation(key, map);
          if (phase === 'out') onFadeOutDone?.();
        }
      },
    });

    return () => unregisterDemoAnimation(key, map);
  }, [crossFadeMs, cycleTick, map, onFadeOutDone, pathOptions, phase, revision?.id, situationId]);

  if (!rings.length || revision?.id == null) return null;

  return (
    <FeatureGroup ref={groupRef} eventHandlers={eventHandlers}>
      {rings.map((positions, ringIndex) => (
        <Polygon
          key={`${revision.id}-${phase}-${ringIndex}`}
          positions={positions}
          pathOptions={pathOptions}
        />
      ))}
    </FeatureGroup>
  );
});

/**
 * Зацикленный показ состояний обстановки с плавным замещением:
 * уходящее состояние растворяется, входящее одновременно проявляется.
 */
export default function SituationStateCycleLayer({
  situationId,
  revisions = [],
  perStateMs = 1800,
  crossFadeMs = 600,
  order = 'old_to_new',
  continuous = true,
  runId = 0,
  onSituationClick,
  onRevisionChange,
}) {
  const ordered = useMemo(() => {
    const sorted = [...revisions].sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
    return order === 'new_to_old' ? sorted.reverse() : sorted;
  }, [revisions, order]);

  const [index, setIndex] = useState(0);
  const [outgoing, setOutgoing] = useState(null);
  const [cycleTick, setCycleTick] = useState(0);

  useEffect(() => {
    setIndex(0);
    setOutgoing(null);
    setCycleTick(0);
  }, [runId, situationId, ordered.length]);

  useEffect(() => {
    if (ordered.length < 2 || !perStateMs) return undefined;
    const timer = setInterval(() => {
      setIndex((prev) => {
        if (!continuous && prev >= ordered.length - 1) {
          return prev;
        }
        const nextIndex = continuous
          ? (prev + 1) % ordered.length
          : Math.min(prev + 1, ordered.length - 1);
        if (nextIndex === prev) return prev;
        setOutgoing(prev);
        setCycleTick((tick) => tick + 1);
        return nextIndex;
      });
    }, perStateMs);
    return () => clearInterval(timer);
  }, [continuous, ordered.length, perStateMs]);

  useEffect(() => {
    const current = ordered[index];
    if (current?.id != null) onRevisionChange?.(situationId, current.id);
  }, [index, ordered, situationId, onRevisionChange]);

  const handleFadeOutDone = useCallback(() => setOutgoing(null), []);

  const current = ordered[index];
  const previous = outgoing != null ? ordered[outgoing] : null;
  const showOutgoing = previous && previous.id !== current?.id;

  if (!current) return null;

  return (
    <>
      {showOutgoing && (
        <CrossFadeState
          key={`out-${previous.id}-${cycleTick}`}
          revision={previous}
          situationId={situationId}
          onClick={onSituationClick}
          phase="out"
          crossFadeMs={crossFadeMs}
          cycleTick={cycleTick}
          onFadeOutDone={handleFadeOutDone}
        />
      )}
      <CrossFadeState
        key={`in-${current.id}-${cycleTick}`}
        revision={current}
        situationId={situationId}
        onClick={onSituationClick}
        phase="in"
        crossFadeMs={crossFadeMs}
        cycleTick={cycleTick}
      />
    </>
  );
}
