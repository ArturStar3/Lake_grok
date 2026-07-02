import { useCallback, useMemo, useState } from 'react';
import { calcDistanceMeters } from '../../utils/geoUtils';

export function useMeasurePoints() {
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

  const measurements = useMemo(
    () =>
      measurePoints.map((point, idx) => {
        if (idx === 0) {
          return { ...point, index: idx + 1, distance: 0 };
        }
        const prev = measurePoints[idx - 1];
        return { ...point, index: idx + 1, distance: calcDistanceMeters(prev, point) };
      }),
    [measurePoints],
  );

  const toggleMeasureMode = useCallback(() => {
    setIsMeasureMode((prev) => {
      const next = !prev;
      if (!next) setMeasurePoints([]);
      return next;
    });
  }, []);

  const addMeasurePoint = useCallback(({ lat, lng }) => {
    setMeasurePoints((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, lat, lng },
    ]);
  }, []);

  const removeMeasurePoint = useCallback((id) => {
    setMeasurePoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    isMeasureMode,
    setIsMeasureMode,
    measurePoints,
    setMeasurePoints,
    measurements,
    toggleMeasureMode,
    addMeasurePoint,
    removeMeasurePoint,
  };
}
