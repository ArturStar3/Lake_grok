import { useMemo } from 'react';
import { Marker, Tooltip, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const BUBBLE_BASE_RADIUS = 14;
const BUBBLE_LOG_K = 4;

/** Одиночные точки и обводка кластеров: флаг vs non-flag */
const FLAG_FILL = '#2563eb';
const NON_FLAG_FILL = '#ea580c';
const FLAG_BUBBLE_BG = 'rgba(37, 99, 235, 0.92)';
const NON_FLAG_BUBBLE_BG = 'rgba(234, 88, 12, 0.92)';

function bubbleDiameter(count) {
  const r = BUBBLE_BASE_RADIUS + BUBBLE_LOG_K * Math.log(Math.max(count, 2));
  return Math.min(56, Math.max(28, r * 2));
}

function createBubbleDivIcon(count, isFlag) {
  const size = bubbleDiameter(count);
  const bg = isFlag ? FLAG_BUBBLE_BG : NON_FLAG_BUBBLE_BG;
  const html = `
    <div class="map-bubble-cluster map-bubble-cluster--${isFlag ? 'flag' : 'nonflag'}" style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${bg};
      color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:${size < 36 ? 12 : 14}px;font-weight:600;
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
    ">${count}</div>
  `;
  return L.divIcon({
    html,
    className: 'map-bubble-cluster-wrap',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function singlePointStyle(isFlag) {
  return {
    radius: isFlag ? 7 : 6,
    color: '#ffffff',
    weight: 2,
    fillColor: isFlag ? FLAG_FILL : NON_FLAG_FILL,
    fillOpacity: 0.92,
  };
}

export default function BubbleClusterLayer({
  bubbles = [],
  singles = [],
  onMarkerClick,
  onMarkerHover,
  measureMode = false,
  eventDrawingActive = false,
  altAddTargetActive = false,
  onEventMapClick,
  onAltClickAddTarget,
}) {
  const map = useMap();

  const clusterItems = useMemo(() => bubbles || [], [bubbles]);
  const singleItems = useMemo(() => singles || [], [singles]);

  const handleSingleClick = (obj) => (e) => {
    if (eventDrawingActive) {
      onEventMapClick?.(e.latlng, e.target._map);
      return;
    }
    if (altAddTargetActive && e.originalEvent?.altKey) {
      onAltClickAddTarget?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      return;
    }
    if (measureMode && e.originalEvent?.ctrlKey) return;
    if (obj?.id) onMarkerClick?.(obj.id);
  };

  if (!clusterItems.length && !singleItems.length) return null;

  return (
    <>
      {clusterItems.map((bubble) => (
        <Marker
          key={bubble.id}
          position={[bubble.lat, bubble.lng]}
          icon={createBubbleDivIcon(bubble.count, Boolean(bubble.isFlag))}
          zIndexOffset={400}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              if (!bubble.members?.length) return;
              const bounds = L.latLngBounds(
                bubble.members.map((m) => [m.lat, m.lng]),
              );
              map.fitBounds(bounds.pad(0.25), { maxZoom: map.getZoom() + 2 });
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
            {bubble.isFlag ? 'Флаги' : 'Объекты'} · {bubble.country}: {bubble.count}
          </Tooltip>
        </Marker>
      ))}
      {singleItems.map((obj) => {
        const isFlag = obj._bubbleSingleIsFlag === true;
        const label = (obj.label || obj.title || '').trim();
        return (
          <CircleMarker
            key={`bubble-single-${obj.id}`}
            center={[obj.lat, obj.lng]}
            pathOptions={singlePointStyle(isFlag)}
            zIndexOffset={350}
            eventHandlers={{
              click: handleSingleClick(obj),
              mouseover: () => onMarkerHover?.(obj.id),
              mouseout: () => onMarkerHover?.(null),
            }}
          >
            {label ? (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -4]}
                opacity={0.85}
                className="map-bubble-single-tooltip"
                interactive={false}
              >
                {label}
              </Tooltip>
            ) : null}
          </CircleMarker>
        );
      })}
    </>
  );
}

export { FLAG_FILL, NON_FLAG_FILL };
