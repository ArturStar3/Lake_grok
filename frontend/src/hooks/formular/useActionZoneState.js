import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { findAllIntersections } from '../../utils/circleIntersection';
import {
  buildActionZoneCatalog,
  buildGlobalActionTypeCatalog,
  filterObjectsForZones,
  getAllLeavesForActionType,
  getAllLeavesForCountry,
  hasEnabledZoneFilters,
} from '../../utils/buildVisibleZones';

const QUICK_SELECT_SEP = '\u0001';

function encodeQuickSelectLeaf(actionTypeId, leaf) {
  return `${String(actionTypeId)}${QUICK_SELECT_SEP}${leaf}`;
}

function encodeQuickSelectTriple(country, actionTypeId, leaf) {
  return `${country}${QUICK_SELECT_SEP}${actionTypeId}${QUICK_SELECT_SEP}${leaf}`;
}

function decodeQuickSelectTriple(key) {
  const parts = key.split(QUICK_SELECT_SEP);
  if (parts.length !== 3) return null;
  return {
    country: parts[0],
    actionTypeId: parts[1],
    leaf: parts[2],
  };
}

function cloneCountryFilters(countryFilters = {}) {
  const next = {};
  Object.entries(countryFilters).forEach(([actionTypeId, leafSet]) => {
    next[actionTypeId] = new Set(leafSet);
  });
  return next;
}

function buildFiltersFromCatalog(catalog, enableAll) {
  const next = {};
  Object.entries(catalog).forEach(([country, groups]) => {
    next[country] = {};
    if (!enableAll) return;
    groups.forEach((group) => {
      const actionTypeId = String(group.actionTypeId);
      next[country][actionTypeId] = new Set(getAllLeavesForActionType(group));
    });
  });
  return next;
}

function findActionTypeGroup(catalog, country, actionTypeId) {
  const groups = catalog[country];
  if (!groups) return null;
  return groups.find((g) => String(g.actionTypeId) === String(actionTypeId)) || null;
}

function syncFiltersWithCatalog(prev, catalog) {
  const next = {};
  let changed = false;

  Object.entries(catalog).forEach(([country, groups]) => {
    const prevCountry = prev[country] || {};
    const nextCountry = {};
    const validTypeIds = new Set(groups.map((g) => String(g.actionTypeId)));

    groups.forEach((group) => {
      const actionTypeId = String(group.actionTypeId);
      const validLeaves = new Set(getAllLeavesForActionType(group));
      const prevLeaves = prevCountry[actionTypeId] || new Set();
      const nextLeaves = new Set();
      prevLeaves.forEach((leaf) => {
        if (validLeaves.has(leaf)) nextLeaves.add(leaf);
      });
      if (nextLeaves.size !== prevLeaves.size) changed = true;
      nextCountry[actionTypeId] = nextLeaves;
    });

    Object.keys(prevCountry).forEach((actionTypeId) => {
      if (!validTypeIds.has(actionTypeId)) changed = true;
    });

    if (Object.keys(prevCountry).length !== Object.keys(nextCountry).length) changed = true;
    next[country] = nextCountry;
  });

  Object.keys(prev).forEach((country) => {
    if (!catalog[country]) changed = true;
  });

  if (!changed && Object.keys(prev).length === Object.keys(next).length) {
    const same = Object.entries(catalog).every(([country, groups]) => {
      const prevCountry = prev[country] || {};
      if (Object.keys(prevCountry).length !== groups.length) return false;
      return groups.every((group) => {
        const actionTypeId = String(group.actionTypeId);
        const prevLeaves = prevCountry[actionTypeId] || new Set();
        const validLeaves = getAllLeavesForActionType(group);
        return prevLeaves.size === validLeaves.length
          && validLeaves.every((leaf) => prevLeaves.has(leaf));
      });
    });
    if (same) return prev;
  }

  return next;
}

export function useActionZoneState(objects, { zonesActive = false } = {}) {
  const [actionZoneFilters, setActionZoneFilters] = useState({});
  const [showZoneIntersections, setShowZoneIntersections] = useState(false);
  const [selectedIntersections, setSelectedIntersections] = useState([]);
  const [quickSelectLeaves, setQuickSelectLeaves] = useState(() => new Set());
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

  const globalActionTypeCatalog = useMemo(
    () => buildGlobalActionTypeCatalog(actionZoneAvailableByCountry),
    [actionZoneAvailableByCountry],
  );

  const quickSelectCombo = useMemo(() => {
    const combo = new Set();
    quickSelectCountries.forEach((country) => {
      const groups = actionZoneAvailableByCountry[country] || [];
      groups.forEach((group) => {
        const actionTypeId = String(group.actionTypeId);
        getAllLeavesForActionType(group).forEach((leaf) => {
          if (quickSelectLeaves.has(encodeQuickSelectLeaf(actionTypeId, leaf))) {
            combo.add(encodeQuickSelectTriple(country, actionTypeId, leaf));
          }
        });
      });
    });
    return combo;
  }, [quickSelectLeaves, quickSelectCountries, actionZoneAvailableByCountry]);

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
    setActionZoneFilters((prev) => syncFiltersWithCatalog(prev, actionZoneAvailableByCountry));
  }, [actionZoneAvailableByCountry]);

  useEffect(() => {
    const validCountries = new Set(Object.keys(actionZoneAvailableByCountry));
    const validLeaves = new Set();
    globalActionTypeCatalog.forEach((group) => {
      const actionTypeId = String(group.actionTypeId);
      getAllLeavesForActionType(group).forEach((leaf) => {
        validLeaves.add(encodeQuickSelectLeaf(actionTypeId, leaf));
      });
    });

    setQuickSelectCountries((prev) => {
      const next = new Set([...prev].filter((c) => validCountries.has(c)));
      return next.size === prev.size ? prev : next;
    });

    setQuickSelectLeaves((prev) => {
      const next = new Set([...prev].filter((key) => validLeaves.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [actionZoneAvailableByCountry, globalActionTypeCatalog]);

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

        const enableLeaf = (country, actionTypeId, leaf) => {
          const group = findActionTypeGroup(actionZoneAvailableByCountry, country, actionTypeId);
          if (!group) return;
          const validLeaves = new Set(getAllLeavesForActionType(group));
          if (!validLeaves.has(leaf)) return;
          const countryFilters = cloneCountryFilters(next[country]);
          const leafSet = countryFilters[actionTypeId]
            ? new Set(countryFilters[actionTypeId])
            : new Set();
          if (leafSet.has(leaf)) return;
          leafSet.add(leaf);
          countryFilters[actionTypeId] = leafSet;
          next[country] = countryFilters;
          changed = true;
        };

        const disableLeaf = (country, actionTypeId, leaf) => {
          if (!next[country]?.[actionTypeId]?.has(leaf)) return;
          const countryFilters = cloneCountryFilters(next[country]);
          const leafSet = new Set(countryFilters[actionTypeId]);
          leafSet.delete(leaf);
          countryFilters[actionTypeId] = leafSet;
          next[country] = countryFilters;
          changed = true;
        };

        added.forEach((key) => {
          const triple = decodeQuickSelectTriple(key);
          if (!triple) return;
          enableLeaf(triple.country, triple.actionTypeId, triple.leaf);
        });

        removed.forEach((key) => {
          const triple = decodeQuickSelectTriple(key);
          if (!triple) return;
          disableLeaf(triple.country, triple.actionTypeId, triple.leaf);
        });

        return changed ? next : prev;
      });
    });

    appliedQuickSelectComboRef.current = new Set(nextCombo);
  }, [quickSelectCombo, actionZoneAvailableByCountry]);

  const toggleZoneLeaf = useCallback((country, actionTypeId, leaf) => {
    const typeKey = String(actionTypeId);
    startTransition(() => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        const countryFilters = cloneCountryFilters(next[country]);
        const leafSet = countryFilters[typeKey] ? new Set(countryFilters[typeKey]) : new Set();
        if (leafSet.has(leaf)) leafSet.delete(leaf);
        else leafSet.add(leaf);
        countryFilters[typeKey] = leafSet;
        next[country] = countryFilters;
        return next;
      });
    });
  }, []);

  const toggleAllForActionType = useCallback((country, group, shouldEnable) => {
    const typeKey = String(group.actionTypeId);
    const leaves = getAllLeavesForActionType(group);
    startTransition(() => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        const countryFilters = cloneCountryFilters(next[country]);
        countryFilters[typeKey] = shouldEnable ? new Set(leaves) : new Set();
        next[country] = countryFilters;
        return next;
      });
    });
  }, []);

  const toggleAllForCountry = useCallback((country, groups, shouldEnable) => {
    startTransition(() => {
      setActionZoneFilters((prev) => {
        const next = { ...prev };
        if (!shouldEnable) {
          next[country] = {};
          return next;
        }
        const countryFilters = {};
        groups.forEach((group) => {
          countryFilters[String(group.actionTypeId)] = new Set(getAllLeavesForActionType(group));
        });
        next[country] = countryFilters;
        return next;
      });
    });
  }, []);

  const resetZoneFilters = useCallback((enableAll) => {
    startTransition(() => {
      setActionZoneFilters(buildFiltersFromCatalog(actionZoneAvailableByCountry, enableAll));
    });
  }, [actionZoneAvailableByCountry]);

  const toggleQuickSelectLeaf = useCallback((actionTypeId, leaf) => {
    const key = encodeQuickSelectLeaf(actionTypeId, leaf);
    setQuickSelectLeaves((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllQuickSelectLeavesForType = useCallback((group, shouldEnable) => {
    const actionTypeId = String(group.actionTypeId);
    const leaves = getAllLeavesForActionType(group);
    setQuickSelectLeaves((prev) => {
      const next = new Set(prev);
      leaves.forEach((leaf) => {
        const key = encodeQuickSelectLeaf(actionTypeId, leaf);
        if (shouldEnable) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }, []);

  const setAllQuickSelectLeaves = useCallback((checked) => {
    if (!checked) {
      setQuickSelectLeaves(new Set());
      return;
    }
    const all = new Set();
    globalActionTypeCatalog.forEach((group) => {
      const actionTypeId = String(group.actionTypeId);
      getAllLeavesForActionType(group).forEach((leaf) => {
        all.add(encodeQuickSelectLeaf(actionTypeId, leaf));
      });
    });
    setQuickSelectLeaves(all);
  }, [globalActionTypeCatalog]);

  const toggleQuickSelectCountry = useCallback((country) => {
    setQuickSelectCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      return next;
    });
  }, []);

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
    globalActionTypeCatalog,
    quickSelectLeaves,
    quickSelectCountries,
    quickSelectCombo,
    intersections,
    selectedIntersections,
    toggleZoneLeaf,
    toggleAllForActionType,
    toggleAllForCountry,
    resetZoneFilters,
    toggleQuickSelectLeaf,
    toggleAllQuickSelectLeavesForType,
    setAllQuickSelectLeaves,
    toggleQuickSelectCountry,
    setAllQuickSelectCountries,
    handleIntersectionToggle,
    handleSelectAllIntersections,
    getAllLeavesForCountry,
  };
}
