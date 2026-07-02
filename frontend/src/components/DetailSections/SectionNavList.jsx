import { memo, useCallback } from 'react';
import './DetailSections.css';

function SectionNavList({ cards, activeCardId, onSelectCard, onBack }) {
  const handleItemClick = useCallback(
    (cardId) => {
      if (cardId === activeCardId) return;
      const card = cards.find((entry) => entry.id === cardId);
      if (card) onSelectCard(card);
    },
    [activeCardId, cards, onSelectCard]
  );

  return (
    <aside className="detail-sections__sidebar" aria-label="Разделы">
      <button type="button" className="detail-sections__sidebar-back" onClick={onBack}>
        ← Все разделы
      </button>
      <ul className="detail-sections__sidebar-list" role="list">
        {cards.map((card) => {
          const isActive = card.id === activeCardId;
          return (
            <li key={card.id} role="listitem">
              <button
                type="button"
                className={`detail-sections__sidebar-item${isActive ? ' detail-sections__sidebar-item--active' : ''}`}
                onClick={() => handleItemClick(card.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                {card.title}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default memo(SectionNavList);
