import { FULLSCREEN_DOCK_TABS, FULLSCREEN_TAB_LABELS } from './mapFullscreenConstants';

function DockIcon({ tab }) {
  switch (tab) {
    case 'layers':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="12,2 22,8.5 12,15 2,8.5" />
          <polyline points="2,12 12,18.5 22,12" />
        </svg>
      );
    case 'objects':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case 'events':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      );
    case 'zones':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="10" strokeDasharray="4 2.5" />
          <circle cx="12" cy="12" r="5" />
        </svg>
      );
    case 'situations':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M6 12l3-3 3 3 4-4" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MapFullscreenDock({
  dockTab,
  onOpenDock,
  canReadSituations,
  tabCounts,
  currentZoom,
  onOpenTools,
}) {
  const tabs = FULLSCREEN_DOCK_TABS.filter((t) => t !== 'situations' || canReadSituations);

  return (
    <nav className="map-fs-dock" aria-label="Панели карты">
      <div className="map-fs-dock__tabs">
        {tabs.map((tab) => {
          const isActive = dockTab === tab;
          const count = tabCounts?.[tab];
          return (
            <button
              key={tab}
              type="button"
              className={`map-fs-dock__tab${isActive ? ' map-fs-dock__tab--active' : ''}`}
              title={FULLSCREEN_TAB_LABELS[tab].label}
              onClick={() => onOpenDock(tab)}
            >
              {isActive && <span className="map-fs-dock__tab-indicator" aria-hidden />}
              <span className="map-fs-dock__tab-icon"><DockIcon tab={tab} /></span>
              <span className="map-fs-dock__tab-label">{FULLSCREEN_TAB_LABELS[tab].short}</span>
              {typeof count === 'number' && count > 0 && (
                <span className="map-fs-dock__badge">{count > 99 ? '99+' : count}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="map-fs-dock__footer">
        <button type="button" className="map-fs-dock__tools-shortcut" title="Инструменты" onClick={onOpenTools}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
          <span>Инстр.</span>
        </button>
        <span className="map-fs-dock__zoom" title="Масштаб карты">z{currentZoom}</span>
      </div>
    </nav>
  );
}
