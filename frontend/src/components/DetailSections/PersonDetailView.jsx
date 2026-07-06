import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import AttachmentGallery from './AttachmentGallery';
import noUserIcon from '../../assets/images/no_user.png';
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

function PersonFullDetail({ person, onBack }) {
  const [detail, setDetail] = useState(null);
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [detailRes, attachmentsRes] = await Promise.all([
          axios.get(`${API_URL}/api/v1/person/${person.id}/`),
          axios.get(`${API_URL}/api/v1/person-attachments/`, { params: { person: person.id } }),
        ]);
        if (cancelled) return;
        setDetail(detailRes.data);
        setPhotos(detailRes.data.photos || []);
        const grouped = {};
        (attachmentsRes.data || []).forEach((item) => {
          if (!grouped[item.section]) grouped[item.section] = [];
          grouped[item.section].push(item);
        });
        setAttachmentsBySection(grouped);
      } catch (err) {
        if (!cancelled) console.warn('Ошибка загрузки персоны:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [person.id]);

  const avatarUrl = person.avatar || detail?.person?.avatar || photos.find((p) => p.order === 1)?.image;

  return (
    <article className="detail-sections__block person-detail-view__card person-detail-view__card--full">
      <button type="button" className="person-detail-view__back" onClick={onBack}>
        ← К списку лиц
      </button>
      <div className="person-detail-view__header">
        <img
          className="person-detail-view__avatar"
          src={avatarUrl || noUserIcon}
          alt=""
        />
        <div className="person-detail-view__header-text">
          <h4 className="detail-sections__block-title person-detail-view__name">
            {person.full_name}
          </h4>
          {person.position && (
            <p className="person-detail-view__position">{person.position}</p>
          )}
        </div>
      </div>
      {loading && <p className="person-detail-view__loading">Загрузка...</p>}
      {!loading && detail && (
        <>
          {photos.length > 1 && (
            <div className="person-detail-view__photos">
              <h5 className="person-detail-view__section-title">Фотографии</h5>
              <AttachmentGallery attachments={photos.map((photo) => ({
                id: photo.id,
                image: photo.image,
                title: photo.title || (photo.order === 1 ? 'Аватар' : 'Фото'),
              }))} />
            </div>
          )}
          {(detail.info || []).map((item) => {
            const sectionId = item.section?.id;
            const attachments = attachmentsBySection[sectionId] || [];
            const hasContent = item.content?.trim() || attachments.length > 0;
            if (!hasContent) return null;
            return (
              <div key={sectionId} className="person-detail-view__section">
                {!item.section?.is_hidden && (
                  <h5 className="person-detail-view__section-title">{item.section?.title}</h5>
                )}
                {item.content && (
                  <div className="detail-sections__block-content">{item.content}</div>
                )}
                <AttachmentGallery attachments={attachments} />
              </div>
            );
          })}
          {(detail.relations || []).length > 0 && (
            <div className="person-detail-view__relations">
              <h5 className="person-detail-view__section-title">Связи</h5>
              <ul className="person-detail-view__relations-list">
                {detail.relations.map((rel) => {
                  const other = rel.direction === 'out' ? rel.person_to : rel.person_from;
                  return (
                    <li key={rel.id} className="person-detail-view__relation-item">
                      <span className="person-detail-view__relation-type">{rel.label}</span>
                      <span className="person-detail-view__relation-name">
                        {other?.full_name || '—'}
                      </span>
                      {rel.notes && (
                        <span className="person-detail-view__relation-notes">{rel.notes}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export default function PersonDetailView({ persons = [] }) {
  const [selectedPerson, setSelectedPerson] = useState(null);

  if (!persons.length) {
    return <p className="person-detail-view__empty">Персоналии не указаны.</p>;
  }

  if (selectedPerson) {
    return (
      <PersonFullDetail
        person={selectedPerson}
        onBack={() => setSelectedPerson(null)}
      />
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
