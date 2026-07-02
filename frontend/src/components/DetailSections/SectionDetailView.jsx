import AttachmentGallery from './AttachmentGallery';
import DeployedEquipmentDisplay from '../TargetEquipment/DeployedEquipmentDisplay';
import SubordinatesList from './SubordinatesList';
import { itemHasVisibleContent } from '../../utils/organizeSectionData';
import './DetailSections.css';

function SectionContent({ item, attachmentsBySection }) {
  const section = item.section;
  const attachments = attachmentsBySection[section.id] || [];

  return (
    <article className="detail-sections__block">
      {!section.is_hidden && (
        <h3 className="detail-sections__block-title">{section.title}</h3>
      )}
      {item.content && (
        <div className="detail-sections__block-content">{item.content}</div>
      )}
      <AttachmentGallery attachments={attachments} />
    </article>
  );
}

export default function SectionDetailView({
  card,
  attachmentsBySection = {},
  onSubordinateFlyTo,
  onSubordinateOpenDetails,
  onEditEquipmentInCatalog,
}) {
  if (!card) return null;

  if (card.kind === 'section') {
    return (
      <div className="detail-sections__detail">
        <SectionContent item={card.payload.item} attachmentsBySection={attachmentsBySection} />
      </div>
    );
  }

  if (card.kind === 'group') {
    const { group } = card.payload;

    return (
      <div className="detail-sections__detail">
        {!group.parent?.is_hidden && (
          <h3 className="detail-sections__group-title">{group.parent?.title}</h3>
        )}
        {group.children
          .filter((item) => itemHasVisibleContent(item, attachmentsBySection))
          .map((item) => (
          <SectionContent
            key={item.section.id}
            item={item}
            attachmentsBySection={attachmentsBySection}
          />
        ))}
      </div>
    );
  }

  if (card.kind === 'equipment') {
    return (
      <div className="detail-sections__detail detail-sections__detail--equipment">
        <h3 className="detail-sections__group-title">{card.title}</h3>
        <DeployedEquipmentDisplay
          items={card.payload.items || []}
          onEditInCatalog={onEditEquipmentInCatalog}
          hideTitle
        />
      </div>
    );
  }

  if (card.kind === 'subordinates') {
    return (
      <div className="detail-sections__detail">
        <h3 className="detail-sections__group-title">{card.title}</h3>
        <SubordinatesList
          subordinates={card.payload.subordinates || []}
          onSubordinateFlyTo={onSubordinateFlyTo}
          onSubordinateOpenDetails={onSubordinateOpenDetails}
          hideTitle
        />
      </div>
    );
  }

  return null;
}
