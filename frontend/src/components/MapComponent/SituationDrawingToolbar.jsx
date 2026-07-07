import { useState } from 'react';
import PolygonCoordinateEditor from '../common/PolygonCoordinateEditor/PolygonCoordinateEditor';
import './SituationDrawingToolbar.css';

export default function SituationDrawingToolbar({
  visible,
  hint,
  validationError,
  polygonClosed,
  canFinishPolygon,
  canUndoPoint,
  isReady,
  polygonCoordPoints = [],
  onPolygonCoordChange,
  polygonCoordError = null,
  onFinishPolygon,
  onUndoPoint,
  onConfirm,
  onCancel,
}) {
  const [coordsExpanded, setCoordsExpanded] = useState(true);

  if (!visible) return null;

  return (
    <div className="situation-draw-toolbar">
      <div className="situation-draw-toolbar__row">
        <span className="situation-draw-toolbar__title">Рисование обстановки</span>
        <div className="situation-draw-toolbar__actions">
          {canUndoPoint && (
            <button type="button" className="situation-draw-toolbar__btn" onClick={onUndoPoint}>
              Отменить точку
            </button>
          )}
          {!polygonClosed && (
            <button
              type="button"
              className="situation-draw-toolbar__btn"
              onClick={onFinishPolygon}
              disabled={!canFinishPolygon}
            >
              Завершить контур
            </button>
          )}
          <button
            type="button"
            className="situation-draw-toolbar__btn situation-draw-toolbar__btn--primary"
            onClick={onConfirm}
            disabled={!isReady}
          >
            Далее
          </button>
          <button type="button" className="situation-draw-toolbar__btn" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
      {hint && <p className="situation-draw-toolbar__hint">{hint}</p>}
      {validationError && <p className="situation-draw-toolbar__error">{validationError}</p>}
      <div className="situation-draw-toolbar__coords">
        <button
          type="button"
          className="situation-draw-toolbar__btn"
          onClick={() => setCoordsExpanded((prev) => !prev)}
        >
          {coordsExpanded ? 'Скрыть координаты' : 'Координаты контура'}
        </button>
        {coordsExpanded && onPolygonCoordChange && (
          <PolygonCoordinateEditor
            points={polygonCoordPoints}
            onChange={onPolygonCoordChange}
            error={polygonCoordError}
          />
        )}
      </div>
    </div>
  );
}
