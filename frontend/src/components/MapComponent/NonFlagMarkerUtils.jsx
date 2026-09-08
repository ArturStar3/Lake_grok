import { useEffect, useState, useMemo, useRef } from "react";
import { useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { processNonFlagClustering, computeCountryBubbleClusters, selectionIdsKey } from "./markerClusteringUtils";
import { filterNonFlagMarkers } from "../../utils/markerFilters";
import {
  createNonFlagDivIcon,
  createGroupCountDivIcon,
} from "../../utils/markerIconFactory";
import { resolveMediaUrl } from "../../utils/mediaUrl";

/**
 * Компонент для генерации иконок non-flag объектов с группировкой
 */
export default function NonFlagLabelGeneration({ objects, onMarkersReady, selectedIds = [], clusterMode = 'legacy' }) {
  const mapInstance = useMapEvents({});
  const [svgCache, setSvgCache] = useState(new Map());
  const loadedPathsRef = useRef(new Set());
  const loadingPathsRef = useRef(new Set());
  const lastNoneIdsKeyRef = useRef('');
  const [groupedObjects, setGroupedObjects] = useState([]);
  const [bubbleClusters, setBubbleClusters] = useState([]);
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

  const selectedNonFlagObjects = useMemo(
    () => filterNonFlagMarkers(objects, selectedIds),
    [objects, selectedIds],
  );

  const pathsKey = useMemo(() => {
    if (!selectedNonFlagObjects.length) return '';
    const uniquePaths = Array.from(new Set(selectedNonFlagObjects.map(o => resolveMediaUrl(o.marker?.path)).filter(Boolean)));
    return uniquePaths.sort().join('|');
  }, [selectedNonFlagObjects]);

  const clusterKey = useMemo(() => {
    if (!selectedNonFlagObjects.length) return '';
    const ids = selectionIdsKey(selectedNonFlagObjects);
    if (clusterMode === 'none') return `${ids}:none`;
    return `${ids}:${zoom}:${mapInstance?._size?.x || 0}:${mapInstance?._size?.y || 0}`;
  }, [selectedNonFlagObjects, zoom, mapInstance, clusterMode]);

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
    if (!clusterKey || !selectedNonFlagObjects.length) return;

    if (mapInstance && mapInstance._size) {
      if (clusterMode === 'none') {
        const idsKey = selectionIdsKey(selectedNonFlagObjects);
        if (idsKey === lastNoneIdsKeyRef.current) return;
        lastNoneIdsKeyRef.current = idsKey;
        setBubbleClusters((prev) => (prev.length ? [] : prev));
        setGroupedObjects(
          selectedNonFlagObjects.map((obj) => ({
            ...obj,
            isGrouped: false,
            isHidden: false,
            groupSize: 1,
            groupObjects: [obj],
          })),
        );
      } else if (clusterMode === 'bubble') {
        lastNoneIdsKeyRef.current = '';
        const { visible, bubbles } = computeCountryBubbleClusters(
          selectedNonFlagObjects,
          mapInstance,
        );
        setBubbleClusters(bubbles);
        setGroupedObjects(
          visible.map((obj) => ({
            ...obj,
            isGrouped: false,
            groupSize: 1,
            groupObjects: [obj],
          })),
        );
      } else {
        lastNoneIdsKeyRef.current = '';
        setBubbleClusters([]);
        const processed = processNonFlagClustering(selectedNonFlagObjects, mapInstance, selectedIds);
        setGroupedObjects(processed);
      }
    } else {
      setGroupedObjects(selectedNonFlagObjects);
      setBubbleClusters([]);
    }
  }, [clusterKey, selectedNonFlagObjects, selectedIds, mapInstance, clusterMode]);

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
      onMarkersReady({ iconsById, groupedObjects, svgCache, bubbles: bubbleClusters });
    } else if (!groupedObjects || groupedObjects.length === 0) {
      onMarkersReady({ iconsById: {}, groupedObjects: [], svgCache, bubbles: bubbleClusters });
    }
  }, [iconsById, groupedObjects, svgCache, bubbleClusters, onMarkersReady]);

  return null;
}
