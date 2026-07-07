import './EventDrawingToolbar.css';

const TOOLS = [
  { id: 'point', label: 'Точка', icon: 'event-point' },
  { id: 'circle', label: 'Окружность', icon: 'event-circle' },
  { id: 'rectangle', label: 'Территория', icon: 'event-rectangle' },
  { id: 'polygon', label: 'Произвольная форма', icon: 'event-polygon' },
];

function ToolbarIcon({ name, size = 20 }) {
  return (
    <svg className="map__event-toolbar-icon" width={size} height={size} aria-hidden="true">
      <use href={`/sprite.svg#${name}`} />
    </svg>
  );
}

export default function EventDrawingToolbar({
  visible,
  isEditMode = false,
  activeTool,
  drawMode,
  hint,
  validationError,
  polygonClosed,
  canFinishPolygon,
  canUndoPoint,
  isReady,
  onSelectTool,
  onFinishPolygon,
  onUndoPoint,
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;

  const currentTool = activeTool || drawMode;
  const showPolygonActions = drawMode === 'polygon' && !polygonClosed;

  return (
    <div className="map__event-toolbar" role="toolbar" aria-label="Инструменты событий">
      <div className="map__event-toolbar-row">
        <div className="map__event-toolbar-tools">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`map__event-toolbar-btn${currentTool === tool.id ? ' map__event-toolbar-btn--active' : ''}`}
              title={tool.label}
              aria-label={tool.label}
              disabled={isEditMode}
              onClick={() => onSelectTool?.(tool.id)}
            >
              <ToolbarIcon name={tool.icon} />
            </button>
          ))}
        </div>

        <div className="map__event-toolbar-actions">
          {showPolygonActions && (
            <>
              <button
                type="button"
                className="map__event-toolbar-action map__event-toolbar-action--icon"
                title="Отменить точку"
                aria-label="Отменить точку"
                onClick={onUndoPoint}
                disabled={!canUndoPoint}
              >
                <ToolbarIcon name="event-undo" />
              </button>
              <button
                type="button"
                className="map__event-toolbar-action map__event-toolbar-action--primary map__event-toolbar-action--icon"
                title="Завершить"
                aria-label="Завершить"
                onClick={onFinishPolygon}
                disabled={!canFinishPolygon}
              >
                <ToolbarIcon name="event-finish" />
              </button>
            </>
          )}
          {!isEditMode && (
            <>
              <button
                type="button"
                className="map__event-toolbar-action map__event-toolbar-action--confirm map__event-toolbar-action--icon"
                title="Сохранить"
                onClick={onConfirm}
                disabled={!isReady}
                aria-label="Сохранить событие"
              >
                <ToolbarIcon name="event-save" />
              </button>
              <button
                type="button"
                className="map__event-toolbar-action map__event-toolbar-action--cancel map__event-toolbar-action--icon"
                title="Отмена"
                onClick={onCancel}
                aria-label="Отмена"
              >
                <ToolbarIcon name="event-cancel" />
              </button>
            </>
          )}
        </div>
      </div>

      <p className="map__event-toolbar-hint">{hint}</p>

      {validationError && (
        <p className="map__event-toolbar-error" role="alert">{validationError}</p>
      )}
    </div>
  );
}
