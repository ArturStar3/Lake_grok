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
