export default function MapFullscreenToolsMenu({
  effectiveMeasureMode,
  measurePointsLength,
  clusterMode,
  onToggleMeasure,
  onClearMeasure,
  onClusterLegacy,
  onClusterBubble,
  onResetAll,
}) {
  return (
    <div className="map-fs-tools-menu" role="menu">
      <button type="button" className="map-fs-tools-menu__item" role="menuitem" onClick={onToggleMeasure}>
        {effectiveMeasureMode ? '✓ ' : ''}Режим измерения
      </button>
      <button
        type="button"
        className="map-fs-tools-menu__item"
        role="menuitem"
        onClick={onClearMeasure}
        disabled={measurePointsLength === 0}
      >
        Очистить измерения
      </button>
      <button type="button" className="map-fs-tools-menu__item" role="menuitem" onClick={onClusterLegacy}>
        {clusterMode === 'legacy' ? '✓ ' : ''}Кластеризация: классическая
      </button>
      <button type="button" className="map-fs-tools-menu__item" role="menuitem" onClick={onClusterBubble}>
        {clusterMode === 'bubble' ? '✓ ' : ''}Кластеризация: круги
      </button>
      {clusterMode === 'bubble' && (
        <p className="map__cluster-legend" role="note">
          <span className="map__cluster-legend-dot map__cluster-legend-dot--flag" aria-hidden />
          флаги
          <span className="map__cluster-legend-dot map__cluster-legend-dot--nonflag" aria-hidden />
          объекты
        </p>
      )}
      <button type="button" className="map-fs-tools-menu__item" role="menuitem" onClick={onResetAll}>
        Сбросить все
      </button>
    </div>
  );
}
