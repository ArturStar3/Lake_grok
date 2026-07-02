import './DetailSections.css';

export default function SubordinatesList({
  subordinates = [],
  onSubordinateFlyTo,
  onSubordinateOpenDetails,
  hideTitle = false,
}) {
  if (!subordinates.length) return null;

  return (
    <section className="detail-sections__subordinates">
      {!hideTitle && (
        <h3 className="detail-sections__subordinates-title">
          Непосредственно подчинённые подразделения ({subordinates.length})
        </h3>
      )}
      <ul className="detail-sections__subordinates-list">
        {subordinates.map((sub) => (
          <li key={sub.id} className="detail-sections__subordinate-item">
            <button
              type="button"
              className="detail-sections__subordinate-icon"
              onClick={(e) => {
                e.stopPropagation();
                onSubordinateFlyTo?.(sub);
              }}
              title="Перейти на карте (flyTo)"
              aria-label={`Перейти к ${sub.title} на карте`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              type="button"
              className="detail-sections__subordinate-text"
              onClick={() => onSubordinateOpenDetails?.(sub)}
              title="Открыть подробную информацию"
            >
              <strong>{sub.title}</strong>
              {sub.label && ` (${sub.label})`}
              {sub.type && ` — ${sub.type.title}`}
              {sub.children_count > 0 && ` (ещё ${sub.children_count} вложенных)`}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
