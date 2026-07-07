import React, { useState } from 'react';
import PolygonCoordinateEditor from '../common/PolygonCoordinateEditor/PolygonCoordinateEditor';
import './InundationDrawBanner.css';

export default function InundationDrawBanner({
  title = 'Полигон зоны',
  hint,
  validationError,
  polygonClosed: _polygonClosed,
  canFinishPolygon,
  canUndoPoint,
  isReady,
  onFinishPolygon,
  onUndoPoint,
  onConfirm,
  onCancel,
  polygonCoordPoints = [],
  onPolygonCoordChange,
  polygonCoordError = null,
}) {
  const [coordsExpanded, setCoordsExpanded] = useState(true);

  return (
    <div className="inundation-draw-banner-wrap">
      <div className="inundation-draw-banner" role="toolbar" aria-label={title}>
        <div className="inundation-draw-banner__content">
          <span className="inundation-draw-banner__title">{title}</span>
          <span className="inundation-draw-banner__hint">{hint}</span>
          {validationError && (
            <span className="inundation-draw-banner__error">{validationError}</span>
          )}
        </div>
        <div className="inundation-draw-banner__actions">
          {canUndoPoint && (
            <button type="button" className="inundation-draw-banner__btn" onClick={onUndoPoint}>
              Отменить точку
            </button>
          )}
          {canFinishPolygon && (
            <button type="button" className="inundation-draw-banner__btn" onClick={onFinishPolygon}>
              Завершить контур
            </button>
          )}
          <button
            type="button"
            className="inundation-draw-banner__btn inundation-draw-banner__btn--primary"
            onClick={onConfirm}
            disabled={!isReady}
          >
            Сохранить полигон
          </button>
          <button type="button" className="inundation-draw-banner__btn" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>

      <div className="inundation-draw-banner__coords-panel">
        <button
          type="button"
          className="inundation-draw-banner__coords-toggle"
          onClick={() => setCoordsExpanded((prev) => !prev)}
          aria-expanded={coordsExpanded}
        >
          Координаты {coordsExpanded ? '▾' : '▸'}
        </button>
        {coordsExpanded && (
          <div className="inundation-draw-banner__coords-editor">
            <PolygonCoordinateEditor
              points={polygonCoordPoints}
              onChange={onPolygonCoordChange}
              error={polygonCoordError}
              hint="Можно задать контур вручную или на карте"
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
