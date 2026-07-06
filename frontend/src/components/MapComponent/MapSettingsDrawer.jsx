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
        <svg
          className="map-settings-drawer__icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.11.2-.06.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
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
