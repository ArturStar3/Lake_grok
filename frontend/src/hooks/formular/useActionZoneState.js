import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { findAllIntersections } from '../../utils/circleIntersection';
import {
  buildActionZoneCatalog,
  filterObjectsForZones,
  hasEnabledZoneFilters,
} from '../../utils/buildVisibleZones';

export function useActionZoneState(objects, { zonesActive = false } = {}) {
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

  const deferredFilters = useDeferredValue(actionZoneFilters);
  const intersectionsEnabled = zonesActive && showZoneIntersections && hasEnabledZones;

  const intersections = useMemo(() => {
    if (!intersectionsEnabled) return [];
    const visibleForIntersections = filterObjectsForZones(objects, deferredFilters);
    return findAllIntersections(visibleForIntersections);
  }, [intersectionsEnabled, objects, deferredFilters]);

  const intersectionsKey = useMemo(
    () => intersections.map((i) => i.id).sort().join('|'),
    [intersections],
  );

  useEffect(() => {
    if (!intersectionsEnabled) {
      intersectionsInitialized.current = false;
      setSelectedIntersections([]);
      return;
    }

    if (intersections.length > 0 && !intersectionsInitialized.current) {
      startTransition(() => {
        setSelectedIntersections(intersections.map((i) => i.id));
      });
      intersectionsInitialized.current = true;
    } else if (intersections.length > 0 && intersectionsInitialized.current) {
      startTransition(() => {
        setSelectedIntersections((prev) => {
          const currentIds = intersections.map((i) => i.id);
          return prev.filter((id) => currentIds.includes(id));
        });
      });
    }
  }, [intersectionsEnabled, intersectionsKey, intersections]);

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
    startTransition(() => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        const currentSet = next[country] ? new Set(next[country]) : new Set();
        if (currentSet.has(actionTitle)) currentSet.delete(actionTitle);
        else currentSet.add(actionTitle);
        next[country] = currentSet;
        return next;
      });
    });
  }, []);

  const toggleAllForCountry = useCallback((country, allTypes, shouldEnable) => {
    startTransition(() => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        next[country] = shouldEnable ? new Set(allTypes) : new Set();
        return next;
      });
    });
  }, []);

  const resetZoneFilters = useCallback((enableAll) => {
    startTransition(() => {
      const next = {};
      Object.keys(actionZoneAvailableByCountry).forEach((c) => {
        next[c] = enableAll ? new Set(actionZoneAvailableByCountry[c]) : new Set();
      });
      setActionZoneFilters(next);
    });
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
