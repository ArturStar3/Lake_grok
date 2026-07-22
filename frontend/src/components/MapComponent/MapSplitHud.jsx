import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import MapFullscreenToolsMenu from './MapFullscreenToolsMenu';

function MapSplitZoomControls() {
  const map = useMap();
  return (
    <div className="map-split-hud__zoom">
      <button type="button" className="map-split-hud__btn" title="Приблизить" aria-label="Приблизить" onClick={() => map.zoomIn()}>
        +
      </button>
      <button type="button" className="map-split-hud__btn" title="Отдалить" aria-label="Отдалить" onClick={() => map.zoomOut()}>
        −
      </button>
    </div>
  );
}

export default function MapSplitHud({
  toolsOpen,
  onToggleTools,
  toolsMenuRef,
  effectiveMeasureMode,
  measurePointsLength,
  clusterMode,
  onToggleMeasure,
  onClearMeasure,
  onClusterLegacy,
  onClusterBubble,
  onResetAll,
}) {
  const wrapRef = useRef(null);
  const [localOpen, setLocalOpen] = useState(false);
  const open = toolsOpen ?? localOpen;
  const setOpen = onToggleTools
    ? () => onToggleTools()
    : () => setLocalOpen((v) => !v);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const root = toolsMenuRef?.current || wrapRef.current;
      if (root && !root.contains(e.target)) {
        if (onToggleTools && toolsOpen) onToggleTools();
        else setLocalOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onToggleTools, toolsOpen, toolsMenuRef]);

  return (
    <>
      <div className="map-split-hud__tools" ref={toolsMenuRef || wrapRef}>
        <button
          type="button"
          className={`map-split-hud__tools-btn${open ? ' map-split-hud__tools-btn--open' : ''}${effectiveMeasureMode ? ' map-split-hud__tools-btn--active' : ''}`}
          onClick={setOpen}
          aria-expanded={open}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
          Инструменты
          <span aria-hidden>▼</span>
        </button>
        {open && (
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
      <MapSplitZoomControls />
    </>
  );
}
