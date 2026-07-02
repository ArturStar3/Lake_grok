import './DetailSections.css';

function NestedRowActions({ node, onFlyTo, onOpenDetails }) {
  const hasLocation = node.lat != null && node.lng != null;

  return (
    <div className="subordination-nested-row__actions">
      {hasLocation && (
        <button
          type="button"
          className="subordination-nested-row__action"
          onClick={(e) => {
            e.stopPropagation();
            onFlyTo?.(node);
          }}
          title="Перейти на карте"
          aria-label={`Перейти к ${node.title} на карте`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}
      <button
        type="button"
        className="subordination-nested-row__action subordination-nested-row__action--text"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails?.(node);
        }}
        title="Открыть подробную информацию"
      >
        Подробнее
      </button>
    </div>
  );
}

function NestedRowContent({ node, onFlyTo, onOpenDetails }) {
  return (
    <>
      <span className="subordination-nested-row__title">{node.title}</span>
      {node.label && <span className="subordination-nested-row__meta">({node.label})</span>}
      {node.type?.title && (
        <span className="subordination-nested-row__meta">— {node.type.title}</span>
      )}
      {(node.children_count || 0) > 0 && (
        <span className="subordination-nested-row__count">({node.children_count})</span>
      )}
      <NestedRowActions node={node} onFlyTo={onFlyTo} onOpenDetails={onOpenDetails} />
    </>
  );
}

export default function SubordinateNestedList({
  childIds = [],
  getNode,
  getNodeState,
  getChildIds,
  onToggleExpand,
  onFlyTo,
  onOpenDetails,
  depth = 0,
}) {
  if (!childIds.length) return null;

  return (
    <ul className="subordination-nested-list">
      {childIds.map((id) => {
        const node = getNode(id);
        if (!node) return null;

        const state = getNodeState(id) || {};
        const hasChildren = (node.children_count || 0) > 0;
        const nestedChildIds = getChildIds(id);

        if (!hasChildren) {
          return (
            <li key={id} className="subordination-nested-list__item">
              <div
                className="subordination-nested-row"
                style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}
              >
                <NestedRowContent
                  node={node}
                  onFlyTo={onFlyTo}
                  onOpenDetails={onOpenDetails}
                />
              </div>
            </li>
          );
        }

        return (
          <li key={id} className="subordination-nested-list__item">
            <details
              className={`subordination-nested-branch${depth > 0 ? ' subordination-nested-branch--nested' : ''}`}
              style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}
              open={state.expanded}
            >
              <summary
                className="subordination-nested-branch__header"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleExpand?.(node);
                }}
              >
                <NestedRowContent
                  node={node}
                  onFlyTo={onFlyTo}
                  onOpenDetails={onOpenDetails}
                />
              </summary>
              {state.loading && (
                <div className="subordination-nested-branch__loading">Загрузка...</div>
              )}
              {state.error && (
                <div className="subordination-nested-branch__error">{state.error}</div>
              )}
              {state.expanded && !state.loading && nestedChildIds.length > 0 && (
                <div className="subordination-nested-branch__children">
                  <SubordinateNestedList
                    childIds={nestedChildIds}
                    getNode={getNode}
                    getNodeState={getNodeState}
                    getChildIds={getChildIds}
                    onToggleExpand={onToggleExpand}
                    onFlyTo={onFlyTo}
                    onOpenDetails={onOpenDetails}
                    depth={depth + 1}
                  />
                </div>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
