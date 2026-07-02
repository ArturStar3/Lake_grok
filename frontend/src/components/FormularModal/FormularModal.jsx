import { useState, useEffect, useMemo } from 'react';
import './FormularModal.css';
import { API_URL } from '../../config/api';
import DetailSectionNavigator from '../DetailSections/DetailSectionNavigator';
import { buildSectionCards, organizeSectionData } from '../../utils/organizeSectionData';

const FormularModal = ({
  targetId,
  onClose,
  onEdit,
  onSubordinateFlyTo,
  onSubordinateOpenDetails,
  onEditEquipmentInCatalog,
}) => {
  const [data, setData] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [deployedEquipment, setDeployedEquipment] = useState([]);
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetMeta, setTargetMeta] = useState(null);

  useEffect(() => {
    if (!targetId) return;

    const fetchFormular = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_URL}/api/v1/formular/${targetId}/`);
        
        if (!response.ok) {
          throw new Error(`Ошибка загрузки: ${response.status}`);
        }
        
        const result = await response.json();
        const formularData = Array.isArray(result) ? result : (result.formular || result);
        setData(formularData);
        if (!Array.isArray(result) && result.subordinates) {
          setSubordinates(result.subordinates);
        } else {
          setSubordinates([]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchAttachments = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/formular-attachments/?target=${targetId}`);
        if (!response.ok) return;
        const result = await response.json();
        const grouped = {};
        result.forEach((item) => {
          if (!grouped[item.section]) {
            grouped[item.section] = [];
          }
          grouped[item.section].push(item);
        });
        setAttachmentsBySection(grouped);
      } catch (err) {
        console.warn('Ошибка загрузки изображений формуляра:', err);
      }
    };

    const fetchTargetDetails = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/targets/${targetId}/`);
        if (response.ok) {
          const target = await response.json();
          setTargetTitle(target.title);
          setDeployedEquipment(target.deployed_equipment || []);
          setTargetMeta({
            label: target.label,
            country: target.country?.title,
            type: target.type?.title,
          });
        }
      } catch (err) {
        console.error('Ошибка загрузки данных объекта:', err);
      }
    };

    fetchFormular();
    fetchAttachments();
    fetchTargetDetails();
  }, [targetId]);

  const sectionCards = useMemo(() => {
    const organized = organizeSectionData(data);
    const extraCards = [];

    if (deployedEquipment.length > 0) {
      const totalQty = deployedEquipment.reduce((sum, row) => sum + (row.quantity || 0), 0);
      extraCards.push({
        id: 'equipment',
        title: 'Вооружение и техника',
        excerpt: `${deployedEquipment.length} позиций на объекте`,
        badge: { photos: 0, subsections: 0, items: totalQty || deployedEquipment.length },
        kind: 'equipment',
        payload: { items: deployedEquipment },
      });
    }

    if (subordinates.length > 0) {
      extraCards.push({
        id: 'subordinates',
        title: 'Подчинённые подразделения',
        excerpt: `${subordinates.length} непосредственно подчинённых`,
        badge: { photos: 0, subsections: 0, items: subordinates.length },
        kind: 'subordinates',
        payload: {
          parent: {
            id: targetId,
            title: targetTitle,
            label: targetMeta?.label,
            type: targetMeta?.type ? { title: targetMeta.type } : null,
            children_count: subordinates.length,
          },
          subordinates,
        },
      });
    }

    return buildSectionCards({
      organized,
      attachmentsBySection,
      extraCards,
    });
  }, [data, attachmentsBySection, deployedEquipment, subordinates, targetId, targetTitle, targetMeta]);

  const handleOverlayClick = (e) => {
    if (e.target.className === 'formular-modal-overlay') {
      onClose();
    }
  };

  const metaParts = [
    targetMeta?.type,
    targetMeta?.country,
    targetMeta?.label,
  ].filter(Boolean);

  if (!targetId) return null;

  return (
    <div className="formular-modal-overlay" onClick={handleOverlayClick}>
      <div className="formular-modal">
        <div className="formular-modal-header">
          <div className="formular-modal-title-wrap">
            <div className="formular-modal-title-block">
              <h2>{targetTitle || 'Формуляр объекта'}</h2>
              {metaParts.length > 0 && (
                <p className="formular-modal-meta">{metaParts.join(' · ')}</p>
              )}
            </div>
            {onEdit && (
              <button
                type="button"
                className="formular-modal-edit-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(targetId);
                  onClose?.();
                }}
                aria-label="Редактировать объект"
                title="Редактировать объект"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          <button className="formular-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="formular-modal-content">
          {loading && <p>Загрузка...</p>}
          {error && <p className="error">Ошибка: {error}</p>}
          
          {!loading && !error && (
            <DetailSectionNavigator
              cards={sectionCards}
              attachmentsBySection={attachmentsBySection}
              resetKey={targetId}
              autoExpandSingle
              onSubordinateFlyTo={onSubordinateFlyTo}
              onSubordinateOpenDetails={onSubordinateOpenDetails}
              onEditEquipmentInCatalog={onEditEquipmentInCatalog}
              emptyMessage="Нет данных для отображения"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FormularModal;
