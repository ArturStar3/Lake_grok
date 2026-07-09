import { useMemo } from 'react';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import SituationsTimeline from './SituationsTimeline';
import { formatSituationDateTime, getSituationDisplayRevision } from '../../utils/situationUtils';
import './OperationalSituation.css';

export default function SituationDetailPanel({
  situation,
  revisions,
  timelineRevisionId,
  onSelectRevision,
  onClose,
  onEdit,
  onNewState,
}) {
  const rev = useMemo(() => {
    if (!situation) return null;
    if (timelineRevisionId != null) {
      const selected = (revisions || []).find(
        (item) => String(item.id) === String(timelineRevisionId),
      );
      if (selected) return selected;
    }
    return getSituationDisplayRevision(situation);
  }, [timelineRevisionId, revisions, situation]);

  if (!situation) return null;

  const countriesLabel = rev?.countries?.map((c) => c.title).join(', ') || '—';

  return (
    <div className="situation-detail">
      <div className="situation-detail__header">
        <h3 className="situation-detail__title">{rev?.title || 'Обстановка'}</h3>
        <button type="button" className="situation-detail__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      <div className="situation-detail__body">
        <div className="situation-detail__field">
          <span className="situation-detail__label">Страны</span>
          <span>{countriesLabel}</span>
        </div>
        <div className="situation-detail__field">
          <span className="situation-detail__label">Дата и время обстановки</span>
          <span>{formatSituationDateTime(rev)}</span>
        </div>
        <div className="situation-detail__field">
          <span className="situation-detail__label">Дата создания</span>
          <span>{situation.created_at ? new Date(situation.created_at).toLocaleString() : '—'}</span>
        </div>
        <div className="situation-detail__field">
          <span className="situation-detail__label">Версия</span>
          <span>v{rev?.version || '—'}</span>
        </div>
        <div className="situation-detail__field situation-detail__field--full">
          <span className="situation-detail__label">Описание</span>
          {rev?.description ? (
            <MarkdownContent>{rev.description}</MarkdownContent>
          ) : (
            <span>—</span>
          )}
        </div>
        <SituationsTimeline
          revisions={revisions}
          selectedRevisionId={timelineRevisionId}
          onSelectRevision={onSelectRevision}
          sortDirection="asc"
          compact
        />
      </div>
      <div className="situation-detail__actions">
        <button
          type="button"
          className="situation-detail__btn"
          onClick={() => onEdit?.(situation)}
          disabled={!onEdit}
          aria-disabled={!onEdit}
        >
          Редактировать
        </button>
        <button
          type="button"
          className="situation-detail__btn"
          onClick={() => onNewState?.(situation)}
          disabled={!onNewState}
          aria-disabled={!onNewState}
        >
          Новое состояние
        </button>
      </div>
    </div>
  );
}
