import { useEffect, useState, useMemo, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { processMarkerClustering, calculateMarkerPosition, computeCountryBubbleClusters, selectionIdsKey } from "./markerClusteringUtils";
import { enrichSvg, wrapMarkerSvg } from "../../utils/svgUtils";
import { getCountryMarkerPalette, markerPaletteCacheKey } from "../../utils/markerPalette";
import { MAP_CONSTANTS } from "../../constants/mapConstants";
import { filterFlagMarkers } from "../../utils/markerFilters";
import { buildIconCacheKey, getOrCreateDivIcon } from "../../utils/markerIconCache";
import { computeIconDimensions } from "../../utils/markerIconFactory";
import { resolveMediaUrl } from "../../utils/mediaUrl";

function enrichMarkersWithSvgSize(objects, svgCache) {
  return objects.map(o => {
    const path = resolveMediaUrl(o.marker?.path);
    const svg = path ? svgCache.get(path) ?? "" : "";
    const markerScale = parseFloat(o.marker?.scale) || 1;
    const { iconWidth, iconHeight } = computeIconDimensions(svg, markerScale);
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

/** Reuse enriched objects when SVG/path/scale unchanged (tableau reveal thrashing). */
function enrichMarkersWithSvgSizeCached(objects, svgCache, cacheRef) {
  const nextIds = new Set();
  const result = objects.map((o) => {
    nextIds.add(o.id);
    const path = resolveMediaUrl(o.marker?.path);
    const svg = path ? svgCache.get(path) ?? "" : "";
    const markerScale = parseFloat(o.marker?.scale) || 1;
    const cached = cacheRef.current.get(o.id);
    if (
      cached
      && cached.path === path
      && cached.svgLen === svg.length
      && cached.scale === markerScale
    ) {
      return cached.obj;
    }
    const [enriched] = enrichMarkersWithSvgSize([o], svgCache);
    cacheRef.current.set(o.id, {
      path,
      svgLen: svg.length,
      scale: markerScale,
      obj: enriched,
    });
    return enriched;
  });
  cacheRef.current.forEach((_, id) => {
    if (!nextIds.has(id)) cacheRef.current.delete(id);
  });
  return result;
}

function layoutFingerprint(objects) {
  return objects.map((o) => `${o.id}:${o.marker?._computedIconHeight || 0}`).join(',');
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

export default function LabelGeneration({ objects, selectedIds = [], onMarkersReady, clusterMode = 'legacy' }) {
  const mapInstance = useMapEvents({});
  const [svgCache, setSvgCache] = useState(new Map());
  const loadedPathsRef = useRef(new Set()); // Отслеживание загруженных путей
  const loadingPathsRef = useRef(new Set()); // Отслеживание текущих загрузок
  const enrichCacheRef = useRef(new Map());
  const lastNoneIdsKeyRef = useRef('');
  const lastLayoutKeyRef = useRef('');
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

  const selectedFlagObjects = useMemo(
    () => filterFlagMarkers(objects, selectedIds),
    [objects, selectedIds],
  );

  const pathsKey = useMemo(() => {
    if (!selectedFlagObjects.length) return '';
    const uniquePaths = Array.from(new Set(selectedFlagObjects.map(o => resolveMediaUrl(o.marker?.path)).filter(Boolean)));
    return uniquePaths.sort().join('|');
  }, [selectedFlagObjects]);

  const clusterKey = useMemo(() => {
    if (!selectedFlagObjects.length) return '';
    const ids = selectionIdsKey(selectedFlagObjects);
    if (clusterMode === 'none') return `${ids}:none`;
    return `${ids}:${zoom}`;
  }, [selectedFlagObjects, zoom, clusterMode]);

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

  useEffect(() => {
    if (mapInstance) {
      if (clusterMode === 'none') {
        const enrichedObjects = enrichMarkersWithSvgSizeCached(
          selectedFlagObjects,
          svgCache,
          enrichCacheRef,
        );
        const noneKey = `${selectionIdsKey(enrichedObjects)}|${layoutFingerprint(enrichedObjects)}`;
        if (noneKey === lastNoneIdsKeyRef.current) return;
        lastNoneIdsKeyRef.current = noneKey;
        lastLayoutKeyRef.current = '';
        setBubbleClusters((prev) => (prev.length ? [] : prev));
        setClusteredObjects(enrichedObjects);
      } else if (clusterMode === 'bubble') {
        const enrichedObjects = enrichMarkersWithSvgSize(selectedFlagObjects, svgCache);
        const layoutKey = `bubble|${clusterKey}|${layoutFingerprint(enrichedObjects)}`;
        if (layoutKey === lastLayoutKeyRef.current) return;
        lastLayoutKeyRef.current = layoutKey;
        lastNoneIdsKeyRef.current = '';
        const { visible, bubbles } = computeCountryBubbleClusters(enrichedObjects, mapInstance);
        setClusteredObjects(visible);
        setBubbleClusters(bubbles);
      } else {
        const enrichedObjects = enrichMarkersWithSvgSize(selectedFlagObjects, svgCache);
        const layoutKey = `legacy|${clusterKey}|${layoutFingerprint(enrichedObjects)}`;
        if (layoutKey === lastLayoutKeyRef.current) return;
        lastLayoutKeyRef.current = layoutKey;
        lastNoneIdsKeyRef.current = '';
        setBubbleClusters([]);
        const processedObjects = processMarkerClustering(enrichedObjects, mapInstance);
        setClusteredObjects(processedObjects);
      }
    } else {
      lastLayoutKeyRef.current = '';
      lastNoneIdsKeyRef.current = '';
      setClusteredObjects(selectedFlagObjects);
      setBubbleClusters([]);
    }
  }, [clusterKey, selectedFlagObjects, mapInstance, svgCache, clusterMode]);

  const iconsById = useMemo(() => {
    if (!L || !L.DivIcon) {
      console.warn("L.DivIcon недоступен — иконки не созданы");
      return {};
    }

    const map = {};

    clusteredObjects.forEach((o) => {
        const path = resolveMediaUrl(o.marker?.path);
        if (path && !svgCache.has(path)) {
          return;
        }
        const svg = path ? svgCache.get(path) ?? "" : "";
        const markerScale = parseFloat(o.marker?.scale) || 1;
        const { iconWidth, iconHeight } = computeIconDimensions(svg, markerScale);
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