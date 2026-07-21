import { useEffect, useState, useMemo, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { processMarkerClustering, calculateMarkerPosition, computeCountryBubbleClusters } from "./markerClusteringUtils";
import { enrichSvg, wrapMarkerSvg } from "../../utils/svgUtils";
import { getViewBoxSize } from "../../utils/svgUtils";
import { getCountryMarkerPalette, markerPaletteCacheKey } from "../../utils/markerPalette";
import { MAP_CONSTANTS } from "../../constants/mapConstants";
import { filterFlagMarkers } from "../../utils/markerFilters";
import { buildIconCacheKey, getOrCreateDivIcon } from "../../utils/markerIconCache";

// Функция для обогащения объектов реальными размерами из viewBox SVG
function enrichMarkersWithSvgSize(objects, svgCache) {
  return objects.map(o => {
    const path = o.marker?.path;
    const svg = path ? svgCache.get(path) ?? "" : "";
    const markerScale = parseFloat(o.marker?.scale) || 1;
    let iconWidth = ICON_WIDTH * markerScale;
    let iconHeight = ICON_HEIGHT * markerScale;
    const vb = getViewBoxSize(svg);
    if (vb && vb.width > 0) {
      const aspect = vb.height / vb.width;
      iconHeight = iconWidth * aspect;
    }
    return {
      ...o,
      marker: {
        ...o.marker,
        _computedIconHeight: iconHeight,
        _computedIconWidth: iconWidth
      }
    };
  });
}

const { ICON_WIDTH, ICON_HEIGHT } = MAP_CONSTANTS;

const LABEL_FONT_MAX = 14;
const LABEL_FONT_MIN = 9;

let _fontMeasureCanvas = null;

function measureTextWidth(text, fontSize) {
  if (!text) return 0;
  if (!_fontMeasureCanvas) {
    _fontMeasureCanvas = document.createElement('canvas');
  }
  const ctx = _fontMeasureCanvas.getContext('2d');
  ctx.font = `${fontSize}px Arial, Helvetica, sans-serif`;
  return ctx.measureText(text).width;
}

/** Укорачивает строку с одной точкой в конце, чтобы влезла в maxWidth при fontSize. */
function truncateWithDot(text, maxWidth, fontSize) {
  if (!text) return '';
  if (measureTextWidth(text, fontSize) <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 0) {
    const candidate = `${truncated}.`;
    if (measureTextWidth(candidate, fontSize) <= maxWidth) {
      return candidate;
    }
    truncated = truncated.slice(0, -1);
  }
  return measureTextWidth('.', fontSize) <= maxWidth ? '.' : '';
}

/**
 * Подбирает размер шрифта (от max до min). Обрезка с точкой — только на min,
 * если уменьшение шрифта не помогло.
 */
function fitMarkerLabel(text, maxWidthPx, maxFont = LABEL_FONT_MAX, minFont = LABEL_FONT_MIN) {
  if (!text) return { text: '', fontSize: maxFont };

  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 1) {
    if (measureTextWidth(text, fontSize) <= maxWidthPx) {
      return { text, fontSize };
    }
  }

  return {
    text: truncateWithDot(text, maxWidthPx, minFont),
    fontSize: minFont,
  };
}

// const latLngToPixel = (map, lat, lng) => {
//     const point = map.latLngToLayerPoint({lat, lng});
//     return { x: point.x, y: point.y };
// }

// // Утилита вычисления расстояния между точками
// const calcDistance = (p1, p2) => {
//     return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
// };

export default function LabelGeneration({ objects, selectedIds = [], onMarkersReady, clusterMode = 'legacy' }) {
  const mapInstance = useMapEvents({});
  const [svgCache, setSvgCache] = useState(new Map());
  const loadedPathsRef = useRef(new Set()); // Отслеживание загруженных путей
  const loadingPathsRef = useRef(new Set()); // Отслеживание текущих загрузок
  const [clusteredObjects, setClusteredObjects] = useState(objects);
  const [bubbleClusters, setBubbleClusters] = useState([]);
  const [zoom, setZoom] = useState(mapInstance?.getZoom?.() || 0);

  useEffect(() => {
    if (!mapInstance) return;
    
    // Use zoomend instead of 'zoom' — 'zoom' fires continuously during animations (including flyTo),
    // causing expensive repeated clustering + icon rebuilds that freeze the map.
    // zoomend fires once at the end of the animated transition.
    const handleZoomEnd = () => {
      setZoom(mapInstance.getZoom());
    };
    
    mapInstance.on('zoomend', handleZoomEnd);
    // Also set initial
    setZoom(mapInstance.getZoom?.() || 0);
    
    return () => mapInstance.off('zoomend', handleZoomEnd);
  }, [mapInstance]);

  // Мемоизируем строку путей для стабильных зависимостей
  const pathsKey = useMemo(() => {
    if (!objects || !Array.isArray(objects) || objects.length === 0) return '';
    
    const selectedFlagObjects = filterFlagMarkers(objects, selectedIds);
    
    const uniquePaths = Array.from(new Set(selectedFlagObjects.map(o => o.marker?.path).filter(Boolean)));
    return uniquePaths.sort().join('|');
  }, [objects, selectedIds]);

  // Мемоизируем ключ для кластеризации
  const clusterKey = useMemo(() => {
    if (!objects || !Array.isArray(objects) || objects.length === 0) return '';
    const selectedFlagObjects = filterFlagMarkers(objects, selectedIds);
    // Ключ только по id, marker.id и zoom
    const ids = selectedFlagObjects.map(o => `${o.id}:${o.marker?.id || 'none'}`).sort().join(',');
    return `${ids}:${zoom}`;
  }, [objects, selectedIds, zoom]);

  // Отдельный useEffect для загрузки SVG (только при изменении путей)
  useEffect(() => {
    if (!pathsKey) return;
    
    const paths = pathsKey.split('|').filter(Boolean);
    const pathsToLoad = paths.filter(path => 
      !loadedPathsRef.current.has(path) && !loadingPathsRef.current.has(path)
    );
    
    if (pathsToLoad.length === 0) return;

    // СРАЗУ помечаем пути как "загружаются" (loaded — только после успешной загрузки)
    pathsToLoad.forEach(path => {
      loadingPathsRef.current.add(path);
    });

    const loadSvgs = async () => {
        const newEntries = await Promise.all(
            pathsToLoad.map(async (path) => {
                try {
                    const res = await axios.get(path, { responseType: "text" });
                    loadedPathsRef.current.add(path);
                    return [path, res.data];
                } catch (err) {
                    console.warn("Не удалось загрузить SVG:", path, err);
                    return [path, ""];
                } finally {
                    loadingPathsRef.current.delete(path);
                }
            })
        );
        
        setSvgCache(prev => {
            const updated = new Map(prev);
            newEntries.forEach(([path, data]) => updated.set(path, data));
            return updated;
        });
    };

    loadSvgs();
  }, [pathsKey]);

  // Отдельный useEffect для кластеризации
  useEffect(() => {
    const selectedFlagObjects = filterFlagMarkers(objects, selectedIds);
    if (mapInstance) {
      // Сначала обогащаем объекты реальными размерами
      const enrichedObjects = enrichMarkersWithSvgSize(selectedFlagObjects, svgCache);
      if (clusterMode === 'bubble') {
        const { visible, bubbles } = computeCountryBubbleClusters(enrichedObjects, mapInstance);
        setClusteredObjects(visible);
        setBubbleClusters(bubbles);
      } else {
        setBubbleClusters([]);
        const processedObjects = processMarkerClustering(enrichedObjects, mapInstance);
        setClusteredObjects(processedObjects);
      }
    } else {
      setClusteredObjects(selectedFlagObjects);
      setBubbleClusters([]);
    }
  }, [clusterKey, objects, selectedIds, mapInstance, svgCache, clusterMode]);

  const iconsById = useMemo(() => {
    if (!L || !L.DivIcon) {
      console.warn("L.DivIcon недоступен — иконки не созданы");
      return {};
    }

    const map = {};

    clusteredObjects.forEach((o) => {
        const path = o.marker?.path;
        if (path && !svgCache.has(path)) {
          return;
        }
        const svg = path ? svgCache.get(path) ?? "" : "";
        const markerScale = parseFloat(o.marker?.scale) || 1;
        let iconWidth = ICON_WIDTH * markerScale;
        let iconHeight = ICON_HEIGHT * markerScale;
        const vb = getViewBoxSize(svg);
        if (vb && vb.width > 0) {
          // width оставляем прежним, только корректируем высоту
          const aspect = vb.height / vb.width;
          iconHeight = iconWidth * aspect;
        }
        // Прокидываем iconHeight в marker для offsetY
        o.marker = {
          ...o.marker,
          _computedIconHeight: iconHeight
        };
        const labelTop = o.marker?.top || 0;
        const labelHeight = o.marker?.height || 100;
        const labelWidth = o.marker?.width || 100;
        const palette = getCountryMarkerPalette(o.country);
        const paletteKey = markerPaletteCacheKey(palette);
        const label = o.label || "";

        // Вычисляем позицию маркера с учетом смещения в кластере
        const markerPosition = calculateMarkerPosition(o, markerScale);

        const top = `${iconHeight * (labelTop / 100)}px`;
        const height = `${iconHeight * (labelHeight / 100)}px`;
        const width = `${iconWidth * (labelWidth / 100)}px`;
        const labelBoxWidthPx = iconWidth * (labelWidth / 100);
        const { text: labelText, fontSize: labelFontSize } = fitMarkerLabel(
          label,
          labelBoxWidthPx,
        );

        const cacheKey = buildIconCacheKey([
          'flag',
          o.id,
          path,
          paletteKey,
          markerScale,
          labelText,
          labelFontSize,
          markerPosition.top,
          iconWidth,
          iconHeight,
          svg.length,
        ]);

        map[o.id] = getOrCreateDivIcon(cacheKey, () => {
          const svgInner = enrichSvg(svg, iconWidth, iconHeight, o.id, palette) || `
                <svg viewBox="0 0 ${ICON_WIDTH} ${ICON_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                  <rect width="${ICON_WIDTH}" height="${ICON_HEIGHT}" fill="#ccc"/>
                </svg>
              `;
          const html = `
          <div class="custom-marker-label"
            style="position:relative; width:${iconWidth}px; height:${iconHeight}px; --marker-offset-y: ${markerPosition.top}px; transform: translateY(var(--marker-offset-y));"
          >
            <span class="svg-marker" data-id="${o.id}" data-cluster-id="${o.clusterId || o.id}">
              ${wrapMarkerSvg(svgInner, palette)}
            </span>
            <span class="marker-label"
              style="
                top:${top};
                width:${width};
                height:${height};
                line-height:${height};
                font-size:${labelFontSize}px;
              "
            >
              ${labelText}
            </span>
          </div>
        `;
          return new L.DivIcon({
            html,
            className: "custom-div-icon",
            iconSize: [iconWidth, iconHeight],
            iconAnchor: [iconWidth, iconHeight],
            popupAnchor: [0, -iconHeight / 2],
          });
        });
    });

    return map;
  }, [clusteredObjects, svgCache]);

  // Вызываем callback когда иконки готовы (или когда список пуст — сброс маркеров)
  useEffect(() => {
    if (!onMarkersReady) return;
    if (Object.keys(iconsById).length > 0) {
      onMarkersReady({ iconsById, clusteredObjects, bubbles: bubbleClusters });
    } else if (!clusteredObjects || clusteredObjects.length === 0) {
      onMarkersReady({ iconsById: {}, clusteredObjects: [], bubbles: bubbleClusters });
    }
  }, [iconsById, clusteredObjects, bubbleClusters, onMarkersReady]);

  return null;
}