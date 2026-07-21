import { FULLSCREEN_DOCK_TABS, FULLSCREEN_TAB_LABELS } from './mapFullscreenConstants';

export default function MapFullscreenPanel({
  panelRef,
  isOpen,
  dockTab,
  canReadSituations,
  onSelectTab,
  onClose,
  onTouchStart,
  onTouchEnd,
  children,
  featuresFooter,
}) {
  const tabs = FULLSCREEN_DOCK_TABS.filter((t) => t !== 'situations' || canReadSituations);

  return (
    <aside
      ref={panelRef}
      className={`map-fs-panel${isOpen ? ' map-fs-panel--open' : ''}`}
      aria-hidden={!isOpen}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="map-fs-panel__tabs">
        <div className="map-fs-panel__tabs-scroll">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`map-fs-panel__chip${dockTab === tab ? ' map-fs-panel__chip--active' : ''}`}
              onClick={() => onSelectTab(tab)}
            >
              {FULLSCREEN_TAB_LABELS[tab].short}
            </button>
          ))}
        </div>
        <button type="button" className="map-fs-panel__close" onClick={onClose} aria-label="Закрыть панель">
          ✕
        </button>
      </div>
      <div className="map-fs-panel__body">
        <div className="map-fs-panel__scroll">{children}</div>
        {featuresFooter}
      </div>
      <p className="map-fs-panel__swipe-hint">← Свайп вправо для закрытия</p>
    </aside>
  );
}
