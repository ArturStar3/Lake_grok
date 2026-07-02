import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../config/api';
import SubordinationLevel from './SubordinationLevel';
import './DetailSections.css';

function createNodeState(node) {
  return {
    node,
    children: [],
    expanded: false,
    loading: false,
    loaded: false,
    error: null,
  };
}

export default function SubordinationTree({
  parent,
  subordinates = [],
  onSubordinateFlyTo,
  onSubordinateOpenDetails,
  hideTitle = false,
}) {
  const [nodesById, setNodesById] = useState({});

  const subordinateIds = useMemo(
    () => subordinates.map((item) => item.id).join(','),
    [subordinates]
  );

  useEffect(() => {
    const next = {};
    if (parent?.id) {
      next[parent.id] = {
        ...createNodeState(parent),
        children: subordinates.map((item) => item.id),
        loaded: true,
      };
    }
    subordinates.forEach((item) => {
      next[item.id] = createNodeState(item);
    });
    setNodesById(next);
  }, [parent?.id, parent?.title, parent?.label, parent?.children_count, subordinateIds, subordinates]);

  const rootChildren = useMemo(() => {
    if (!parent?.id) return subordinates;
    return (nodesById[parent.id]?.children || [])
      .map((id) => nodesById[id]?.node)
      .filter(Boolean);
  }, [parent, subordinates, nodesById]);

  const getNode = useCallback(
    (id) => nodesById[id]?.node ?? null,
    [nodesById]
  );

  const getChildIds = useCallback(
    (id) => nodesById[id]?.children || [],
    [nodesById]
  );

  const getNodeState = useCallback(
    (id) => {
      const entry = nodesById[id];
      if (!entry) return {};
      return {
        expanded: entry.expanded,
        loading: entry.loading,
        loaded: entry.loaded,
        error: entry.error,
      };
    },
    [nodesById]
  );

  const loadChildren = useCallback(async (nodeId) => {
    setNodesById((prev) => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        loading: true,
        error: null,
      },
    }));

    try {
      const response = await fetch(`${API_URL}/api/v1/formular/${nodeId}/`);
      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }
      const result = await response.json();
      const children = Array.isArray(result) ? [] : result.subordinates || [];

      setNodesById((prev) => {
        const next = { ...prev };
        children.forEach((child) => {
          if (!next[child.id]) {
            next[child.id] = createNodeState(child);
          }
        });
        next[nodeId] = {
          ...next[nodeId],
          children: children.map((child) => child.id),
          loading: false,
          loaded: true,
          expanded: true,
          error: null,
        };
        return next;
      });
    } catch (err) {
      setNodesById((prev) => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          loading: false,
          error: err.message || 'Не удалось загрузить подчинённых',
        },
      }));
    }
  }, []);

  const handleToggleExpand = useCallback(
    (node) => {
      const entry = nodesById[node.id];
      if (!entry) return;

      if (entry.expanded) {
        setNodesById((prev) => ({
          ...prev,
          [node.id]: {
            ...prev[node.id],
            expanded: false,
          },
        }));
        return;
      }

      if (entry.loaded) {
        setNodesById((prev) => ({
          ...prev,
          [node.id]: {
            ...prev[node.id],
            expanded: true,
          },
        }));
        return;
      }

      loadChildren(node.id);
    },
    [nodesById, loadChildren]
  );

  if (!parent && !subordinates.length) return null;

  return (
    <section className="subordination-tree">
      {!hideTitle && (
        <h3 className="subordination-tree__title">
          Непосредственно подчинённые подразделения ({subordinates.length})
        </h3>
      )}
      <SubordinationLevel
        parent={parent}
        childNodes={rootChildren}
        isRoot
        getNode={getNode}
        getNodeState={getNodeState}
        getChildIds={getChildIds}
        onToggleExpand={handleToggleExpand}
        onFlyTo={onSubordinateFlyTo}
        onOpenDetails={onSubordinateOpenDetails}
      />
    </section>
  );
}
