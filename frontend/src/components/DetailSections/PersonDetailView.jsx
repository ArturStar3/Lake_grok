import { useState } from 'react';
import noUserIcon from '../../assets/images/no_user.png';
import PersonReadContent from './PersonReadContent';
import PersonReadModal from './PersonReadModal';
import './DetailSections.css';

function PersonSummaryCard({ person, onClick }) {
  return (
    <button
      type="button"
      className="person-detail-view__summary-card"
      onClick={onClick}
    >
      <img
        className="person-detail-view__summary-avatar"
        src={person.avatar || noUserIcon}
        alt=""
      />
      <div className="person-detail-view__summary-text">
        <span className="person-detail-view__summary-name">{person.full_name}</span>
        {person.position && (
          <span className="person-detail-view__summary-position">{person.position}</span>
        )}
      </div>
    </button>
  );
}

function PersonFullDetail({ person, onBack, onRelationClick }) {
  return (
    <article className="detail-sections__block person-detail-view__card person-detail-view__card--full">
      <button type="button" className="person-detail-view__back" onClick={onBack}>
        ← К списку лиц
      </button>
      <PersonReadContent person={person} onRelationClick={onRelationClick} />
    </article>
  );
}

export default function PersonDetailView({ persons = [] }) {
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [relationModalPerson, setRelationModalPerson] = useState(null);

  if (!persons.length) {
    return <p className="person-detail-view__empty">Персоналии не указаны.</p>;
  }

  if (selectedPerson) {
    return (
      <>
        <PersonFullDetail
          person={selectedPerson}
          onBack={() => setSelectedPerson(null)}
          onRelationClick={setRelationModalPerson}
        />
        {relationModalPerson && (
          <PersonReadModal
            person={relationModalPerson}
            onClose={() => setRelationModalPerson(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="person-detail-view person-detail-view--list">
      <div className="person-detail-view__grid" role="list">
        {persons.map((person) => (
          <PersonSummaryCard
            key={person.id}
            person={person}
            onClick={() => setSelectedPerson(person)}
          />
        ))}
      </div>
    </div>
  );
}
