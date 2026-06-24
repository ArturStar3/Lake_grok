import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPopupContent(popup) {
  const radiusKm = Math.round((popup.radiusMeters || 0) / 1000);
  return `
    <div class="zone-action-popup__content">
      <strong>${escapeHtml(popup.label)}</strong><br />
      Тип зоны: ${escapeHtml(popup.actionTitle)}<br />
      Радиус: ${radiusKm} км<br />
      Страна: ${escapeHtml(popup.countryTitle || '')}
    </div>
  `;
}

/**
 * Императивный Leaflet popup — не зависит от ре-рендеров карты при hover маркеров.
 */
const ZoneActionPopupManager = React.memo(function ZoneActionPopupManager({ popup, version, onClose }) {
  const map = useMap();
  const leafletPopupRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const closeCurrent = () => {
      const current = leafletPopupRef.current;
      if (!current) return;
      current.off('remove');
      map.closePopup(current);
      leafletPopupRef.current = null;
    };

    if (!popup || popup.centerLat == null) {
      closeCurrent();
      return undefined;
    }

    closeCurrent();

    const leafletPopup = L.popup({
      closeButton: true,
      autoPan: false,
      className: 'zone-action-popup',
    })
      .setLatLng([popup.centerLat, popup.centerLng])
      .setContent(buildPopupContent(popup));

    const handleRemove = () => {
      if (leafletPopupRef.current === leafletPopup) {
        leafletPopupRef.current = null;
      }
      onCloseRef.current();
    };

    leafletPopup.on('remove', handleRemove);
    leafletPopup.openOn(map);
    leafletPopupRef.current = leafletPopup;

    return () => {
      if (leafletPopupRef.current === leafletPopup) {
        leafletPopup.off('remove', handleRemove);
        map.closePopup(leafletPopup);
        leafletPopupRef.current = null;
      }
    };
  }, [
    map,
    version,
    popup?.centerLat,
    popup?.centerLng,
    popup?.label,
    popup?.actionTitle,
    popup?.radiusMeters,
    popup?.countryTitle,
  ]);

  return null;
});

export default ZoneActionPopupManager;
