import { useState, useEffect, useMemo, useCallback } from 'react';
import './FormularModal.css';
import { apiClient } from '../../config/axios';
import DetailSectionNavigator from '../DetailSections/DetailSectionNavigator';
import { buildSectionCards, organizeSectionData } from '../../utils/organizeSectionData';
import { buildZonesForTargetDetail, isActionVisible } from '../../utils/buildVisibleZones';

const FormularModal = ({
  targetId,
  onClose,
  onEdit,
  onSubordinateFlyTo,
  onSubordinateOpenDetails,
  onEditEquipmentInCatalog,
  onToggleTargetZone,
  onShowAllTargetZones,
  onHideAllTargetZones,
  actionZoneFilters = {},
  onVulnerabilityPreviewChange,
  initialShowVulnerabilitiesOnMap = false,
}) => {
  const [data, setData] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [deployedEquipment, setDeployedEquipment] = useState([]);
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetMeta, setTargetMeta] = useState(null);
  const [targetDetail, setTargetDetail] = useState(null);
  const [persons, setPersons] = useState([]);
  const [showVulnerabilitiesOnMap, setShowVulnerabilitiesOnMap] = useState(
    () => Boolean(initialShowVulnerabilitiesOnMap),
  );

  useEffect(() => {
    if (!targetId) return;

    const fetchFormular = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data: result } = await apiClient.get(`/formular/${targetId}/`);
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
        const { data: result } = await apiClient.get(`/formular-attachments/?target=${targetId}`);
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
        const { data: target } = await apiClient.get(`/targets/${targetId}/`);
        setTargetTitle(target.title);
        setTargetDetail(target);
        setDeployedEquipment(target.deployed_equipment || []);
        setTargetMeta({
          label: target.label,
          country: target.country?.title,
          type: target.type?.title,
        });
      } catch (err) {
        console.error('Ошибка загрузки данных объекта:', err);
      }
    };

    const fetchPersons = async () => {
      try {
        const { data: result } = await apiClient.get(`/persons/?target=${targetId}`);
        setPersons(Array.isArray(result) ? result : []);
      } catch (err) {
        console.warn('Ошибка загрузки персоналий:', err);
      }
    };

    setShowVulnerabilitiesOnMap(Boolean(initialShowVulnerabilitiesOnMap));
    fetchFormular();
    fetchAttachments();
    fetchTargetDetails();
    fetchPersons();
    // initialShow читаем только при смене объекта
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const targetZones = useMemo(
    () => buildZonesForTargetDetail(targetDetail),
    [targetDetail],
  );

  // Галочки в карточке объекта = состояние общих фильтров «Зоны действия»
  const zoneEnabledKeys = useMemo(() => {
    const keys = new Set();
    if (!targetDetail) return keys;
    targetZones.forEach((zone) => {
      if (isActionVisible(targetDetail, zone.action, actionZoneFilters)) {
        keys.add(zone.zoneKey);
      }
    });
    return keys;
  }, [targetDetail, targetZones, actionZoneFilters]);

  const vulnerabilityItems = useMemo(() => {
    const list = targetDetail?.vulnerabilities || [];
    return list.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      image: v.image,
      lat: v.lat,
      lng: v.lng,
    }));
  }, [targetDetail]);

  useEffect(() => {
    if (!showVulnerabilitiesOnMap) {
      onVulnerabilityPreviewChange?.({
        targetId,
        visible: false,
        points: [],
      });
      return;
    }
    // Пока детали объекта грузятся — не сбрасываем уже показанные точки
    if (!targetDetail) return;
    onVulnerabilityPreviewChange?.({
      targetId,
      visible: true,
      points: vulnerabilityItems,
    });
  }, [
    targetId,
    showVulnerabilitiesOnMap,
    vulnerabilityItems,
    targetDetail,
    onVulnerabilityPreviewChange,
  ]);

  const handleToggleZone = useCallback((zoneKey) => {
    const zone = targetZones.find((z) => z.zoneKey === zoneKey);
    if (!zone) return;
    const enabled = zoneEnabledKeys.has(zoneKey);
    onToggleTargetZone?.(zone, !enabled);
  }, [targetZones, zoneEnabledKeys, onToggleTargetZone]);

  const handleShowAllZones = useCallback(() => {
    onShowAllTargetZones?.(targetZones);
  }, [targetZones, onShowAllTargetZones]);

  const handleHideAllZones = useCallback(() => {
    onHideAllTargetZones?.(targetZones);
  }, [targetZones, onHideAllTargetZones]);

  const sectionCards = useMemo(() => {
    const organized = organizeSectionData(data);
    const extraCards = [];

    // Карточка зон всегда доступна, если у объекта есть зоны (даже 0 выбранных)
    if (targetZones.length > 0) {
      extraCards.push({
        id: 'zones',
        title: 'Зоны действия',
        excerpt: zoneEnabledKeys.size > 0
          ? `на карте: ${zoneEnabledKeys.size} из ${targetZones.length}`
          : `${targetZones.length} ${targetZones.length === 1 ? 'зона' : 'зон'} — выберите для карты`,
        badge: { photos: 0, subsections: 0, items: targetZones.length },
        kind: 'target-zones',
        payload: {},
      });
    }

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

    if (persons.length > 0) {
      extraCards.push({
        id: 'persons',
        title: 'Персоналии',
        excerpt: `${persons.length} ${persons.length === 1 ? 'лицо' : 'лиц'}`,
        badge: { photos: 0, subsections: 0, items: persons.length },
        kind: 'persons',
        payload: { persons },
      });
    }

    if (vulnerabilityItems.length > 0) {
      extraCards.push({
        id: 'vulnerabilities',
        title: 'Уязвимости',
        excerpt: `${vulnerabilityItems.length} ${vulnerabilityItems.length === 1 ? 'точка' : 'точек'}`,
        badge: { photos: 0, subsections: 0, items: vulnerabilityItems.length },
        kind: 'vulnerabilities',
        payload: {},
      });
    }

    return buildSectionCards({
      organized,
      attachmentsBySection,
      extraCards,
    });
  }, [
    data,
    attachmentsBySection,
    deployedEquipment,
    subordinates,
    persons,
    targetId,
    targetTitle,
    targetMeta,
    targetZones,
    zoneEnabledKeys,
    vulnerabilityItems,
  ]);

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
              onTargetOpenDetails={onSubordinateOpenDetails}
              targetZonePreview={{
                zones: targetZones,
                enabledKeys: zoneEnabledKeys,
                onToggleZone: handleToggleZone,
                onShowAll: handleShowAllZones,
                onHideAll: handleHideAllZones,
              }}
              vulnerabilityPreview={{
                items: vulnerabilityItems,
                showOnMap: showVulnerabilitiesOnMap,
                onShowOnMapChange: setShowVulnerabilitiesOnMap,
              }}
              emptyMessage="Нет данных для отображения"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FormularModal;
