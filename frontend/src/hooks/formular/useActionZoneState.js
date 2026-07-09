import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { findAllIntersections } from '../../utils/circleIntersection';
import {
  buildActionZoneCatalog,
  filterObjectsForZones,
  hasEnabledZoneFilters,
} from '../../utils/buildVisibleZones';

const QUICK_SELECT_PAIR_SEP = '\u0001';

function encodeQuickSelectPair(country, type) {
  return `${country}${QUICK_SELECT_PAIR_SEP}${type}`;
}

function decodeQuickSelectPair(key) {
  const idx = key.indexOf(QUICK_SELECT_PAIR_SEP);
  if (idx === -1) return null;
  return {
    country: key.slice(0, idx),
    type: key.slice(idx + QUICK_SELECT_PAIR_SEP.length),
  };
}

export function useActionZoneState(objects, { zonesActive = false } = {}) {
  const [actionZoneFilters, setActionZoneFilters] = useState({});
  const [showZoneIntersections, setShowZoneIntersections] = useState(false);
  const [selectedIntersections, setSelectedIntersections] = useState([]);
  const [quickSelectTypes, setQuickSelectTypes] = useState(() => new Set());
  const [quickSelectCountries, setQuickSelectCountries] = useState(() => new Set());
  const intersectionsInitialized = useRef(false);
  const appliedQuickSelectComboRef = useRef(new Set());

  const hasEnabledZones = useMemo(
    () => hasEnabledZoneFilters(actionZoneFilters),
    [actionZoneFilters],
  );

  const actionZoneAvailableByCountry = useMemo(
    () => buildActionZoneCatalog(objects),
    [objects],
  );

  const allActionTypes = useMemo(() => {
    const types = new Set();
    Object.values(actionZoneAvailableByCountry).forEach((typeSet) => {
      typeSet.forEach((t) => types.add(t));
    });
    return Array.from(types).sort();
  }, [actionZoneAvailableByCountry]);

  const quickSelectCombo = useMemo(() => {
    const combo = new Set();
    quickSelectCountries.forEach((country) => {
      const available = actionZoneAvailableByCountry[country];
      if (!available) return;
      quickSelectTypes.forEach((type) => {
        if (available.has(type)) {
          combo.add(encodeQuickSelectPair(country, type));
        }
      });
    });
    return combo;
  }, [quickSelectTypes, quickSelectCountries, actionZoneAvailableByCountry]);

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

  useEffect(() => {
    const validCountries = new Set(Object.keys(actionZoneAvailableByCountry));
    const validTypes = new Set(allActionTypes);

    setQuickSelectCountries((prev) => {
      const next = new Set([...prev].filter((c) => validCountries.has(c)));
      return next.size === prev.size ? prev : next;
    });

    setQuickSelectTypes((prev) => {
      const next = new Set([...prev].filter((t) => validTypes.has(t)));
      return next.size === prev.size ? prev : next;
    });
  }, [actionZoneAvailableByCountry, allActionTypes]);

  useEffect(() => {
    const prevCombo = appliedQuickSelectComboRef.current;
    const nextCombo = quickSelectCombo;

    const added = [...nextCombo].filter((key) => !prevCombo.has(key));
    const removed = [...prevCombo].filter((key) => !nextCombo.has(key));

    if (added.length === 0 && removed.length === 0) return;

    startTransition(() => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        let changed = false;

        added.forEach((key) => {
          const pair = decodeQuickSelectPair(key);
          if (!pair) return;
          const currentSet = next[pair.country] ? new Set(next[pair.country]) : new Set();
          if (!currentSet.has(pair.type)) {
            currentSet.add(pair.type);
            next[pair.country] = currentSet;
            changed = true;
          }
        });

        removed.forEach((key) => {
          const pair = decodeQuickSelectPair(key);
          if (!pair || !next[pair.country]) return;
          const currentSet = new Set(next[pair.country]);
          if (currentSet.has(pair.type)) {
            currentSet.delete(pair.type);
            next[pair.country] = currentSet;
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    });

    appliedQuickSelectComboRef.current = new Set(nextCombo);
  }, [quickSelectCombo]);

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

  const toggleQuickSelectType = useCallback((type) => {
    setQuickSelectTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleQuickSelectCountry = useCallback((country) => {
    setQuickSelectCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }, []);

  const setAllQuickSelectTypes = useCallback((checked) => {
    setQuickSelectTypes(checked ? new Set(allActionTypes) : new Set());
  }, [allActionTypes]);

  const setAllQuickSelectCountries = useCallback((checked) => {
    const countries = Object.keys(actionZoneAvailableByCountry);
    setQuickSelectCountries(checked ? new Set(countries) : new Set());
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
    allActionTypes,
    quickSelectTypes,
    quickSelectCountries,
    quickSelectCombo,
    intersections,
    selectedIntersections,
    toggleActionType,
    toggleAllForCountry,
    resetZoneFilters,
    toggleQuickSelectType,
    toggleQuickSelectCountry,
    setAllQuickSelectTypes,
    setAllQuickSelectCountries,
    handleIntersectionToggle,
    handleSelectAllIntersections,
  };
}
