import DismissibleBanner from '../common/DismissibleBanner/DismissibleBanner';

export function MapFullscreenMeasureBanner({ visible, onCancel }) {
  if (!visible) return null;
  return (
    <DismissibleBanner
      className="map-fs-measure-banner"
      variant="info"
      role="status"
      message="Режим измерения — Ctrl+клик для постановки точки"
      onDismiss={onCancel}
    />
  );
}
