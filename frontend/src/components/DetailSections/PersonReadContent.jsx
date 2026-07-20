import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import AttachmentGallery from './AttachmentGallery';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import noUserIcon from '../../assets/images/no_user.png';
import './DetailSections.css';
import './PersonReadModal.css';

export default function PersonReadContent({ person, onRelationClick, className = '' }) {
  const [detail, setDetail] = useState(null);
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

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
  const personDisplayName = displayPerson?.full_name || person?.full_name || 'Персона';
  const avatarPhoto = photos.find((p) => p.order === 1);
  const avatarUrl = useMemo(() => {
    const raw = displayPerson?.avatar || avatarPhoto?.image || person.avatar;
    return resolveMediaUrl(raw);
  }, [displayPerson?.avatar, avatarPhoto?.image, person.avatar]);

  const galleryPhotos = useMemo(
    () => photos
      .map((photo) => ({
        id: photo.id,
        image: resolveMediaUrl(photo.image),
        order: photo.order,
        title: photo.title || (photo.order === 1 ? personDisplayName : 'Фото'),
      }))
      .filter((photo) => photo.image),
    [photos, personDisplayName],
  );

  const extraGalleryPhotos = galleryPhotos.filter(
    (photo) => !(photo.order === 1 && photos.length === 1),
  );

  const openPreview = (image, title) => {
    if (!image) return;
    setPreviewImage({ image, title });
  };

  return (
    <div className={`person-read-content ${className}`.trim()}>
      <div className="person-read-content__header">
        {avatarUrl ? (
          <button
            type="button"
            className="person-read-content__avatar-btn"
            onClick={() => openPreview(avatarUrl, personDisplayName)}
            aria-label={`Открыть фото: ${personDisplayName}`}
          >
            <img
              className="person-read-content__avatar"
              src={avatarUrl}
              alt=""
            />
          </button>
        ) : (
          <img
            className="person-read-content__avatar"
            src={noUserIcon}
            alt=""
          />
        )}
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
          {extraGalleryPhotos.length > 0 && (
            <div className="person-read-content__photos">
              <h5 className="person-read-content__section-title">Фотографии</h5>
              <AttachmentGallery attachments={extraGalleryPhotos} />
            </div>
          )}
          {(detail.info || []).map((item) => {
            const sectionId = item.section?.id;
            const attachments = (attachmentsBySection[sectionId] || []).map((att) => ({
              ...att,
              image: resolveMediaUrl(att.image),
            }));
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

      {previewImage && (
        <div
          className="person-read-content__image-preview"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="person-read-content__image-preview-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="person-read-content__image-preview-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img src={previewImage.image} alt={previewImage.title} />
            <div className="person-read-content__image-preview-caption">
              <strong>{previewImage.title}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
