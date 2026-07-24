import { memo, useCallback, useMemo, useState } from 'react';
import {
  groupObjectsByCountryAndTypeTree,
  makeTypeExpandKey,
  collectAllTypeExpandKeys,
} from '../../utils/targetTypeTree';

function toggleSetKey(setter, key) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

const ObjectRow = memo(function ObjectRow({ item, isSelected, onToggle }) {
  return (
    <label className="report-objects-picker__object">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onToggle(item.id, e.target.checked)}
      />
      <span className="report-objects-picker__object-title">{item.title}</span>
    </label>
  );
});

const TypeGroupNode = memo(function TypeGroupNode({
  node,
  countryKey,
  depth,
  expandedTypes,
  onToggleType,
  selectedSet,
  onTypeCheckbox,
  onObjectToggle,
}) {
  const typeKey = makeTypeExpandKey(countryKey, node.typeId);
  const isOpen = expandedTypes.has(typeKey);
  const typeItemIds = node.allItems.map((i) => i.id);
  const selectedInType = typeItemIds.filter((id) => selectedSet.has(id));
  const allInTypeSelected = typeItemIds.length > 0 && selectedInType.length === typeItemIds.length;
  const someInTypeSelected = selectedInType.length > 0 && !allInTypeSelected;

  return (
    <details
      className={`report-objects-picker__branch${depth > 0 ? ' report-objects-picker__branch--nested' : ''}`}
      style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}
      open={isOpen}
    >
      <summary
        className="report-objects-picker__branch-header"
        onClick={(e) => {
          if (e.target.tagName === 'INPUT') {
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          onToggleType(typeKey);
        }}
      >
        <input
          type="checkbox"
          checked={allInTypeSelected}
          ref={(el) => {
            if (el) el.indeterminate = someInTypeSelected;
          }}
          onChange={(e) => {
            e.stopPropagation();
            onTypeCheckbox(node.allItems, e.target.checked);
          }}
          aria-label={`Выбрать все объекты типа ${node.title}`}
        />
        <span className="report-objects-picker__branch-name">{node.title}</span>
        <span className="report-objects-picker__count">({typeItemIds.length})</span>
        {someInTypeSelected && (
          <span className="report-objects-picker__partial">({selectedInType.length} выбрано)</span>
        )}
      </summary>

      <div className="report-objects-picker__branch-objects">
        {node.items.map((item) => (
          <ObjectRow
            key={item.id}
            item={item}
            isSelected={selectedSet.has(item.id)}
            onToggle={onObjectToggle}
          />
        ))}
        {node.children.map((child) => (
          <TypeGroupNode
            key={child.typeId}
            node={child}
            countryKey={countryKey}
            depth={depth + 1}
            expandedTypes={expandedTypes}
            onToggleType={onToggleType}
            selectedSet={selectedSet}
            onTypeCheckbox={onTypeCheckbox}
            onObjectToggle={onObjectToggle}
          />
        ))}
      </div>
    </details>
  );
});

export default function ReportObjectsPicker({
  targets = [],
  targetTypes = [],
  selectedIds = [],
  onChange,
}) {
  const selectedSet = useMemo(() => {
    const set = new Set();
    (selectedIds || []).forEach((id) => {
      set.add(id);
      const n = Number(id);
      if (!Number.isNaN(n)) set.add(n);
      set.add(String(id));
    });
    return set;
  }, [selectedIds]);

  const countryTypeGroups = useMemo(
    () => groupObjectsByCountryAndTypeTree(targets, targetTypes),
    [targets, targetTypes],
  );

  const [expandedCountries, setExpandedCountries] = useState(() => new Set());
  const [expandedTypes, setExpandedTypes] = useState(() => new Set());

  const allCountryKeys = countryTypeGroups.map((g) => g.countryKey);

  const expandAll = () => {
    setExpandedCountries(new Set(allCountryKeys));
    setExpandedTypes(new Set(collectAllTypeExpandKeys(countryTypeGroups)));
  };

  const collapseAll = () => {
    setExpandedCountries(new Set());
    setExpandedTypes(new Set());
  };

  const emitIds = useCallback((ids) => {
    onChange?.(ids.map(String));
  }, [onChange]);

  const setMany = useCallback((items, checked) => {
    const next = new Set((selectedIds || []).map(String));
    items.forEach((item) => {
      const key = String(item.id);
      if (checked) next.add(key);
      else next.delete(key);
    });
    emitIds([...next]);
  }, [selectedIds, emitIds]);

  const handleObjectToggle = useCallback((id, checked) => {
    const key = String(id);
    const next = new Set((selectedIds || []).map(String));
    if (checked) next.add(key);
    else next.delete(key);
    emitIds([...next]);
  }, [selectedIds, emitIds]);

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    if (checked) {
      emitIds(targets.map((item) => String(item.id)));
    } else {
      emitIds([]);
    }
  };

  const dataIds = useMemo(() => targets.map((item) => item.id), [targets]);
  const isAllSelected = targets.length > 0 && dataIds.every((id) => selectedSet.has(id));

  const toggleCountry = (countryKey) => toggleSetKey(setExpandedCountries, countryKey);
  const toggleType = useCallback((typeKey) => toggleSetKey(setExpandedTypes, typeKey), []);

  if (!targets.length) {
    return <p className="report-status">Нет доступных объектов.</p>;
  }

  return (
    <div className="report-objects-picker">
      <div className="report-objects-picker__select-all">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={handleSelectAllChange}
          aria-label="Выбрать все видимые объекты"
        />
        <span>Выбрать все видимые ({targets.length})</span>
      </div>

      <div className="report-objects-picker__expand">
        <button type="button" className="report-objects-picker__expand-btn" onClick={expandAll}>
          Развернуть все
        </button>
        <button type="button" className="report-objects-picker__expand-btn" onClick={collapseAll}>
          Свернуть все
        </button>
      </div>

      <div className="report-objects-picker__countries">
        {countryTypeGroups.map(({ countryKey, country, typeNodes, orphanItems, allItems }) => {
          const countryItemIds = allItems.map((i) => i.id);
          const selectedInCountry = countryItemIds.filter((id) => selectedSet.has(id));
          const allInCountrySelected = allItems.length > 0 && selectedInCountry.length === allItems.length;
          const someInCountrySelected = selectedInCountry.length > 0 && !allInCountrySelected;
          const isCountryOpen = expandedCountries.has(countryKey);

          return (
            <details
              key={countryKey}
              className="report-objects-picker__country"
              open={isCountryOpen}
            >
              <summary
                className="report-objects-picker__country-header"
                onClick={(e) => {
                  if (e.target.tagName === 'INPUT') {
                    e.stopPropagation();
                    return;
                  }
                  e.preventDefault();
                  toggleCountry(countryKey);
                }}
              >
                <input
                  type="checkbox"
                  checked={allInCountrySelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someInCountrySelected;
                  }}
                  onChange={(e) => {
                    e.stopPropagation();
                    setMany(allItems, e.target.checked);
                  }}
                  aria-label={`Выбрать все объекты страны ${country}`}
                />
                <span className="report-objects-picker__country-name">{country}</span>
                <span className="report-objects-picker__count">({allItems.length})</span>
                {someInCountrySelected && (
                  <span className="report-objects-picker__partial">
                    ({selectedInCountry.length} выбрано)
                  </span>
                )}
              </summary>

              <div className="report-objects-picker__country-objects">
                {typeNodes.map((node) => (
                  <TypeGroupNode
                    key={node.typeId}
                    node={node}
                    countryKey={countryKey}
                    depth={0}
                    expandedTypes={expandedTypes}
                    onToggleType={toggleType}
                    selectedSet={selectedSet}
                    onTypeCheckbox={setMany}
                    onObjectToggle={handleObjectToggle}
                  />
                ))}

                {orphanItems.length > 0 && (
                  <details className="report-objects-picker__branch" open>
                    <summary className="report-objects-picker__branch-header">
                      <span className="report-objects-picker__branch-name">Без типа</span>
                      <span className="report-objects-picker__count">({orphanItems.length})</span>
                    </summary>
                    <div className="report-objects-picker__branch-objects">
                      {orphanItems.map((item) => (
                        <ObjectRow
                          key={item.id}
                          item={item}
                          isSelected={selectedSet.has(item.id)}
                          onToggle={handleObjectToggle}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
