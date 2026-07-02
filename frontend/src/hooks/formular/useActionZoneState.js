import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findAllIntersections } from '../../utils/circleIntersection';
import {
  buildActionZoneCatalog,
  filterObjectsForZones,
  hasEnabledZoneFilters,
} from '../../utils/buildVisibleZones';

export function useActionZoneState(objects) {
  const [actionZoneFilters, setActionZoneFilters] = useState({});
  const [showZoneIntersections, setShowZoneIntersections] = useState(false);
  const [selectedIntersections, setSelectedIntersections] = useState([]);
  const intersectionsInitialized = useRef(false);

  const hasEnabledZones = useMemo(
    () => hasEnabledZoneFilters(actionZoneFilters),
    [actionZoneFilters],
  );

  const actionZoneAvailableByCountry = useMemo(
    () => buildActionZoneCatalog(objects),
    [objects],
  );

  const intersections = useMemo(() => {
    if (!showZoneIntersections || !hasEnabledZones) return [];
    const visibleForIntersections = filterObjectsForZones(objects, actionZoneFilters);
    return findAllIntersections(visibleForIntersections);
  }, [showZoneIntersections, hasEnabledZones, objects, actionZoneFilters]);

  const intersectionsKey = useMemo(
    () => intersections.map((i) => i.id).sort().join('|'),
    [intersections],
  );

  useEffect(() => {
    if (!showZoneIntersections || !hasEnabledZones) {
      intersectionsInitialized.current = false;
      setSelectedIntersections([]);
      return;
    }

    if (intersections.length > 0 && !intersectionsInitialized.current) {
      setSelectedIntersections(intersections.map((i) => i.id));
      intersectionsInitialized.current = true;
    } else if (intersections.length > 0 && intersectionsInitialized.current) {
      setSelectedIntersections((prev) => {
        const currentIds = intersections.map((i) => i.id);
        return prev.filter((id) => currentIds.includes(id));
      });
    }
  }, [showZoneIntersections, hasEnabledZones, intersectionsKey, intersections]);

  useEffect(() => {
    if (Object.keys(actionZoneAvailableByCountry).length === 0) return;

    setActionZoneFilters((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.keys(actionZoneAvailableByCountry).forEach((c) => {
        if (!next[c]) {
          next[c] = new Set();
          changed = true;
        }
      });

      Object.keys(next).forEach((c) => {
        if (!actionZoneAvailableByCountry[c]) {
          delete next[c];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [actionZoneAvailableByCountry]);

  const toggleActionType = useCallback((country, actionTitle) => {
    setActionZoneFilters((prev) => {
      const next = { ...prev };
      const currentSet = next[country] ? new Set(next[country]) : new Set();
      if (currentSet.has(actionTitle)) currentSet.delete(actionTitle);
      else currentSet.add(actionTitle);
      next[country] = currentSet;
      return next;
    });
  }, []);

  const toggleAllForCountry = useCallback((country, allTypes, shouldEnable) => {
    setActionZoneFilters((prev) => {
      const next = { ...prev };
      next[country] = shouldEnable ? new Set(allTypes) : new Set();
      return next;
    });
  }, []);

  const resetZoneFilters = useCallback((enableAll) => {
    const next = {};
    Object.keys(actionZoneAvailableByCountry).forEach((c) => {
      next[c] = enableAll ? new Set(actionZoneAvailableByCountry[c]) : new Set();
    });
    setActionZoneFilters(next);
  }, [actionZoneAvailableByCountry]);

  const handleIntersectionToggle = useCallback((id) => {
    setSelectedIntersections((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const handleSelectAllIntersections = useCallback((checked) => {
    setSelectedIntersections(checked ? intersections.map((i) => i.id) : []);
  }, [intersections]);

  return {
    actionZoneFilters,
    showZoneIntersections,
    setShowZoneIntersections,
    hasEnabledZones,
    actionZoneAvailableByCountry,
    intersections,
    selectedIntersections,
    toggleActionType,
    toggleAllForCountry,
    resetZoneFilters,
    handleIntersectionToggle,
    handleSelectAllIntersections,
  };
}
