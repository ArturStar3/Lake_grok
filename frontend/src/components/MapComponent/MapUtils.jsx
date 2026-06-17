import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { processMarkerClustering, calculateMarkerPosition, processNonFlagClustering, getGroupCirclePositions } from "./markerClusteringUtils";
import { enrichSvg } from "../../utils/svgUtils";
import { getViewBoxSize } from "../../utils/svgUtils";

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
import { MAP_CONSTANTS } from "../../constants/mapConstants";
import { filterFlagMarkers, isFlagMarker } from "../../utils/markerFilters";

const { ICON_WIDTH, ICON_HEIGHT, MAX_DISTANCE_PX } = MAP_CONSTANTS;

function calcFontSize(text, maxWidth, maxFont = 14, minFont = 6) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let fontSize = maxFont;
  const measure = size => {
    ctx.font = `${size}px Arial, Helvetica, sans-serif`;
    return ctx.measureText(text).width;
  };
  while (fontSize > minFont && measure(fontSize) > maxWidth) {
    fontSize -= 1;
  }
  return Math.max(fontSize, minFont);
}

// const latLngToPixel = (map, lat, lng) => {
//     const point = map.latLngToLayerPoint({lat, lng});
//     return { x: point.x, y: point.y };
// }

// // Утилита вычисления расстояния между точками
// const calcDistance = (p1, p2) => {
//     return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
// };

export default function LabelGeneration({ objects, selectedIds = [], onMarkersReady }) {
  const mapInstance = useMapEvents({
    zoom: () => {
      // Пересчитываем кластеризацию при изменении масштаба
    }
  });
  const [svgCache, setSvgCache] = useState(new Map());
  const loadedPathsRef = useRef(new Set()); // Отслеживание загруженных путей
  const loadingPathsRef = useRef(new Set()); // Отслеживание текущих загрузок
  const [clusteredObjects, setClusteredObjects] = useState(objects);
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

    // СРАЗУ помечаем пути как "загружаются"
    pathsToLoad.forEach(path => {
      loadingPathsRef.current.add(path);
      loadedPathsRef.current.add(path);
    });

    const loadSvgs = async () => {
        const newEntries = await Promise.all(
            pathsToLoad.map(async (path) => {
                try {
                    const res = await axios.get(path, { responseType: "text" });
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
      const processedObjects = processMarkerClustering(enrichedObjects, mapInstance);
      setClusteredObjects(processedObjects);
    } else {
      setClusteredObjects(selectedFlagObjects);
    }
  }, [clusterKey, objects, selectedIds, mapInstance, svgCache]);

  const iconsById = useMemo(() => {
    if (!L || !L.DivIcon) {
      console.warn("L.DivIcon недоступен — иконки не созданы");
      return {};
    }

    const map = {};

    clusteredObjects.forEach((o) => {
        const path = o.marker?.path;
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
        const markerColor = o.country?.color || "blue";
        const label = o.label || "";

        // Вычисляем позицию маркера с учетом смещения в кластере
        const markerPosition = calculateMarkerPosition(o, markerScale);

        const top = `${iconHeight * (labelTop / 100)}px`;
        const height = `${iconHeight * (labelHeight / 100)}px`;
        const width = `${iconWidth * (labelWidth / 100)}px`;
        const fontSize = calcFontSize(label, iconWidth * 0.8, 14, 9);

        const html = `
          <div class="custom-marker-label"
            style="position:relative; width:${iconWidth}px; height:${iconHeight}px; --marker-offset-y: ${markerPosition.top}px; transform: translateY(var(--marker-offset-y));"
            onmouseover="(function(e){if(!e.relatedTarget||!e.currentTarget.contains(e.relatedTarget)){window.logMarkerEvent&&window.logMarkerEvent('mouseover','${o.id}')}})(event)"
            onmouseenter="(function(e){if(!e.relatedTarget||!e.currentTarget.contains(e.relatedTarget)){window.logMarkerEvent&&window.logMarkerEvent('mouseenter','${o.id}')}})(event)"
            onmousemove="(function(e){if(!e.relatedTarget||!e.currentTarget.contains(e.relatedTarget)){window.logMarkerEvent&&window.logMarkerEvent('mousemove','${o.id}')}})(event)"
            onmouseleave="(function(e){if(!e.relatedTarget||!e.currentTarget.contains(e.relatedTarget)){window.logMarkerEvent&&window.logMarkerEvent('mouseleave','${o.id}')}})(event)"
          >
            <span class="svg-marker" data-id="${o.id}" data-cluster-id="${o.clusterId || o.id}">
              ${enrichSvg(svg, iconWidth, iconHeight, o.id, markerColor) || `
                <svg viewBox="0 0 ${ICON_WIDTH} ${ICON_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
                  <rect width="${ICON_WIDTH}" height="${ICON_HEIGHT}" fill="#ccc"/>
                </svg>
              `}
            </span>
            <span class="marker-label"
              style="
                top:${top};
                width:${width};
                height:${height};
                line-height:${height};
                font-size:${fontSize - 1}px;
                text-align:center;
                display:flex;
                align-items:center;
                justify-content:flex-end;
              "
            >
              ${label}
            </span>
          </div>
        `;

        const offsetMap = {
          right: [iconWidth, iconHeight],
          left: [0, 0],
          top: [0, 0],
          bottom: [0, 0]
        };

        map[o.id] = new L.DivIcon({
          html,
          className: "custom-div-icon",
          iconSize: [iconWidth, iconHeight],
          iconAnchor: offsetMap["right"],
          popupAnchor: [0, -iconHeight / 2]
        });
    });

    return map;
  }, [clusteredObjects, svgCache]);

  // Вызываем callback когда иконки готовы
  useEffect(() => {
    if (onMarkersReady && Object.keys(iconsById).length > 0) {
      onMarkersReady({ iconsById, clusteredObjects });
    }
  }, [iconsById, clusteredObjects, onMarkersReady]);

  return null;
}