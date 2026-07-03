import React, { useEffect, useId, useRef } from 'react';
import ControlPanel from '../ControlPanel/ControlPanel';
import './MapSettingsDrawer.css';

/**
 * Параметры отображения карты — отдельная slide-over панель на холсте карты.
 * Не смешивается с вкладками объектов / событий / зон (принцип task–settings separation).
 */
export default function MapSettingsDrawer({
  actionTypes = [],
  isTerrainEnabled,
  onTerrainTypeToggle,
  onEnableAllTerrainTypes,
  onDisableAllTerrainTypes,
  losComputingCount = 0,
  losZonesCount = 0,
  sidebarOpen = false,
}) {
  const [open, setOpen] = React.useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  const triggerClass = [
    'map-settings-drawer__trigger',
    open ? 'map-settings-drawer__trigger--active' : '',
    sidebarOpen ? 'map-settings-drawer__trigger--sidebar-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        aria-label="Параметры отображения карты"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9.4 4a7.9 7.9 0 0 1-.1 1l2 1.5-2 3.5-2.3-1a8.1 8.1 0 0 1-1.7 1l-.3 2.5H9l-.3-2.5a8.1 8.1 0 0 1-1.7-1l-2.3 1-2-3.5 2-1.5a7.9 7.9 0 0 1-.1-1 7.9 7.9 0 0 1 .1-1l-2-1.5 2-3.5 2.3 1a8.1 8.1 0 0 1 1.7-1L9 2.1h6l.3 2.5a8.1 8.1 0 0 1 1.7 1l2.3-1 2 3.5-2 1.5c.07.32.1.65.1 1Z"
          />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="map-settings-drawer__backdrop"
            aria-label="Закрыть параметры карты"
            onClick={() => setOpen(false)}
          />
          <aside
            ref={panelRef}
            className="map-settings-drawer__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <header className="map-settings-drawer__header">
              <div>
                <h2 id={titleId} className="map-settings-drawer__title">
                  Параметры карты
                </h2>
                <p className="map-settings-drawer__subtitle">
                  Настройки отображения, не связанные с данными объектов
                </p>
              </div>
              <button
                type="button"
                className="map-settings-drawer__close"
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>
            <div className="map-settings-drawer__body">
              <ControlPanel
                actionTypes={actionTypes}
                isTerrainEnabled={isTerrainEnabled}
                onTerrainTypeToggle={onTerrainTypeToggle}
                onEnableAllTerrainTypes={onEnableAllTerrainTypes}
                onDisableAllTerrainTypes={onDisableAllTerrainTypes}
                losComputingCount={losComputingCount}
                losZonesCount={losZonesCount}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
