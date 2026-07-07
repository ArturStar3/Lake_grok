import { useCallback, useEffect, useRef, useState } from 'react';
import { validateEventGeometry } from '../../utils/eventGeometry';
import {
  buildRectangleFromCorners,
  drawPointsKey,
  getVertexOnNearestEdge,
  insertVertexOnEdge,
  isNearFirstVertex,
  isSelfIntersecting,
  validatePolygonPoints,
} from '../../utils/polygonDrawUtils';

export const EVENT_DRAW_TOOLS = ['point', 'circle', 'rectangle', 'polygon'];

const DOUBLE_CLICK_MS = 320;

export function useEventDrawing({
  enabled,
  isEditMode = false,
  drawMode: controlledDrawMode = null,
  drawPoints: controlledDrawPoints = [],
  onDrawPointsChange,
}) {
  const [selectedTool, setSelectedTool] = useState(null);
  const [internalPoints, setInternalPoints] = useState([]);
  const [polygonClosed, setPolygonClosed] = useState(false);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const lastClickTimeRef = useRef(0);
  const suppressNextDblClickRef = useRef(false);

  const drawMode = isEditMode ? controlledDrawMode : selectedTool;
  const drawPoints = isEditMode ? controlledDrawPoints : internalPoints;
  const controlledPointsKey = drawPointsKey(controlledDrawPoints);

  const setDrawPoints = useCallback((updater) => {
    if (isEditMode) {
      onDrawPointsChange?.((prev) => (typeof updater === 'function' ? updater(prev) : updater));
      return;
    }
    setInternalPoints((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, [isEditMode, onDrawPointsChange]);

  useEffect(() => {
    if (!isEditMode) return;
    if (controlledDrawMode !== 'polygon') return;

    if (controlledDrawPoints.length >= 3 && validatePolygonPoints(controlledDrawPoints) === null) {
      setPolygonClosed(true);
      setValidationError(null);
      return;
    }

    setPolygonClosed(false);
    if (controlledDrawPoints.length >= 3) {
      setValidationError(validatePolygonPoints(controlledDrawPoints));
    } else {
      setValidationError(null);
    }
  }, [isEditMode, controlledDrawMode, controlledPointsKey, controlledDrawPoints]);

  const clearDraft = useCallback(() => {
    if (!isEditMode) {
      setSelectedTool(null);
      setInternalPoints([]);
    }
    setPolygonClosed(false);
    setPreviewPoint(null);
    setValidationError(null);
    lastClickTimeRef.current = 0;
    suppressNextDblClickRef.current = false;
  }, [isEditMode]);

  const selectTool = useCallback((tool) => {
    if (isEditMode) return;
    setSelectedTool(tool);
    setInternalPoints([]);
    setPolygonClosed(false);
    setPreviewPoint(null);
    setValidationError(null);
    lastClickTimeRef.current = 0;
    suppressNextDblClickRef.current = false;
  }, [isEditMode]);

  const finishPolygon = useCallback(() => {
    if (drawMode !== 'polygon') return false;
    const error = validateEventGeometry('polygon', drawPoints);
    if (error) {
      setValidationError(error);
      return false;
    }
    setPolygonClosed(true);
    setValidationError(null);
    setPreviewPoint(null);
    return true;
  }, [drawMode, drawPoints]);

  const insertVertexAtEdge = useCallback((edgeIndex, latlng) => {
    if (drawMode !== 'polygon' || !polygonClosed) return false;
    const vertex = { lat: latlng.lat, lng: latlng.lng };
    const next = insertVertexOnEdge(drawPoints, edgeIndex, vertex);
    if (isSelfIntersecting(next)) {
      setValidationError('Контур не должен пересекать сам себя');
      return false;
    }
    setDrawPoints(next);
    setValidationError(null);
    return true;
  }, [drawMode, polygonClosed, drawPoints, setDrawPoints]);

  const handleMapDblClick = useCallback((latlng, map) => {
    if (!enabled || drawMode !== 'polygon' || !polygonClosed || !map) return false;

    if (suppressNextDblClickRef.current) {
      suppressNextDblClickRef.current = false;
      return true;
    }

    const hit = getVertexOnNearestEdge(map, latlng, drawPoints);
    if (!hit) return false;

    return insertVertexAtEdge(hit.edgeIndex, hit.vertex);
  }, [enabled, drawMode, polygonClosed, drawPoints, insertVertexAtEdge]);

  const undoLastPoint = useCallback(() => {
    if (drawMode !== 'polygon' || polygonClosed) return;
    setDrawPoints((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
    setValidationError(null);
  }, [drawMode, polygonClosed, setDrawPoints]);

  const removeVertexAt = useCallback((index) => {
    if (drawMode !== 'polygon' || drawPoints.length <= 3) return;
    setDrawPoints((prev) => prev.filter((_, idx) => idx !== index));
    if (polygonClosed && drawPoints.length - 1 < 3) {
      setPolygonClosed(false);
    }
    setValidationError(null);
  }, [drawMode, drawPoints.length, polygonClosed, setDrawPoints]);

  const updatePoint = useCallback((index, latlng) => {
    setDrawPoints((prev) => {
      const next = [...prev];
      next[index] = { lat: latlng.lat, lng: latlng.lng };
      return next;
    });
    if (drawMode === 'polygon' && polygonClosed && drawPoints.length >= 3) {
      const next = [...drawPoints];
      next[index] = { lat: latlng.lat, lng: latlng.lng };
      if (isSelfIntersecting(next)) {
        setValidationError('Контур не должен пересекать сам себя');
      } else {
        setValidationError(null);
      }
    }
  }, [drawMode, drawPoints, polygonClosed, setDrawPoints]);

  const replaceDrawPoints = useCallback((points) => {
    const next = (points || [])
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));

    const nextKey = drawPointsKey(next);
    const currentKey = drawPointsKey(drawPoints);
    if (nextKey === currentKey) {
      return;
    }

    setDrawPoints(next);
    setPreviewPoint(null);

    if (drawMode !== 'polygon') return;

    if (next.length >= 3 && validatePolygonPoints(next) === null) {
      setPolygonClosed(true);
      setValidationError(null);
      return;
    }

    setPolygonClosed(false);
    if (next.length >= 3) {
      setValidationError(validatePolygonPoints(next));
    } else {
      setValidationError(null);
    }
  }, [drawMode, drawPoints, setDrawPoints]);

  const isReady = useCallback(() => {
    if (!drawMode) return false;
    if (drawMode === 'point') return drawPoints.length >= 1;
    if (drawMode === 'circle') return drawPoints.length >= 2;
    if (drawMode === 'rectangle') return drawPoints.length >= 4;
    if (drawMode === 'polygon') return polygonClosed && drawPoints.length >= 3;
    return false;
  }, [drawMode, drawPoints.length, polygonClosed]);

  const validateBeforeSave = useCallback(() => {
    const error = validateEventGeometry(drawMode, drawPoints);
    setValidationError(error);
    return error;
  }, [drawMode, drawPoints]);

  const getHint = useCallback(() => {
    if (!enabled || !drawMode) {
      return 'Выберите тип события и кликните по карте';
    }
    if (drawMode === 'point') {
      return drawPoints.length >= 1
        ? 'Точка установлена. Нажмите «Сохранить».'
        : 'Кликните на карту, чтобы поставить точку';
    }
    if (drawMode === 'circle') {
      if (drawPoints.length === 0) return 'Кликните центр окружности';
      if (drawPoints.length === 1) return 'Кликните второй раз, чтобы задать радиус';
      return 'Окружность готова. Нажмите «Сохранить».';
    }
    if (drawMode === 'rectangle') {
      if (drawPoints.length === 0) return 'Кликните первый угол территории';
      if (drawPoints.length < 4) return 'Кликните противоположный угол';
      return 'Территория готова. Нажмите «Сохранить».';
    }
    if (drawMode === 'polygon') {
      if (polygonClosed) return 'Контур завершён. Двойной клик по ребру — новая вершина.';
      if (drawPoints.length === 0) return 'Клик — вершина. Завершить — кнопка или двойной клик.';
      if (drawPoints.length < 3) return `Вершин: ${drawPoints.length}. Нужно минимум 3.`;
      return `Вершин: ${drawPoints.length}. Завершите контур или кликните по первой вершине.`;
    }
    return '';
  }, [enabled, drawMode, drawPoints.length, polygonClosed]);

  const handleMapClick = useCallback((latlng, map) => {
    if (!enabled || !drawMode) return false;

    const now = Date.now();
    const isDoubleClick = now - lastClickTimeRef.current < DOUBLE_CLICK_MS;
    lastClickTimeRef.current = now;

    const point = { lat: latlng.lat, lng: latlng.lng };

    if (drawMode === 'point') {
      setDrawPoints([point]);
      setPreviewPoint(null);
      setValidationError(null);
      return true;
    }

    if (drawMode === 'circle') {
      if (drawPoints.length === 0) {
        setDrawPoints([point]);
        return true;
      }
      if (drawPoints.length === 1) {
        setDrawPoints([drawPoints[0], point]);
        setPreviewPoint(null);
        setValidationError(null);
        return true;
      }
      return false;
    }

    if (drawMode === 'rectangle') {
      if (drawPoints.length === 0) {
        setDrawPoints([point]);
        return true;
      }
      if (drawPoints.length >= 1 && drawPoints.length < 4) {
        const rect = buildRectangleFromCorners(drawPoints[0], point);
        setDrawPoints(rect);
        setPreviewPoint(null);
        setValidationError(null);
        return true;
      }
      return false;
    }

    if (drawMode === 'polygon') {
      if (polygonClosed) return false;

      if (isDoubleClick && drawPoints.length >= 3) {
        suppressNextDblClickRef.current = true;
        finishPolygon();
        return true;
      }

      if (drawPoints.length >= 3 && isNearFirstVertex(map, point, drawPoints[0])) {
        finishPolygon();
        return true;
      }

      setDrawPoints((prev) => [...prev, point]);
      setValidationError(null);
      return true;
    }

    return false;
  }, [
    enabled,
    drawMode,
    drawPoints,
    polygonClosed,
    setDrawPoints,
    finishPolygon,
  ]);

  const handleMapMove = useCallback((latlng) => {
    if (!enabled || !drawMode) {
      setPreviewPoint(null);
      return;
    }
    if (drawMode === 'circle' && drawPoints.length === 1) {
      setPreviewPoint({ lat: latlng.lat, lng: latlng.lng });
      return;
    }
    if (drawMode === 'rectangle' && drawPoints.length === 1) {
      setPreviewPoint({ lat: latlng.lat, lng: latlng.lng });
      return;
    }
    if (drawMode === 'polygon' && !polygonClosed) {
      setPreviewPoint({ lat: latlng.lat, lng: latlng.lng });
      return;
    }
    setPreviewPoint(null);
  }, [enabled, drawMode, drawPoints.length, polygonClosed]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (!isEditMode) clearDraft();
        return;
      }
      if (event.key === 'Backspace' && drawMode === 'polygon' && !polygonClosed) {
        event.preventDefault();
        undoLastPoint();
      }
      if (event.key === 'Enter' && drawMode === 'polygon' && !polygonClosed) {
        finishPolygon();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    isEditMode,
    clearDraft,
    drawMode,
    polygonClosed,
    undoLastPoint,
    finishPolygon,
  ]);

  const previewRectangle = (
    drawMode === 'rectangle'
    && drawPoints.length === 1
    && previewPoint
  )
    ? buildRectangleFromCorners(drawPoints[0], previewPoint)
    : null;

  const previewPolygonPositions = (() => {
    if (drawMode !== 'polygon' || polygonClosed || !previewPoint) return null;
    if (drawPoints.length === 0) return null;
    return [...drawPoints, previewPoint];
  })();

  return {
    drawMode,
    drawPoints,
    selectedTool,
    polygonClosed,
    previewPoint,
    previewRectangle,
    previewPolygonPositions,
    validationError,
    selectTool,
    clearDraft,
    finishPolygon,
    undoLastPoint,
    removeVertexAt,
    updatePoint,
    replaceDrawPoints,
    insertVertexAtEdge,
    handleMapClick,
    handleMapDblClick,
    handleMapMove,
    isReady,
    validateBeforeSave,
    getHint,
    setValidationError,
  };
}
