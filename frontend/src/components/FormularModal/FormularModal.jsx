import { useState, useEffect } from 'react';
import './FormularModal.css';
import { API_URL } from '../../config/api';
import DeployedEquipmentDisplay from '../TargetEquipment/DeployedEquipmentDisplay';

const FormularModal = ({ targetId, onClose, onEdit, onSubordinateFlyTo, onSubordinateOpenDetails, onEditEquipmentInCatalog }) => {
  const [data, setData] = useState([]);
  const [subordinates, setSubordinates] = useState([]);  // прямые подчинённые
  const [deployedEquipment, setDeployedEquipment] = useState([]);
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targetTitle, setTargetTitle] = useState('');

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
        // Поддержка как старого формата (массив), так и нового {formular, subordinates}
        const formularData = Array.isArray(result) ? result : (result.formular || result);
        setData(formularData);
        if (!Array.isArray(result) && result.subordinates) {
          setSubordinates(result.subordinates);
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

    // Название объекта и техника на площадке
    const fetchTargetDetails = async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/targets/${targetId}/`);
        if (response.ok) {
          const target = await response.json();
          setTargetTitle(target.title);
          setDeployedEquipment(target.deployed_equipment || []);
        }
      } catch (err) {
        console.error('Ошибка загрузки данных объекта:', err);
      }
    };

    fetchFormular();
    fetchAttachments();
    fetchTargetDetails();
  }, [targetId]);

  const renderAttachments = (sectionId) => {
    const attachments = attachmentsBySection[sectionId] || [];
    if (attachments.length === 0) return null;

    return (
      <div className="formular-attachments">
        {attachments.map((item) => (
          <div key={item.id} className="formular-attachment-card">
            <button
              type="button"
              className="formular-attachment-thumb"
              onClick={() => setPreviewImage(item)}
            >
              <img src={item.image} alt={item.title} />
            </button>
            <div className="formular-attachment-info">
              <strong>{item.title}</strong>
              {item.description && <p>{item.description}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const organizeData = () => {
    if (!data.length) return { standalone: [], groups: [] };

    // Сортируем по порядку секций
    const getOrderValue = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 9999;
    };
    const sorted = [...data].sort(
      (a, b) => getOrderValue(a.section.order) - getOrderValue(b.section.order)
    );

    // Разделяем на standalone (без parent или parent скрыт) и subsections
    const standalone = [];
    const groups = {};

    sorted.forEach(item => {
      const section = item.section;
      
      // Если у секции есть parent
      if (section.parent) {
        const parentTitle = section.parent.title;
        
        if (!groups[parentTitle]) {
          groups[parentTitle] = {
            parent: section.parent,
            children: []
          };
        }
        
        groups[parentTitle].children.push(item);
      } else {
        // Проверяем, есть ли у этой секции дочерние элементы
        const hasChildren = sorted.some(s => 
          s.section.parent && s.section.parent.title === section.title
        );

        // Если секция скрыта и у неё нет детей - пропускаем
        if (section.is_hidden && !hasChildren) {
          return;
        }

        // Если у секции нет parent - это standalone
        standalone.push(item);
      }
    });

    return { 
      standalone, 
      groups: Object.values(groups)
    };
  };

  const { standalone, groups } = organizeData();

  const handleOverlayClick = (e) => {
    if (e.target.className === 'formular-modal-overlay') {
      onClose();
    }
  };

  if (!targetId) return null;

  return (
    <div className="formular-modal-overlay" onClick={handleOverlayClick}>
      <div className="formular-modal">
        <div className="formular-modal-header">
          <div className="formular-modal-title-wrap">
            <h2>{targetTitle || 'Формуляр объекта'}</h2>
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
                {/* Pencil / edit icon (SVG) */}
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
          
          {!loading && !error && data.length === 0 && (
            <p>Нет данных для отображения</p>
          )}
          
          {!loading && !error && data.length > 0 && (
            <>
              {/* Standalone секции */}
              {standalone.map((item, index) => (
                <div key={index} className="formular-section">
                  {!item.section.is_hidden && (
                    <h3>{item.section.title}</h3>
                  )}
                  {item.content && <p>{item.content}</p>}
                  {renderAttachments(item.section.id)}
                </div>
              ))}

              {/* Группы с подсекциями */}
              {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="formular-group">
                  {!group.parent.is_hidden && (
                    <h3 className="formular-group-title">{group.parent.title}</h3>
                  )}
                  {group.children.map((item, childIndex) => (
                    <div key={childIndex} className="formular-subsection">
                      {!item.section.is_hidden && (
                        <h4>{item.section.title}</h4>
                      )}
                      {item.content && <p>{item.content}</p>}
                      {renderAttachments(item.section.id)}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          <DeployedEquipmentDisplay
            items={deployedEquipment}
            onEditInCatalog={onEditEquipmentInCatalog}
          />

          {/* Список непосредственных подчинённых */}
          {subordinates.length > 0 && (
            <div className="formular-subordinates">
              <h3>Непосредственно подчинённые подразделения ({subordinates.length})</h3>
              <ul className="formular-subordinates-list">
                {subordinates.map((sub) => (
                  <li key={sub.id} className="formular-subordinate-item">
                    <button
                      type="button"
                      className="formular-subordinate-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSubordinateFlyTo && onSubordinateFlyTo(sub);
                      }}
                      title="Перейти на карте (flyTo)"
                      aria-label={`Перейти к ${sub.title} на карте`}
                    >
                      {/* Map pin SVG - consistent with main objects table */}
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="formular-subordinate-text"
                      onClick={() => onSubordinateOpenDetails && onSubordinateOpenDetails(sub)}
                      title="Открыть подробную информацию"
                    >
                      <strong>{sub.title}</strong>
                      {sub.label && ` (${sub.label})`}
                      {sub.type && ` — ${sub.type.title}`}
                      {sub.children_count > 0 && ` (ещё ${sub.children_count} вложенных)`}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {previewImage && (
        <div className="formular-image-preview" onClick={() => setPreviewImage(null)}>
          <div className="formular-image-preview-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="formular-image-preview-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img src={previewImage.image} alt={previewImage.title} />
            <div className="formular-image-preview-caption">
              <strong>{previewImage.title}</strong>
              {previewImage.description && <p>{previewImage.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormularModal;
