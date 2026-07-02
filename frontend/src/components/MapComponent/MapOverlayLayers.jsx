import { TileLayer } from 'react-leaflet';
import { overlayTileUrl } from '../../config/tiles';

/**
 * Рендерит активные слои-оверлеи поверх базовой карты.
 * Каждый слой — прозрачный растровый стиль TileServer.
 * zIndex держим ниже слоёв стран, зон действия и маркеров.
 */
export default function MapOverlayLayers({ activeLayers = [] }) {
  return (
    <>
      {activeLayers.map((layer) => (
        <TileLayer
          key={layer.id}
          url={overlayTileUrl(layer.style)}
          opacity={0.85}
          zIndex={layer.zIndex}
          minZoom={2}
          maxZoom={19}
        />
      ))}
    </>
  );
}
