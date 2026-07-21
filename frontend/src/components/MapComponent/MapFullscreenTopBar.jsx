import MapFullscreenToolsMenu from './MapFullscreenToolsMenu';

export default function MapFullscreenTopBar({
  toolsMenuRef,
  isToolsOpen,
  onToggleTools,
  effectiveMeasureMode,
  measurePointsLength,
  clusterMode,
  onToggleMeasure,
  onClearMeasure,
  onClusterLegacy,
  onClusterBubble,
  onResetAll,
  onExitFullscreen,
  canEditTargets,
  onOpenAddTarget,
  canOpenReference,
  onOpenReference,
}) {
  return (
    <header className="map-fs-topbar">
      <div className="map-fs-topbar__brand" aria-hidden="true">И</div>
      <span className="map-fs-topbar__title">InfoLake</span>
      <span className="map-fs-topbar__subtitle">Карта · Полный экран</span>
      <div className="map-fs-topbar__spacer" />
      {canEditTargets && onOpenAddTarget && (
        <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--ghost" onClick={onOpenAddTarget}>
          + Объект
        </button>
      )}
      {canOpenReference && onOpenReference && (
        <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--ghost" onClick={onOpenReference}>
          Справочники
        </button>
      )}
      <div className="map-fs-topbar__tools-wrap" ref={toolsMenuRef}>
        <button
          type="button"
          className={`map-fs-topbar__btn map-fs-topbar__btn--tools${isToolsOpen ? ' map-fs-topbar__btn--tools-open' : ''}${effectiveMeasureMode ? ' map-fs-topbar__btn--active' : ''}`}
          onClick={onToggleTools}
          aria-expanded={isToolsOpen}
        >
          Инструменты
          <span className="map-fs-topbar__chev" aria-hidden>▼</span>
        </button>
        {isToolsOpen && (
          <MapFullscreenToolsMenu
            effectiveMeasureMode={effectiveMeasureMode}
            measurePointsLength={measurePointsLength}
            clusterMode={clusterMode}
            onToggleMeasure={onToggleMeasure}
            onClearMeasure={onClearMeasure}
            onClusterLegacy={onClusterLegacy}
            onClusterBubble={onClusterBubble}
            onResetAll={onResetAll}
          />
        )}
      </div>
      <button type="button" className="map-fs-topbar__btn map-fs-topbar__btn--exit" onClick={onExitFullscreen}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <polyline points="4,14 10,14 10,20" />
          <polyline points="20,10 14,10 14,4" />
          <line x1="10" y1="14" x2="3" y2="21" />
          <line x1="21" y1="3" x2="14" y2="10" />
        </svg>
        Свернуть
      </button>
    </header>
  );
}
