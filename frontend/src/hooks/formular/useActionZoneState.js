import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { findAllIntersections } from '../../utils/circleIntersection';
import {
  buildActionZoneCatalog,
  filterObjectsForZones,
  getAllLeavesForActionType,
  getAllLeavesForCountry,
  hasEnabledZoneFilters,
} from '../../utils/buildVisibleZones';

const QUICK_SELECT_PAIR_SEP = '\u0001';

function encodeQuickSelectPair(country, actionTypeId) {
  return `${country}${QUICK_SELECT_PAIR_SEP}${actionTypeId}`;
}

function decodeQuickSelectPair(key) {
  const idx = key.indexOf(QUICK_SELECT_PAIR_SEP);
  if (idx === -1) return null;
  return {
    country: key.slice(0, idx),
    actionTypeId: key.slice(idx + QUICK_SELECT_PAIR_SEP.length),
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

function countryHasActionType(catalog, country, actionTypeId) {
  return Boolean(findActionTypeGroup(catalog, country, actionTypeId));
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
    const byId = new Map();
    Object.values(actionZoneAvailableByCountry).forEach((groups) => {
      groups.forEach((group) => {
        const id = String(group.actionTypeId);
        if (!byId.has(id)) {
          byId.set(id, {
            actionTypeId: id,
            actionTypeTitle: group.actionTypeTitle,
          });
        }
      });
    });
    return Array.from(byId.values())
      .sort((a, b) => a.actionTypeTitle.localeCompare(b.actionTypeTitle, 'ru'));
  }, [actionZoneAvailableByCountry]);

  const quickSelectCombo = useMemo(() => {
    const combo = new Set();
    quickSelectCountries.forEach((country) => {
      quickSelectTypes.forEach((actionTypeId) => {
        if (countryHasActionType(actionZoneAvailableByCountry, country, actionTypeId)) {
          combo.add(encodeQuickSelectPair(country, actionTypeId));
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
    setActionZoneFilters((prev) => syncFiltersWithCatalog(prev, actionZoneAvailableByCountry));
  }, [actionZoneAvailableByCountry]);

  useEffect(() => {
    const validCountries = new Set(Object.keys(actionZoneAvailableByCountry));
    const validTypeIds = new Set(allActionTypes.map((t) => t.actionTypeId));

    setQuickSelectCountries((prev) => {
      const next = new Set([...prev].filter((c) => validCountries.has(c)));
      return next.size === prev.size ? prev : next;
    });

    setQuickSelectTypes((prev) => {
      const next = new Set([...prev].filter((id) => validTypeIds.has(id)));
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

        const enableLeaves = (country, actionTypeId) => {
          const group = findActionTypeGroup(actionZoneAvailableByCountry, country, actionTypeId);
          if (!group) return;
          const countryFilters = cloneCountryFilters(next[country]);
          countryFilters[actionTypeId] = new Set(getAllLeavesForActionType(group));
          next[country] = countryFilters;
          changed = true;
        };

        const disableLeaves = (country, actionTypeId) => {
          if (!next[country]?.[actionTypeId]) return;
          const countryFilters = cloneCountryFilters(next[country]);
          countryFilters[actionTypeId] = new Set();
          next[country] = countryFilters;
          changed = true;
        };

        added.forEach((key) => {
          const pair = decodeQuickSelectPair(key);
          if (!pair) return;
          enableLeaves(pair.country, pair.actionTypeId);
        });

        removed.forEach((key) => {
          const pair = decodeQuickSelectPair(key);
          if (!pair) return;
          disableLeaves(pair.country, pair.actionTypeId);
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

  const toggleQuickSelectType = useCallback((actionTypeId) => {
    const id = String(actionTypeId);
    setQuickSelectTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    setQuickSelectTypes(
      checked ? new Set(allActionTypes.map((t) => t.actionTypeId)) : new Set(),
    );
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
    toggleZoneLeaf,
    toggleAllForActionType,
    toggleAllForCountry,
    resetZoneFilters,
    toggleQuickSelectType,
    toggleQuickSelectCountry,
    setAllQuickSelectTypes,
    setAllQuickSelectCountries,
    handleIntersectionToggle,
    handleSelectAllIntersections,
    getAllLeavesForCountry,
  };
}
