import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCardGrid from './SectionCardGrid';
import SectionDetailView from './SectionDetailView';
import SectionNavList from './SectionNavList';
import './DetailSections.css';

export default function DetailSectionNavigator({
  cards = [],
  attachmentsBySection = {},
  autoExpandSingle = false,
  resetKey,
  onSubordinateFlyTo,
  onSubordinateOpenDetails,
  onEditEquipmentInCatalog,
  onTargetEdit,
  emptyMessage = 'Информация отсутствует.',
}) {
  const [selectedCardId, setSelectedCardId] = useState(null);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  useEffect(() => {
    setSelectedCardId(null);
  }, [resetKey]);

  useEffect(() => {
    if (!autoExpandSingle || cards.length !== 1) return;
    setSelectedCardId(cards[0].id);
  }, [autoExpandSingle, cards, resetKey]);

  const handleSelectCard = useCallback((card) => {
    setSelectedCardId(card.id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCardId(null);
  }, []);

  if (!cards.length) {
    return <div className="detail-sections__empty">{emptyMessage}</div>;
  }

  return (
    <div className="detail-sections">
      {selectedCard ? (
        <div className="detail-sections__view detail-sections__view--detail">
          <div className="detail-sections__detail-layout">
            <SectionNavList
              cards={cards}
              activeCardId={selectedCardId}
              onSelectCard={handleSelectCard}
              onBack={handleBack}
            />
            <div className="detail-sections__detail-main">
              <div key={selectedCardId} className="detail-sections__detail-pane">
                <SectionDetailView
                  card={selectedCard}
                  attachmentsBySection={attachmentsBySection}
                  onSubordinateFlyTo={onSubordinateFlyTo}
                  onSubordinateOpenDetails={onSubordinateOpenDetails}
                  onEditEquipmentInCatalog={onEditEquipmentInCatalog}
                  onTargetEdit={onTargetEdit}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div key="overview" className="detail-sections__view detail-sections__view--overview">
          <SectionCardGrid cards={cards} onSelectCard={handleSelectCard} />
        </div>
      )}
    </div>
  );
}
