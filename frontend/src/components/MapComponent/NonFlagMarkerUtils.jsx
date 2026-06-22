import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { processNonFlagClustering, getGroupCirclePositions } from "./markerClusteringUtils";
import { enrichSvg } from "../../utils/svgUtils";
import { getViewBoxSize } from "../../utils/svgUtils";
import { MAP_CONSTANTS } from "../../constants/mapConstants";
import { filterNonFlagMarkers } from "../../utils/markerFilters";

const { ICON_WIDTH, ICON_HEIGHT } = MAP_CONSTANTS;

/** Ширина/высота иконки с учётом scale и пропорций viewBox SVG */
function computeNonFlagIconSize(svg, markerScale) {
  let iconWidth = ICON_WIDTH * markerScale;
  let iconHeight = ICON_HEIGHT * markerScale;
  const vb = getViewBoxSize(svg);
  if (vb && vb.width > 0) {
    const aspect = vb.height / vb.width;
    iconHeight = iconWidth * aspect;
  }
  return { iconWidth, iconHeight };
}

/**
 * Компонент для генерации иконок non-flag объектов с группировкой
 */
export default function NonFlagLabelGeneration({ objects, onMarkersReady, selectedIds = [] }) {
  const mapInstance = useMapEvents({});
  const [svgCache, setSvgCache] = useState(new Map());
  const loadedPathsRef = useRef(new Set()); // Отслеживание загруженных путей
  const loadingPathsRef = useRef(new Set()); // Отслеживание текущих загрузок
  const [groupedObjects, setGroupedObjects] = useState([]);
  const [zoom, setZoom] = useState(mapInstance?.getZoom?.() || 0);

  const [zoom2, setZoom2] = useState(mapInstance?.getZoom?.() || 0);

  useEffect(() => {
    if (!mapInstance) return;
    
    // Use zoomend (not continuous 'zoom') to avoid triggering heavy clustering
    // on every tick of flyTo / animated zoom/pan which was causing the map to hang.
    const handleZoomEnd = () => {
      setZoom(mapInstance.getZoom());
    };
    
    mapInstance.on('zoomend', handleZoomEnd);
    setZoom(mapInstance.getZoom?.() || 0);
    
    return () => mapInstance.off('zoomend', handleZoomEnd);
  }, [mapInstance]);

  // Мемоизируем строку путей для стабильных зависимостей
  const pathsKey = useMemo(() => {
    if (!objects || !Array.isArray(objects) || objects.length === 0) return '';
    
    const selectedNonFlagObjects = filterNonFlagMarkers(objects, selectedIds);
    
    const uniquePaths = Array.from(new Set(selectedNonFlagObjects.map(o => o.marker?.path).filter(Boolean)));
    return uniquePaths.sort().join('|');
  }, [objects, selectedIds]);

  // Мемоизируем ключ для кластеризации
  const clusterKey = useMemo(() => {
    if (!objects || !Array.isArray(objects) || objects.length === 0) return '';
    
    const selectedNonFlagObjects = filterNonFlagMarkers(objects, selectedIds);
    
    // Создаем ключ из ID объектов + marker.id (чтобы при смене маркера пересоздавалась иконка) + zoom
    const ids = selectedNonFlagObjects.map(o => `${o.id}:${o.marker?.id || 'none'}`).sort().join(',');
    return `${ids}:${zoom}:${mapInstance?._size?.x || 0}:${mapInstance?._size?.y || 0}`;
  }, [objects, selectedIds, zoom, mapInstance]);

  // Отдельный useEffect для загрузки SVG
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
                    console.warn("Не удалось загрузить SVG для non-flag:", path, err);
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
    if (!clusterKey || !objects || !Array.isArray(objects) || objects.length === 0) return;
    
    const selectedNonFlagObjects = filterNonFlagMarkers(objects, selectedIds);

    if (mapInstance && mapInstance._size) {
      const processed = processNonFlagClustering(selectedNonFlagObjects, mapInstance, selectedIds);
      setGroupedObjects(processed);
    } else {
      setGroupedObjects(selectedNonFlagObjects);
    }
  }, [clusterKey]);

  // Создаем иконки для non-flag объектов
  const iconsById = useMemo(() => {
    if (!L || !L.DivIcon) {
      console.warn("L.DivIcon недоступен");
      return {};
    }

    const map = {};

    // Отфильтровываем только видимые объекты (не скрытые за группой)
    const visibleObjects = groupedObjects.filter(obj => !obj.isHidden);

    visibleObjects.forEach((obj) => {
      if (!obj.isGrouped) {
        // Одиночный объект - используем SVG иконку
        const markerScale = parseFloat(obj.marker?.scale) || 1;
        const markerColor = obj.country?.color || "blue";

        // Получаем SVG из кэша если есть
        const path = obj.marker?.path;
        const svg = path ? svgCache.get(path) ?? "" : "";

        const { iconWidth, iconHeight } = computeNonFlagIconSize(svg, markerScale);

        const enrichedSvg = enrichSvg(svg, iconWidth, iconHeight, obj.id, markerColor);

        const html = `
          <div class="non-flag-marker" data-id="${obj.id}">
            ${enrichedSvg || `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="${iconWidth}" height="${iconHeight}">
              <circle cx="25" cy="25" r="22" fill="${markerColor}" opacity="0.8" stroke="#FFFFFF" stroke-width="2"/>
            </svg>`}
          </div>
        `;

        map[obj.id] = new L.DivIcon({
          html,
          className: "non-flag-div-icon",
          iconSize: [iconWidth, iconHeight],
          iconAnchor: [iconWidth / 2, iconHeight / 2]
        });
      } else if (obj.isGroupIcon) {
        // Группировка - иконка с числом скрытых элементов
        const groupSize = obj.groupSize;
        const groupIconSize = 35;
        const html = `
          <div class="group-marker" data-group-id="${obj.groupId}" data-size="${groupSize}">
            <svg viewBox="0 0 35 35" xmlns="http://www.w3.org/2000/svg" width="${groupIconSize}" height="${groupIconSize}">
              <circle cx="17.5" cy="17.5" r="15" fill="#FF6B6B" opacity="0.9" stroke="#FFFFFF" stroke-width="2"/>
              <circle cx="12" cy="12" r="3" fill="#FFFFFF" opacity="0.7"/>
              <circle cx="23" cy="12" r="3" fill="#FFFFFF" opacity="0.7"/>
              <circle cx="17.5" cy="21" r="3" fill="#FFFFFF" opacity="0.7"/>
              <text x="17.5" y="17.5" text-anchor="middle" dy="0.3em" font-size="14" fill="white" font-weight="bold">${groupSize}</text>
            </svg>
          </div>
        `;

        map[obj.groupId] = new L.DivIcon({
          html,
          className: "group-div-icon",
          iconSize: [groupIconSize, groupIconSize],
          iconAnchor: [groupIconSize / 2, groupIconSize / 2]
        });
      }
    });

    // Создаём иконки и для скрытых объектов в группе (для отображения в круге при наведении)
    groupedObjects.forEach((obj) => {
      if (obj.isGrouped && !obj.isGroupIcon) {
        // Скрытый объект в группе - создаём для него иконку
        if (map[obj.id]) {
          console.log(`Icon for ${obj.id} already exists, skipping`);
          return;
        }

        const markerScale = parseFloat(obj.marker?.scale) || 1;
        const markerColor = obj.country?.color || "blue";
        
        // Получаем SVG из кэша если есть
        const path = obj.marker?.path;
        const svg = path ? svgCache.get(path) ?? "" : "";
        const { iconWidth, iconHeight } = computeNonFlagIconSize(svg, markerScale);
        
        const enrichedSvg = enrichSvg(svg, iconWidth, iconHeight, obj.id, markerColor);

        const html = `
          <div class="non-flag-marker" data-id="${obj.id}">
            ${enrichedSvg || `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="${iconWidth}" height="${iconHeight}">
              <circle cx="25" cy="25" r="22" fill="${markerColor}" opacity="0.8" stroke="#FFFFFF" stroke-width="2"/>
            </svg>`}
          </div>
        `;

        map[obj.id] = new L.DivIcon({
          html,
          className: "non-flag-div-icon",
          iconSize: [iconWidth, iconHeight],
          iconAnchor: [iconWidth / 2, iconHeight / 2]
        });
      }
    });

    // Создаём иконки для главных объектов групп (для отображения в круге при наведении)
    groupedObjects.forEach((obj) => {
      if (obj.isGroupIcon && !map[obj.id]) {
        // Главный объект группы - создаём для него иконку для круга при hover
        const markerScale = parseFloat(obj.marker?.scale) || 1;
        const markerColor = obj.country?.color || "blue";
        
        // Получаем SVG из кэша если есть
        const path = obj.marker?.path;
        const svg = path ? svgCache.get(path) ?? "" : "";
        const { iconWidth, iconHeight } = computeNonFlagIconSize(svg, markerScale);
        
        const enrichedSvg = enrichSvg(svg, iconWidth, iconHeight, obj.id, markerColor);

        const html = `
          <div class="non-flag-marker" data-id="${obj.id}">
            ${enrichedSvg || `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" width="${iconWidth}" height="${iconHeight}">
              <circle cx="25" cy="25" r="22" fill="${markerColor}" opacity="0.8" stroke="#FFFFFF" stroke-width="2"/>
            </svg>`}
          </div>
        `;

        map[obj.id] = new L.DivIcon({
          html,
          className: "non-flag-div-icon",
          iconSize: [iconWidth, iconHeight],
          iconAnchor: [iconWidth / 2, iconHeight / 2]
        });
      }
    });

    return map;
  }, [groupedObjects, svgCache]);

  // Вызываем callback когда иконки готовы
  useEffect(() => {
    if (!onMarkersReady) return;
    if (Object.keys(iconsById).length > 0) {
      onMarkersReady({ iconsById, groupedObjects });
    } else if (!groupedObjects || groupedObjects.length === 0) {
      onMarkersReady({ iconsById: {}, groupedObjects: [] });
    }
  }, [iconsById, groupedObjects, onMarkersReady]);

  return null;
}
