import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import AttachmentGallery from './AttachmentGallery';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import noUserIcon from '../../assets/images/no_user.png';

export default function PersonReadContent({ person, onRelationClick, className = '' }) {
  const [detail, setDetail] = useState(null);
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!person?.id) return undefined;
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
  }, [person?.id]);

  const displayPerson = detail?.person || person;
  const avatarUrl = person.avatar || displayPerson?.avatar || photos.find((p) => p.order === 1)?.image;

  return (
    <div className={`person-read-content ${className}`.trim()}>
      <div className="person-read-content__header">
        <img
          className="person-read-content__avatar"
          src={avatarUrl || noUserIcon}
          alt=""
        />
        <div className="person-read-content__header-text">
          <h4 className="person-read-content__name">{displayPerson?.full_name || person.full_name}</h4>
          {displayPerson?.position && (
            <p className="person-read-content__position">{displayPerson.position}</p>
          )}
        </div>
      </div>

      {loading && <p className="person-read-content__loading">Загрузка...</p>}

      {!loading && detail && (
        <>
          {photos.length > 1 && (
            <div className="person-read-content__photos">
              <h5 className="person-read-content__section-title">Фотографии</h5>
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
              <div key={sectionId} className="person-read-content__section">
                {!item.section?.is_hidden && (
                  <h5 className="person-read-content__section-title">{item.section?.title}</h5>
                )}
                {item.content && (
                  <MarkdownContent className="detail-sections__block-content">
                    {item.content}
                  </MarkdownContent>
                )}
                <AttachmentGallery attachments={attachments} />
              </div>
            );
          })}
          {(detail.relations || []).length > 0 && (
            <div className="person-read-content__relations">
              <h5 className="person-read-content__section-title">Связи</h5>
              <ul className="person-read-content__relations-list">
                {detail.relations.map((rel) => {
                  const other = rel.direction === 'out' ? rel.person_to : rel.person_from;
                  return (
                    <li key={rel.id} className="person-read-content__relation-item">
                      <span className="person-read-content__relation-type">{rel.label}</span>
                      {other?.id && onRelationClick ? (
                        <button
                          type="button"
                          className="person-read-content__relation-link"
                          onClick={() => onRelationClick(other)}
                        >
                          {other.full_name || '—'}
                        </button>
                      ) : (
                        <span className="person-read-content__relation-name">
                          {other?.full_name || '—'}
                        </span>
                      )}
                      {rel.notes && (
                        <span className="person-read-content__relation-notes">{rel.notes}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
