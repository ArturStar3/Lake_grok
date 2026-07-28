import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  createMaplibreTransformRequest,
  fetchUnifiedMapStyle,
} from '../../config/tiles';

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
  const handlersRef = useRef(null);

  useEffect(() => {
    if (!leafletMap || glLayerRef.current) return undefined;

    let cancelled = false;

    const init = async () => {
      try {
        const style = await fetchUnifiedMapStyle();
        if (cancelled) return;

        const glLayer = L.maplibreGL({
          style,
          transformRequest: createMaplibreTransformRequest(),
          attribution: ATTRIBUTION,
          minZoom: 2,
          maxZoom: 19,
          interactive: false,
        });

        glLayer.addTo(leafletMap);
        glLayerRef.current = glLayer;

        const mlMap = glLayer.getMaplibreMap();

        const handleLoad = () => {
          if (readyRef.current || cancelled) return;
          readyRef.current = true;
          onMapReady?.(mlMap);
        };

        const handleError = (event) => {
          const err = event?.error;
          const sourceId = event?.sourceId || event?.tile?.tileID?.canonical;
          const failedUrl = err?.url || event?.url;
          const parts = [
            err?.message || event?.message || 'Не удалось загрузить векторную карту',
            sourceId ? `source: ${sourceId}` : null,
            failedUrl ? `url: ${failedUrl}` : null,
          ].filter(Boolean);
          onError?.(parts.join(' | '));
        };

        handlersRef.current = { handleLoad, handleError };

        if (mlMap.loaded()) {
          handleLoad();
        } else {
          mlMap.on('load', handleLoad);
        }
        mlMap.on('error', handleError);
      } catch (err) {
        if (!cancelled) {
          onError?.(err?.message || 'Не удалось загрузить векторную карту');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      readyRef.current = false;
      const glLayer = glLayerRef.current;
      if (glLayer) {
        const mlMap = glLayer.getMaplibreMap?.();
        const handlers = handlersRef.current;
        if (mlMap && handlers) {
          mlMap.off('load', handlers.handleLoad);
          mlMap.off('error', handlers.handleError);
        }
        leafletMap.removeLayer(glLayer);
        glLayerRef.current = null;
        handlersRef.current = null;
      }
    };
  }, [leafletMap, onMapReady, onError]);

  return null;
}
