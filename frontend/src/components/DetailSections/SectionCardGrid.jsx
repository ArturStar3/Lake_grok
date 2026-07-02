import './DetailSections.css';

function formatBadge(badge) {
  const parts = [];
  if (badge.photos > 0) {
    parts.push(`${badge.photos} фото`);
  }
  if (badge.subsections > 0) {
    parts.push(`${badge.subsections} подразд.`);
  }
  if (badge.items > 0) {
    parts.push(`${badge.items} ед.`);
  }
  return parts;
}

export default function SectionCardGrid({ cards, onSelectCard }) {
  if (!cards.length) return null;

  return (
    <div className="detail-sections__grid" role="list">
      {cards.map((card) => {
        const badges = formatBadge(card.badge || {});

        return (
          <button
            key={card.id}
            type="button"
            className="detail-sections__card"
            onClick={() => onSelectCard(card)}
            role="listitem"
          >
            <h3 className="detail-sections__card-title">{card.title}</h3>
            {card.excerpt && (
              <p className="detail-sections__card-excerpt">{card.excerpt}</p>
            )}
            {badges.length > 0 && (
              <div className="detail-sections__card-badges">
                {badges.map((label) => (
                  <span key={label} className="detail-sections__card-badge">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
