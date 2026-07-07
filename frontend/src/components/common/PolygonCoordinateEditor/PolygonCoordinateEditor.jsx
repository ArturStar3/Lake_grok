import { useMemo } from 'react';
import { validateCoordRanges } from '../../../utils/polygonDrawUtils';
import './PolygonCoordinateEditor.css';

export default function PolygonCoordinateEditor({
  points = [],
  onChange,
  minPoints = 3,
  disabled = false,
  error = null,
  title = 'Координаты',
  hint = null,
  compact = false,
  showAddButton = true,
  showRemoveButton = true,
}) {
  const fieldErrors = useMemo(() => {
    return points.map((point) => {
      if (point.lat === '' && point.lng === '') return null;
      return validateCoordRanges(point);
    });
  }, [points]);

  const handlePointChange = (index, field, value) => {
    const next = points.map((point, i) => (
      i === index ? { ...point, [field]: value } : point
    ));
    onChange?.(next);
  };

  const handleAddPoint = () => {
    onChange?.([...points, { lat: '', lng: '' }]);
  };

  const handleRemovePoint = (index) => {
    if (points.length <= minPoints) return;
    onChange?.(points.filter((_, i) => i !== index));
  };

  return (
    <div className={`polygon-coord-editor${compact ? ' polygon-coord-editor--compact' : ''}`}>
      {title && <div className="polygon-coord-editor__title">{title}</div>}
      {hint && <div className="polygon-coord-editor__hint">{hint}</div>}
      {error && <div className="polygon-coord-editor__error">{error}</div>}

      <div className="polygon-coord-editor__points">
        {points.map((point, index) => (
          <div key={`polygon-point-${index}`} className="polygon-coord-editor__point">
            <div className="polygon-coord-editor__point-header">
              <span className="polygon-coord-editor__point-label">Точка {index + 1}</span>
              {showRemoveButton && (
                <button
                  type="button"
                  className="polygon-coord-editor__remove-btn"
                  onClick={() => handleRemovePoint(index)}
                  disabled={disabled || points.length <= minPoints}
                  aria-label={`Удалить точку ${index + 1}`}
                  title="Удалить точку"
                >
                  ×
                </button>
              )}
            </div>
            <div className="polygon-coord-editor__point-inputs">
              <input
                type="number"
                step="0.000001"
                value={point.lat}
                onChange={(e) => handlePointChange(index, 'lat', e.target.value)}
                className={`polygon-coord-editor__input${fieldErrors[index] ? ' polygon-coord-editor__input--error' : ''}`}
                placeholder="Широта"
                disabled={disabled}
              />
              <input
                type="number"
                step="0.000001"
                value={point.lng}
                onChange={(e) => handlePointChange(index, 'lng', e.target.value)}
                className={`polygon-coord-editor__input${fieldErrors[index] ? ' polygon-coord-editor__input--error' : ''}`}
                placeholder="Долгота"
                disabled={disabled}
              />
            </div>
          </div>
        ))}
      </div>

      {showAddButton && (
        <button
          type="button"
          className="polygon-coord-editor__add-btn"
          onClick={handleAddPoint}
          disabled={disabled}
        >
          + Добавить точку
        </button>
      )}
    </div>
  );
}
