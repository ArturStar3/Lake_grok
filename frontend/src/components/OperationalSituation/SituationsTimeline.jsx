import { useMemo } from 'react';
import { CHANGE_KIND_LABELS, compareSituationDateTime, formatSituationDateTime, sortRevisionsBySituationDateTime } from '../../utils/situationUtils';
import './OperationalSituation.css';

function TimelineItem({ revision, selectedRevisionId, onSelectRevision }) {
  const isActive = selectedRevisionId != null
    && String(selectedRevisionId) === String(revision.id);
  return (
    <button
      key={revision.id}
      type="button"
      className={`situations-timeline__item${isActive ? ' situations-timeline__item--active' : ''}`}
      onClick={() => onSelectRevision?.(revision)}
    >
      <span className="situations-timeline__dot" style={{ borderColor: revision.color || '#2f80ed' }} />
      <span className="situations-timeline__content">
        <strong>{revision.title}</strong>
        <span className="situations-timeline__meta">
          v{revision.version}
          {revision.situation_date ? ` · ${formatSituationDateTime(revision)}` : ''}
          {revision.change_kind ? ` · ${CHANGE_KIND_LABELS[revision.change_kind] || revision.change_kind}` : ''}
        </span>
      </span>
    </button>
  );
}

function buildTimelineGroups(revisions, sortDirection) {
  const groupsMap = revisions.reduce((acc, revision) => {
    const key = revision.situation_id || revision.situation?.id || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        title: revision.title,
        items: [],
      };
    }
    acc[key].items.push(revision);
    return acc;
  }, {});

  return Object.entries(groupsMap)
    .map(([situationId, group]) => ({
      situationId,
      title: group.title,
      items: sortRevisionsBySituationDateTime(group.items, sortDirection),
    }))
    .sort((left, right) => {
      const latestLeft = sortDirection === 'desc' ? left.items[0] : left.items[left.items.length - 1];
      const latestRight = sortDirection === 'desc' ? right.items[0] : right.items[right.items.length - 1];
      const cmp = compareSituationDateTime(latestLeft, latestRight);
      return sortDirection === 'desc' ? -cmp : cmp;
    });
}

export default function SituationsTimeline({
  revisions,
  selectedRevisionId,
  onSelectRevision,
  compact = false,
  groupBySituation = false,
  sortDirection = 'desc',
  title = 'Таймлайн изменений',
}) {
  const sortedRevisions = useMemo(
    () => sortRevisionsBySituationDateTime(revisions, sortDirection),
    [revisions, sortDirection],
  );

  const groups = useMemo(
    () => (groupBySituation ? buildTimelineGroups(sortedRevisions, sortDirection) : []),
    [groupBySituation, sortedRevisions, sortDirection],
  );

  if (!sortedRevisions.length) {
    return <p className="situations-timeline__empty">Нет записей для таймлайна</p>;
  }

  if (groupBySituation) {
    return (
      <div className="situations-timeline situations-timeline--global">
        <div className="situations-timeline__title">Общий таймлайн</div>
        <div className="situations-timeline__track">
          {groups.map((group) => (
            <div key={group.situationId}>
              <div className="situations-timeline__group-title">{group.title}</div>
              {group.items.map((revision) => (
                <TimelineItem
                  key={revision.id}
                  revision={revision}
                  selectedRevisionId={selectedRevisionId}
                  onSelectRevision={onSelectRevision}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`situations-timeline${compact ? ' situations-timeline--compact' : ''}`}>
      <div className="situations-timeline__title">{title}</div>
      <div className="situations-timeline__track">
        {sortedRevisions.map((revision) => (
          <TimelineItem
            key={revision.id}
            revision={revision}
            selectedRevisionId={selectedRevisionId}
            onSelectRevision={onSelectRevision}
          />
        ))}
      </div>
    </div>
  );
}
