import { useState } from 'react';
import './DetailSections.css';

export default function AttachmentGallery({ attachments = [], classPrefix = 'detail-sections' }) {
  const [previewImage, setPreviewImage] = useState(null);

  if (!attachments.length) return null;

  return (
    <>
      <div className={`${classPrefix}__attachments`}>
        {attachments.map((item) => (
          <div key={item.id} className={`${classPrefix}__attachment-card`}>
            <button
              type="button"
              className={`${classPrefix}__attachment-thumb`}
              onClick={() => setPreviewImage(item)}
            >
              <img src={item.image} alt={item.title} />
            </button>
            <div className={`${classPrefix}__attachment-info`}>
              <strong>{item.title}</strong>
              {item.description && <p>{item.description}</p>}
            </div>
          </div>
        ))}
      </div>

      {previewImage && (
        <div
          className={`${classPrefix}__image-preview`}
          onClick={() => setPreviewImage(null)}
        >
          <div
            className={`${classPrefix}__image-preview-content`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`${classPrefix}__image-preview-close`}
              onClick={() => setPreviewImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img src={previewImage.image} alt={previewImage.title} />
            <div className={`${classPrefix}__image-preview-caption`}>
              <strong>{previewImage.title}</strong>
              {previewImage.description && <p>{previewImage.description}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
