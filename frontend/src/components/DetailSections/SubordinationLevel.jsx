import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SubordinateCard from './SubordinateCard';
import SubordinateNestedList from './SubordinateNestedList';
import './DetailSections.css';

function buildConnectorPaths(parentRect, childRects, containerRect) {
  if (!parentRect || !childRects.length) return [];

  const parentX = parentRect.left + parentRect.width / 2 - containerRect.left;
  const parentY = parentRect.bottom - containerRect.top;

  const childPoints = childRects.map((rect) => ({
    x: rect.left + rect.width / 2 - containerRect.left,
    y: rect.top - containerRect.top,
  }));

  const minX = Math.min(...childPoints.map((p) => p.x));
  const maxX = Math.max(...childPoints.map((p) => p.x));
  const midY = parentY + (childPoints[0].y - parentY) / 2;

  const paths = [
    `M ${parentX} ${parentY} L ${parentX} ${midY}`,
    `M ${minX} ${midY} L ${maxX} ${midY}`,
  ];

  childPoints.forEach((point) => {
    paths.push(`M ${point.x} ${midY} L ${point.x} ${point.y}`);
  });

  return paths;
}

function pathsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((path, index) => path === b[index]);
}

const FIRST_ROW_TOLERANCE_PX = 6;

function getFirstRowRects(childNodes, childRefs) {
  const entries = childNodes
    .map((child) => {
      const element = childRefs.current.get(child.id);
      if (!element) return null;
      return { rect: element.getBoundingClientRect() };
    })
    .filter(Boolean);

  if (!entries.length) return [];

  const firstRowTop = Math.min(...entries.map((entry) => entry.rect.top));
  return entries
    .filter((entry) => Math.abs(entry.rect.top - firstRowTop) <= FIRST_ROW_TOLERANCE_PX)
    .map((entry) => entry.rect);
}

export default function SubordinationLevel({
  parent = null,
  childNodes = [],
  isRoot = false,
  getNode,
  getNodeState,
  getChildIds,
  onToggleExpand,
  onFlyTo,
  onOpenDetails,
}) {
  const mainRef = useRef(null);
  const childrenRowRef = useRef(null);
  const parentRef = useRef(null);
  const childRefs = useRef(new Map());
  const [connectorPaths, setConnectorPaths] = useState([]);

  const childIdsKey = useMemo(
    () => childNodes.map((child) => child.id).join(','),
    [childNodes]
  );

  const layoutStateKey = useMemo(
    () => childNodes.map((child) => {
      const state = getNodeState?.(child.id) || {};
      return `${child.id}:${state.expanded ? 1 : 0}:${state.loading ? 1 : 0}`;
    }).join('|'),
    [childNodes, getNodeState]
  );

  const setChildRef = useCallback((id) => (el) => {
    if (el) {
      childRefs.current.set(id, el);
    } else {
      childRefs.current.delete(id);
    }
  }, []);

  const updateConnectors = useCallback(() => {
    const container = mainRef.current;
    if (!container || !parent || !childNodes.length) {
      setConnectorPaths((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const parentEl = parentRef.current;
    if (!parentEl) {
      setConnectorPaths((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const childRects = getFirstRowRects(childNodes, childRefs);
    if (!childRects.length) {
      setConnectorPaths((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const nextPaths = buildConnectorPaths(parentRect, childRects, containerRect);
    setConnectorPaths((prev) => (pathsEqual(prev, nextPaths) ? prev : nextPaths));
  }, [parent, childNodes]);

  const syncLayout = useCallback(() => {
    updateConnectors();
  }, [updateConnectors]);

  useLayoutEffect(() => {
    syncLayout();
    const container = mainRef.current;
    const row = childrenRowRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => {
      syncLayout();
    });
    observer.observe(container);
    if (row) {
      observer.observe(row);
    }

    return () => {
      observer.disconnect();
    };
  }, [syncLayout, childIdsKey, layoutStateKey]);

  const renderChildCard = (child) => {
    const state = getNodeState?.(child.id) || {};
    const canExpand = (child.children_count || 0) > 0;
    const nestedChildIds = getChildIds?.(child.id) || [];

    return (
      <div key={child.id} className="subordination-level__child-wrap">
        <SubordinateCard
          ref={setChildRef(child.id)}
          node={child}
          variant="child"
          isExpanded={state.expanded}
          isLoading={state.loading}
          canExpand={canExpand}
          onFlyTo={onFlyTo}
          onOpenDetails={onOpenDetails}
          onToggleExpand={onToggleExpand}
        />
        {state.expanded && !state.loading && nestedChildIds.length > 0 && (
          <SubordinateNestedList
            childIds={nestedChildIds}
            getNode={getNode}
            getNodeState={getNodeState}
            getChildIds={getChildIds}
            onToggleExpand={onToggleExpand}
            onFlyTo={onFlyTo}
            onOpenDetails={onOpenDetails}
          />
        )}
        {state.expanded && state.loading && (
          <p className="subordination-level__loading">Загрузка подчинённых...</p>
        )}
        {state.error && (
          <p className="subordination-level__error">{state.error}</p>
        )}
      </div>
    );
  };

  return (
    <div className={`subordination-level${isRoot ? ' subordination-level--root' : ''}`}>
      <div className="subordination-level__main" ref={mainRef}>
        {parent && connectorPaths.length > 0 && (
          <svg className="subordination-level__connectors" aria-hidden="true">
            {connectorPaths.map((d, index) => (
              <path key={index} d={d} className="subordination-level__connector" strokeWidth="2" />
            ))}
          </svg>
        )}

        {parent && isRoot && (
          <div className="subordination-level__parent">
            <SubordinateCard ref={parentRef} node={parent} variant="parent" />
          </div>
        )}

        {childNodes.length > 0 && (
          <div className="subordination-level__children-area">
            <div className="subordination-level__children-row" ref={childrenRowRef}>
              {childNodes.map((child) => renderChildCard(child))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
