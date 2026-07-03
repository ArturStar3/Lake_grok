import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { UNIFIED_STYLE_URL } from '../../config/tiles';

const ATTRIBUTION =
  '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

/**
 * Векторный базовый слой (MapLibre GL внутри Leaflet).
 * Один стиль infolake-unified — переключение оверлеев через setLayoutProperty.
 */
export default function MapVectorBaseLayer({ onMapReady, onError }) {
  const leafletMap = useMap();
  const glLayerRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!leafletMap || glLayerRef.current) return undefined;

    const glLayer = L.maplibreGL({
      style: UNIFIED_STYLE_URL,
      attribution: ATTRIBUTION,
      minZoom: 2,
      maxZoom: 19,
      interactive: false,
    });

    glLayer.addTo(leafletMap);
    glLayerRef.current = glLayer;

    const mlMap = glLayer.getMaplibreMap();

    const handleLoad = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      onMapReady?.(mlMap);
    };

    const handleError = (event) => {
      const message = event?.error?.message || 'Не удалось загрузить векторную карту';
      onError?.(message);
    };

    if (mlMap.loaded()) {
      handleLoad();
    } else {
      mlMap.on('load', handleLoad);
    }
    mlMap.on('error', handleError);

    return () => {
      readyRef.current = false;
      mlMap.off('load', handleLoad);
      mlMap.off('error', handleError);
      if (glLayerRef.current) {
        leafletMap.removeLayer(glLayerRef.current);
        glLayerRef.current = null;
      }
    };
  }, [leafletMap, onMapReady, onError]);

  return null;
}
