import React from 'react';
import './InundationDrawBanner.css';

export default function InundationDrawBanner({
  hint,
  validationError,
  polygonClosed,
  canFinishPolygon,
  canUndoPoint,
  isReady,
  onFinishPolygon,
  onUndoPoint,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="inundation-draw-banner" role="toolbar" aria-label="Рисование зоны затопления">
      <div className="inundation-draw-banner__content">
        <span className="inundation-draw-banner__title">Зона затопления</span>
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
  );
}
