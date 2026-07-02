import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { formatEquipmentLabel } from '../../utils/equipmentCatalogUtils';
import './EquipmentDetailModal.css';

export default function EquipmentDetailModal({
  isOpen,
  deployedRow,
  onClose,
  onEditInCatalog,
}) {
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const equipmentId = deployedRow?.equipment?.id;

  useEffect(() => {
    if (!isOpen) {
      setPreviewImage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !equipmentId) {
      setEquipment(null);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    axios
      .get(`${API_URL}/api/v1/equipment/${equipmentId}/`, { signal: controller.signal })
      .then((res) => setEquipment(res.data))
      .catch((err) => {
        if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
        console.error('Ошибка загрузки техники', err);
        setError('Не удалось загрузить данные об образце');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [isOpen, equipmentId]);

  if (!isOpen || !deployedRow) return null;

  const label = formatEquipmentLabel(deployedRow.equipment || equipment);
  const images = equipment?.images?.length
    ? equipment.images
    : (deployedRow.equipment?.images || []);
  const specs = deployedRow.specs?.length
    ? deployedRow.specs
    : (equipment?.parameter_values || []).map((pv) => ({
        title: pv.parameter?.title,
        value: pv.value,
        unit: pv.parameter?.unit?.symbol,
      }));

  const handleEditClick = () => {
    if (equipmentId && onEditInCatalog) {
      onEditInCatalog(equipmentId);
    }
  };

  return (
    <div className="equipment-detail-modal__overlay" onClick={onClose}>
      <div
        className="equipment-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-detail-modal-title"
      >
        <header className="equipment-detail-modal__header">
          <h2 id="equipment-detail-modal-title">{label}</h2>
          <button
            type="button"
            className="equipment-detail-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="equipment-detail-modal__body">
          {loading && <p className="equipment-detail-modal__hint">Загрузка…</p>}
          {error && <p className="equipment-detail-modal__error">{error}</p>}

          {!loading && (
            <>
              <div className="equipment-detail-modal__meta">
                <span className="equipment-detail-modal__qty">
                  Количество: {deployedRow.quantity}
                </span>
                {equipment?.category?.title && (
                  <span>{equipment.category.title}</span>
                )}
                {equipment?.origin_country?.title && (
                  <span>{equipment.origin_country.title}</span>
                )}
              </div>

              {images.length > 0 && (
                <div className="equipment-detail-modal__gallery">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      className="equipment-detail-modal__gallery-btn"
                      onClick={() => setPreviewImage(img)}
                      title="Открыть изображение"
                    >
                      <img
                        src={img.image}
                        alt={img.title || label}
                        className="equipment-detail-modal__gallery-img"
                      />
                    </button>
                  ))}
                </div>
              )}

              {equipment?.description && (
                <section className="equipment-detail-modal__section">
                  <h3>Описание</h3>
                  <p>{equipment.description}</p>
                </section>
              )}

              {specs.length > 0 && (
                <section className="equipment-detail-modal__section">
                  <h3>Тактико-технические характеристики</h3>
                  <ul className="equipment-detail-modal__list">
                    {specs.map((spec) => (
                      <li key={spec.title}>
                        {spec.title}: {spec.value}
                        {spec.unit ? ` ${spec.unit}` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <footer className="equipment-detail-modal__footer">
          <button
            type="button"
            className="equipment-detail-modal__edit-btn"
            onClick={handleEditClick}
            disabled={!equipmentId}
          >
            Редактировать в справочнике
          </button>
        </footer>
      </div>

      {previewImage && (
        <div
          className="equipment-detail-modal__image-preview"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewImage(null);
          }}
        >
          <div
            className="equipment-detail-modal__image-preview-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="equipment-detail-modal__image-preview-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img src={previewImage.image} alt={previewImage.title || label} />
          </div>
        </div>
      )}
    </div>
  );
}
