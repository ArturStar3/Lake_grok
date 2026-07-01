import { useEffect, useState, useMemo, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { processNonFlagClustering } from "./markerClusteringUtils";
import { MAP_CONSTANTS } from "../../constants/mapConstants";
import { filterNonFlagMarkers } from "../../utils/markerFilters";
import {
  createNonFlagDivIcon,
  createGroupCountDivIcon,
} from "../../utils/markerIconFactory";

const { ICON_WIDTH, ICON_HEIGHT } = MAP_CONSTANTS;

/**
 * Компонент для генерации иконок non-flag объектов с группировкой
 */
export default function NonFlagLabelGeneration({ objects, onMarkersReady, selectedIds = [] }) {
  const mapInstance = useMapEvents({});
  const [svgCache, setSvgCache] = useState(new Map());
  const loadedPathsRef = useRef(new Set());
  const loadingPathsRef = useRef(new Set());
  const [groupedObjects, setGroupedObjects] = useState([]);
  const [zoom, setZoom] = useState(mapInstance?.getZoom?.() || 0);

  useEffect(() => {
    if (!mapInstance) return;

    const handleZoomEnd = () => {
      setZoom(mapInstance.getZoom());
    };

    mapInstance.on('zoomend', handleZoomEnd);
    setZoom(mapInstance.getZoom?.() || 0);

    return () => mapInstance.off('zoomend', handleZoomEnd);
  }, [mapInstance]);

  const pathsKey = useMemo(() => {
    if (!objects || !Array.isArray(objects) || objects.length === 0) return '';

    const selectedNonFlagObjects = filterNonFlagMarkers(objects, selectedIds);

    const uniquePaths = Array.from(new Set(selectedNonFlagObjects.map(o => o.marker?.path).filter(Boolean)));
    return uniquePaths.sort().join('|');
  }, [objects, selectedIds]);

  const clusterKey = useMemo(() => {
    if (!objects || !Array.isArray(objects) || objects.length === 0) return '';

    const selectedNonFlagObjects = filterNonFlagMarkers(objects, selectedIds);

    const ids = selectedNonFlagObjects.map(o => `${o.id}:${o.marker?.id || 'none'}`).sort().join(',');
    return `${ids}:${zoom}:${mapInstance?._size?.x || 0}:${mapInstance?._size?.y || 0}`;
  }, [objects, selectedIds, zoom, mapInstance]);

  useEffect(() => {
    if (!pathsKey) return;

    const paths = pathsKey.split('|').filter(Boolean);
    const pathsToLoad = paths.filter(path =>
      !loadedPathsRef.current.has(path) && !loadingPathsRef.current.has(path)
    );

    if (pathsToLoad.length === 0) return;

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

  useEffect(() => {
    if (!clusterKey || !objects || !Array.isArray(objects) || objects.length === 0) return;

    const selectedNonFlagObjects = filterNonFlagMarkers(objects, selectedIds);

    if (mapInstance && mapInstance._size) {
      const processed = processNonFlagClustering(selectedNonFlagObjects, mapInstance, selectedIds);
      setGroupedObjects(processed);
    } else {
      setGroupedObjects(selectedNonFlagObjects);
    }
  }, [clusterKey, objects, selectedIds, mapInstance]);

  const iconsById = useMemo(() => {
    if (!L || !L.DivIcon) {
      console.warn("L.DivIcon недоступен");
      return {};
    }

    const map = {};

    const visibleObjects = groupedObjects.filter(obj => !obj.isHidden);

    visibleObjects.forEach((obj) => {
      if (!obj.isGrouped) {
        const icon = createNonFlagDivIcon(obj, svgCache);
        if (icon) map[obj.id] = icon;
      } else if (obj.isGroupIcon) {
        map[obj.groupId] = createGroupCountDivIcon(obj.groupId, obj.groupSize);
      }
    });

    return map;
  }, [groupedObjects, svgCache]);

  useEffect(() => {
    if (!onMarkersReady) return;
    if (Object.keys(iconsById).length > 0) {
      onMarkersReady({ iconsById, groupedObjects, svgCache });
    } else if (!groupedObjects || groupedObjects.length === 0) {
      onMarkersReady({ iconsById: {}, groupedObjects: [], svgCache });
    }
  }, [iconsById, groupedObjects, svgCache, onMarkersReady]);

  return null;
}
