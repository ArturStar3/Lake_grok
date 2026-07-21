export default function MapFullscreenZoomControls({ mapRef, defaultCenter, defaultZoom = 4 }) {
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => {
    if (mapRef.current && defaultCenter) {
      mapRef.current.flyTo(defaultCenter, defaultZoom, { duration: 0.8 });
    }
  };

  return (
    <div className="map-fs-zoom-controls">
      <button type="button" className="map-fs-map-btn" onClick={zoomIn} title="Приблизить">+</button>
      <button type="button" className="map-fs-map-btn" onClick={zoomOut} title="Отдалить">−</button>
      <button type="button" className="map-fs-map-btn map-fs-map-btn--reset" onClick={resetView} title="Сбросить вид">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <polyline points="1,4 1,10 7,10" />
          <path d="M3.51 15a9 9 0 1 0 .49-3" />
        </svg>
      </button>
    </div>
  );
}

export function MapFullscreenMeasureBanner({ visible, onCancel }) {
  if (!visible) return null;
  return (
    <div className="map-fs-measure-banner" role="status">
      <span>Режим измерения — Ctrl+клик для постановки точки</span>
      <button type="button" className="map-fs-measure-banner__cancel" onClick={onCancel}>
        Отмена
      </button>
    </div>
  );
}
