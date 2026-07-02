import { forwardRef } from 'react';
import './DetailSections.css';

const SubordinateCard = forwardRef(function SubordinateCard(
  {
    node,
    variant = 'child',
    isExpanded = false,
    isLoading = false,
    canExpand = false,
    onFlyTo,
    onOpenDetails,
    onToggleExpand,
  },
  ref
) {
  if (!node) {
    return <article ref={ref} className="subordination-card subordination-card--empty" />;
  }

  const isParent = variant === 'parent';
  const typeTitle = node.type?.title;
  const showType = typeTitle && !node.title?.includes(typeTitle);
  const hasLocation = node.lat != null && node.lng != null;

  return (
    <article
      ref={ref}
      className={`subordination-card${isParent ? ' subordination-card--parent' : ''}${
        isExpanded ? ' subordination-card--expanded' : ''
      }`}
      data-node-id={node.id}
    >
      <div className="subordination-card__header">
        <div className="subordination-card__titles">
          <p className="subordination-card__title">{node.title}</p>
          {!isParent && (node.children_count || 0) > 0 && (
            <span className="subordination-card__badge">
              {node.children_count} подчин.
            </span>
          )}
          {node.label && (
            <p className="subordination-card__label">{node.label}</p>
          )}
          {showType && (
            <p className="subordination-card__type">{typeTitle}</p>
          )}
        </div>
      </div>

      {!isParent && (
        <div className="subordination-card__actions">
          {hasLocation && (
            <button
              type="button"
              className="subordination-card__action subordination-card__action--map"
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
            className="subordination-card__action subordination-card__action--details"
            onClick={() => onOpenDetails?.(node)}
            title="Открыть подробную информацию"
          >
            Подробнее
          </button>
          {canExpand && (
            <button
              type="button"
              className={`subordination-card__action subordination-card__action--expand${
                isExpanded ? ' subordination-card__action--expand-open' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.(node);
              }}
              disabled={isLoading}
              title={isExpanded ? 'Свернуть подчинённых' : 'Развернуть подчинённых'}
              aria-expanded={isExpanded}
            >
              {isLoading ? '…' : isExpanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      )}

      {isParent && node.children_count > 0 && (
        <span className="subordination-card__badge">
          {node.children_count} подчин.
        </span>
      )}
    </article>
  );
});

export default SubordinateCard;
