import { useState } from 'react';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './DetailSections.css';

export default function AttachmentGallery({ attachments = [], classPrefix = 'detail-sections' }) {
  const [previewImage, setPreviewImage] = useState(null);

  if (!attachments.length) return null;

  return (
    <>
      <div className={`${classPrefix}__attachments`}>
        {attachments.map((item) => {
          const imageSrc = resolveMediaUrl(item.image);
          return (
          <div key={item.id} className={`${classPrefix}__attachment-card`}>
            <button
              type="button"
              className={`${classPrefix}__attachment-thumb`}
              onClick={() => setPreviewImage({ ...item, image: imageSrc })}
            >
              {imageSrc ? <img src={imageSrc} alt={item.title} /> : null}
            </button>
            <div className={`${classPrefix}__attachment-info`}>
              <strong>{item.title}</strong>
              {item.description && (
                <MarkdownContent variant="compact">{item.description}</MarkdownContent>
              )}
            </div>
          </div>
        );
        })}
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
              {previewImage.description && (
                <MarkdownContent variant="compact">{previewImage.description}</MarkdownContent>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
