import { useState, useEffect } from 'react';
import axios from 'axios';
import { addColorClassToSvg } from '../../utils/svgUtils';
import { useActionsArray } from '../../hooks/useActionsArray';
import { useDropdownWithSearch } from '../../hooks/useDropdownWithSearch';
import './EditTargetModal.css';
import { API_URL } from '../../config/api';

const API_ROOT = API_URL;

export default function EditTargetModal({ targetId, isOpen, onClose, onTargetUpdated }) {
    const [activeTab, setActiveTab] = useState('target');
    const [formData, setFormData] = useState({
        country: '',
        title: '',
        label: '',
        type: '',
        marker: '',
        branch: '',
        parent: '',
        lat: '',
        lng: '',
        actions: []
    });
    
    const [formularData, setFormularData] = useState({});
    const [sections, setSections] = useState([]);
    const [attachmentsBySection, setAttachmentsBySection] = useState({});
    const [attachmentDrafts, setAttachmentDrafts] = useState({});
    const [attachmentFormsOpen, setAttachmentFormsOpen] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    
    const [countries, setCountries] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [actionTypes, setActionTypes] = useState([]);
    const [targetTypes, setTargetTypes] = useState([]);
    const [militaryBranches, setMilitaryBranches] = useState([]);
    const [targets, setTargets] = useState([]);  // для выбора parent
    const [markerSvgs, setMarkerSvgs] = useState(new Map());
    
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Хуки для управления actions
    const { handleAddAction, handleRemoveAction, handleActionChange } = useActionsArray(formData, setFormData);
    
    // Хуки для dropdown с поиском
    const countryDropdown = useDropdownWithSearch(
        countries,
        (id) => {
            const newCountryId = id;
            const newCId = parseInt(newCountryId, 10);
            let newBranch = formData.branch;
            if (newBranch) {
                const stillValid = militaryBranches.find(b =>
                    b.id === newBranch &&
                    (!b.countries || b.countries.length === 0 || b.countries.map(Number).includes(newCId))
                );
                if (!stillValid) {
                    newBranch = '';
                }
            }
            setFormData(prev => ({ ...prev, country: newCountryId, branch: newBranch }));
            if (errors.country) {
                setErrors(prev => ({ ...prev, country: null }));
            }
            if (errors.branch && !newBranch) {
                setErrors(prev => ({ ...prev, branch: null }));
            }
        }
    );
    
    const markerDropdown = useDropdownWithSearch(
        markers,
        (id) => {
            setFormData(prev => ({ ...prev, marker: id }));
            if (errors.marker) {
                setErrors(prev => ({ ...prev, marker: null }));
            }
        }
    );
    
    // Dropdown для parent (исключаем себя)
    const parentOptions = targets.filter(t => t.id !== targetId);
    const parentDropdown = useDropdownWithSearch(
        parentOptions,
        (id) => {
            setFormData(prev => ({ ...prev, parent: id }));
            if (errors.parent) {
                setErrors(prev => ({ ...prev, parent: null }));
            }
        }
    );

    // Динамический список branches в зависимости от выбранной страны
    const getCountryId = (c) => c ? parseInt(c, 10) : null;
    const currentCountryId = getCountryId(formData.country);
    const availableBranches = (currentCountryId
      ? militaryBranches.filter(b =>
          !b.countries || b.countries.length === 0 || b.countries.map(Number).includes(currentCountryId)
        )
      : militaryBranches
    );

    // Dropdown для вида/рода войск (зависит от страны)
    const branchDropdown = useDropdownWithSearch(
      availableBranches,
      (id) => {
        setFormData(prev => ({ ...prev, branch: id }));
        if (errors.branch) {
          setErrors(prev => ({ ...prev, branch: null }));
        }
      }
    );

    const selectedCountryColor = formData.country 
        ? countries.find(c => c.id === formData.country)?.color || 'blue'
        : 'blue';
    
    useEffect(() => {
        if (isOpen && targetId) {
            loadData();
        }
    }, [isOpen, targetId]);
    
    const loadData = async () => {
        setLoading(true);
        
        try {
            const [
                targetRes,
                countriesRes,
                markersRes,
                actionTypesRes,
                targetTypesRes,
                branchesRes,
                sectionsRes,
                targetsRes
            ] = await Promise.all([
                axios.get(`${API_ROOT}/api/v1/targets/${targetId}/`),
                axios.get(`${API_ROOT}/api/v1/countries`),
                axios.get(`${API_ROOT}/api/v1/markers`),
                axios.get(`${API_ROOT}/api/v1/action-types`),
                axios.get(`${API_ROOT}/api/v1/target-types`),
                axios.get(`${API_ROOT}/api/v1/military-branches`),
                axios.get(`${API_ROOT}/api/v1/formular-sections/`),
                axios.get(`${API_ROOT}/api/v1/targets/`)  // для выбора parent
            ]);
            
            const target = targetRes.data;
            
            // Сначала устанавливаем справочники
            setCountries(countriesRes.data);
            setMarkers(markersRes.data);
            setActionTypes(actionTypesRes.data);
            setTargetTypes(targetTypesRes.data);
            setMilitaryBranches(branchesRes.data || []);
            setTargets(targetsRes.data || []);
            
            // Затем устанавливаем formData с корректными ID
            setFormData({
                country: target.country?.id || '',
                title: target.title || '',
                label: target.label || '',
                type: target.type?.id || '',
                marker: target.marker?.id || '',
                branch: target.branch?.id || '',
                parent: target.parent || '',
                lat: target.lat || '',
                lng: target.lng || '',
                actions: target.actions?.map(a => ({
                    action_type_id: a.action_type?.id || '',
                    radius: a.radius || 0
                })) || []
            });
            
            // Загрузка SVG маркеров
            markersRes.data.forEach(async (marker) => {
                if (marker.path) {
                    try {
                        const res = await axios.get(marker.path, { responseType: 'text' });
                        setMarkerSvgs(prev => new Map(prev).set(marker.id, res.data));
                    } catch (err) {
                        console.warn('Не удалось загрузить SVG маркера:', marker.path, err);
                    }
                }
            });
            
            // Организуем разделы в иерархию
            const organized = organizeIntoHierarchy(sectionsRes.data);
            setSections(organized);
            
            // Загружаем существующие данные формуляра
            // Примечание: /formular/<id>/ возвращает {formular: [...], subordinates: [...]}
            try {
                const formularRes = await axios.get(`${API_ROOT}/api/v1/formular/${targetId}/`);
                const existingData = {};
                const formularItems = formularRes.data.formular || (Array.isArray(formularRes.data) ? formularRes.data : []);
                formularItems.forEach(item => {
                    existingData[item.section.id] = item.content || '';
                });
                setFormularData(existingData);
            } catch (err) {
                if (err.response?.status !== 404) {
                    console.warn('Ошибка загрузки формуляра:', err);
                }
                setFormularData({});
            }

            // Загружаем изображения формуляра
            try {
                const attachmentsRes = await axios.get(`${API_ROOT}/api/v1/formular-attachments/`, {
                    params: { target: targetId }
                });
                const grouped = {};
                (attachmentsRes.data || []).forEach((item) => {
                    if (!grouped[item.section]) {
                        grouped[item.section] = [];
                    }
                    grouped[item.section].push(item);
                });
                setAttachmentsBySection(grouped);
            } catch (err) {
                console.warn('Ошибка загрузки изображений формуляра:', err);
                setAttachmentsBySection({});
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            setErrors({ general: 'Не удалось загрузить данные объекта' });
        } finally {
            setLoading(false);
        }
    };
    
    const organizeIntoHierarchy = (sections) => {
        const sectionMap = {};
        const rootSections = [];
        
        sections.forEach(section => {
            sectionMap[section.id] = { ...section, children: [] };
        });
        
        sections.forEach(section => {
            if (section.parent) {
                const parent = sectionMap[section.parent];
                if (parent) {
                    parent.children.push(sectionMap[section.id]);
                }
            } else {
                rootSections.push(sectionMap[section.id]);
            }
        });
        
            const sortByOrder = (arr) => {
                const getOrderValue = (value) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : 9999;
                };
                arr.sort((a, b) => getOrderValue(a.order) - getOrderValue(b.order));
            arr.forEach(item => {
                if (item.children.length > 0) {
                    sortByOrder(item.children);
                }
            });
        };
        sortByOrder(rootSections);
        
        return rootSections;
    };
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };
    
    const handleFormularChange = (sectionId, value) => {
        setFormularData(prev => ({
            ...prev,
            [sectionId]: value
        }));
    };

    const handleAttachmentDraftChange = (sectionId, field, value) => {
        setAttachmentDrafts((prev) => ({
            ...prev,
            [sectionId]: {
                title: prev[sectionId]?.title || "",
                description: prev[sectionId]?.description || "",
                files: prev[sectionId]?.files || [],
                uploading: prev[sectionId]?.uploading || false,
                [field]: value
            }
        }));
    };

    const handleAttachmentUpload = async (sectionId) => {
        const draft = attachmentDrafts[sectionId];
        if (!draft?.files?.length || !draft.title?.trim()) return;

        handleAttachmentDraftChange(sectionId, "uploading", true);

        try {
            const uploaded = [];
            for (const file of draft.files) {
                const formData = new FormData();
                formData.append('target', targetId);
                formData.append('section', sectionId);
                formData.append('title', draft.title.trim());
                formData.append('description', draft.description || '');
                formData.append('image', file);

                const resp = await axios.post(`${API_ROOT}/api/v1/formular-attachments/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                uploaded.push(resp.data);
            }

            setAttachmentsBySection((prev) => {
                const next = { ...prev };
                next[sectionId] = [...(next[sectionId] || []), ...uploaded];
                return next;
            });

            setAttachmentDrafts((prev) => ({
                ...prev,
                [sectionId]: { title: "", description: "", files: [], uploading: false }
            }));
        } catch (err) {
            console.error('Не удалось загрузить изображение:', err);
            handleAttachmentDraftChange(sectionId, "uploading", false);
        }
    };

    const handleAttachmentDelete = async (sectionId, attachmentId) => {
        try {
            await axios.delete(`${API_ROOT}/api/v1/formular-attachments/${attachmentId}/`);
            setAttachmentsBySection((prev) => {
                const next = { ...prev };
                next[sectionId] = (next[sectionId] || []).filter((item) => item.id !== attachmentId);
                return next;
            });
        } catch (err) {
            console.error('Не удалось удалить изображение:', err);
        }
    };
    
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.country) {
            newErrors.country = 'Выберите страну';
        }
        if (!formData.title.trim()) {
            newErrors.title = 'Введите наименование объекта';
        }
        if (!formData.lat || isNaN(parseFloat(formData.lat))) {
            newErrors.lat = 'Введите корректную широту';
        } else {
            const lat = parseFloat(formData.lat);
            if (lat < -90 || lat > 90) {
                newErrors.lat = 'Широта должна быть от -90 до 90';
            }
        }
        if (!formData.lng || isNaN(parseFloat(formData.lng))) {
            newErrors.lng = 'Введите корректную долготу';
        } else {
            const lng = parseFloat(formData.lng);
            if (lng < -180 || lng > 180) {
                newErrors.lng = 'Долгота должна быть от -180 до 180';
            }
        }
        
        formData.actions.forEach((action, index) => {
            if (action.action_type_id && (!action.radius || parseFloat(action.radius) < 0)) {
                newErrors[`action_${index}_radius`] = 'Введите корректный радиус';
            }
            if (action.radius && parseFloat(action.radius) > 0 && !action.action_type_id) {
                newErrors[`action_${index}_type`] = 'Выберите тип действия';
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        setErrors({});
        
        try {
            const dataToSend = {
                country: formData.country,
                title: formData.title.trim(),
                label: formData.label.trim() || null,
                type: formData.type || null,
                marker: formData.marker || null,
                branch: formData.branch || null,
                parent: formData.parent || null,
                lat: parseFloat(formData.lat),
                lng: parseFloat(formData.lng),
                actions: formData.actions
                    .filter(action => action.action_type_id && action.radius > 0)
                    .map(action => ({
                        action_type_id: parseInt(action.action_type_id),
                        radius: parseFloat(action.radius)
                    }))
            };
            
            await axios.put(`${API_ROOT}/api/v1/targets/${targetId}/`, dataToSend);
            
            // Сохраняем формуляр
            const items = Object.entries(formularData).map(([sectionId, content]) => ({
                section_id: parseInt(sectionId),
                content: content || ''
            }));
            
            await axios.post(`${API_ROOT}/api/v1/formular/${targetId}/bulk/`, { items });
            
            if (onTargetUpdated) {
                onTargetUpdated();
            }
            
            onClose();
        } catch (error) {
            console.error('Ошибка при обновлении объекта:', error);
            if (error.response && error.response.data) {
                setErrors(error.response.data);
            } else {
                setErrors({ general: 'Произошла ошибка при сохранении' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderSection = (section, level = 0) => {
        if (section.is_hidden) return null;
        
        const hasChildren = section.children && section.children.length > 0;
        const isParent = hasChildren;
        const isRoot = level === 0;
        const attachments = attachmentsBySection[section.id] || [];
        const draft = attachmentDrafts[section.id] || { title: "", description: "", files: [], uploading: false };
        const isAttachmentFormOpen = !!attachmentFormsOpen[section.id];
        
        return (
            <div key={section.id} className={`edit-target-modal__section edit-target-modal__section--level-${level}`}>
                {isParent ? (
                    <h4 className={`edit-target-modal__section-title edit-target-modal__section-title--level-${level}`}>
                        {section.title}
                    </h4>
                ) : (
                    <div className={`edit-target-modal__field${isRoot ? " edit-target-modal__field--root" : ""}`}>
                        {isRoot ? (
                            <h4 className="edit-target-modal__section-title edit-target-modal__section-title--level-0">
                                {section.title}
                            </h4>
                        ) : (
                            <label className="edit-target-modal__label--small">
                                {section.title}
                            </label>
                        )}
                        <textarea
                            className="edit-target-modal__textarea"
                            value={formularData[section.id] || ''}
                            onChange={(e) => handleFormularChange(section.id, e.target.value)}
                            placeholder="Введите информацию..."
                            rows={2}
                        />

                        <div className="edit-target-modal__attachments">
                            <div className="edit-target-modal__attachments-title">Изображения</div>
                            {attachments.length > 0 && (
                                <div className="edit-target-modal__attachments-list">
                                    {attachments.map((item) => (
                                        <div key={item.id} className="edit-target-modal__attachment-card">
                                            <button
                                                type="button"
                                                className="edit-target-modal__attachment-thumb"
                                                onClick={() => setPreviewImage(item)}
                                            >
                                                <img src={item.image} alt={item.title} />
                                            </button>
                                            <div className="edit-target-modal__attachment-info">
                                                <strong>{item.title}</strong>
                                                {item.description && <p>{item.description}</p>}
                                            </div>
                                            <button
                                                type="button"
                                                className="edit-target-modal__attachment-remove"
                                                onClick={() => handleAttachmentDelete(section.id, item.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!isAttachmentFormOpen ? (
                                <button
                                    type="button"
                                    className="edit-target-modal__attachment-toggle"
                                    onClick={() =>
                                        setAttachmentFormsOpen((prev) => ({
                                            ...prev,
                                            [section.id]: true
                                        }))
                                    }
                                >
                                    Добавить изображение
                                </button>
                            ) : (
                                <div className="edit-target-modal__attachment-form">
                                    <input
                                        type="text"
                                        className="edit-target-modal__input"
                                        placeholder="Название изображения"
                                        value={draft.title}
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "title", e.target.value)}
                                    />
                                    <textarea
                                        className="edit-target-modal__textarea"
                                        placeholder="Описание (необязательно)"
                                        rows={2}
                                        value={draft.description}
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "description", e.target.value)}
                                    />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "files", Array.from(e.target.files || []))}
                                    />
                                    <div className="edit-target-modal__attachment-actions">
                                        <button
                                            type="button"
                                            className="edit-target-modal__button edit-target-modal__button--save"
                                            onClick={() => handleAttachmentUpload(section.id)}
                                            disabled={!draft.files.length || !draft.title?.trim() || draft.uploading}
                                        >
                                            {draft.uploading ? "Загрузка..." : "Добавить"}
                                        </button>
                                        <button
                                            type="button"
                                            className="edit-target-modal__button edit-target-modal__button--cancel"
                                            onClick={() =>
                                                setAttachmentFormsOpen((prev) => ({
                                                    ...prev,
                                                    [section.id]: false
                                                }))
                                            }
                                            disabled={draft.uploading}
                                        >
                                            Скрыть
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {hasChildren && (
                    <div className="edit-target-modal__subsections">
                        {section.children.map(child => renderSection(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="edit-target-modal__overlay">
            <div className="edit-target-modal__content" onClick={(e) => e.stopPropagation()}>
                <div className="edit-target-modal__header">
                    <h2>Редактирование объекта</h2>
                    <button 
                        className="edit-target-modal__close"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                
                {errors.general && (
                    <div className="edit-target-modal__error-general">
                        {errors.general}
                    </div>
                )}
                
                <div className="edit-target-modal__tabs">
                    <button
                        className={`edit-target-modal__tab ${activeTab === 'target' ? 'edit-target-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('target')}
                    >
                        Основная информация
                    </button>
                    <button
                        className={`edit-target-modal__tab ${activeTab === 'formular' ? 'edit-target-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('formular')}
                    >
                        Формуляр
                    </button>
                </div>
                
                <div className="edit-target-modal__body">
                    {loading ? (
                        <div className="edit-target-modal__loading">Загрузка...</div>
                    ) : (
                        <>
                            {activeTab === 'target' && (
                                <div className="edit-target-modal__tab-content">
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Страна <span className="edit-target-modal__required">*</span>
                                        </label>
                                        <div className="edit-target-modal__country-select" ref={countryDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className={`edit-target-modal__country-trigger ${errors.country ? 'edit-target-modal__input--error' : ''}`}
                                                onClick={countryDropdown.handleToggle}
                                            >
                                                <span>{formData.country ? countries.find(c => c.id === formData.country)?.title || 'Выберите страну' : 'Выберите страну'}</span>
                                                <svg 
                                                    className={`edit-target-modal__country-arrow${countryDropdown.isOpen ? ' edit-target-modal__country-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {countryDropdown.isOpen && (
                                                <div className="edit-target-modal__country-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={countryDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск страны..."
                                                            value={countryDropdown.search}
                                                            onChange={(e) => countryDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__country-list">
                                                        {countryDropdown.filtered.length > 0 ? (
                                                            countryDropdown.filtered.map(country => (
                                                                <button
                                                                    key={country.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__country-option${formData.country === country.id ? ' edit-target-modal__country-option--selected' : ''}`}
                                                                    onClick={() => countryDropdown.handleSelect(country.id)}
                                                                >
                                                                    {country.title}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {errors.country && (
                                            <span className="edit-target-modal__error">{errors.country}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">Тип объекта</label>
                                        <select
                                            name="type"
                                            value={formData.type}
                                            onChange={handleChange}
                                            className={`edit-target-modal__select ${errors.type ? 'edit-target-modal__input--error' : ''}`}
                                        >
                                            <option value="">Выберите тип</option>
                                            {targetTypes.map((type) => (
                                                <option key={type.id} value={type.id}>
                                                    {type.title}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.type && (
                                            <span className="edit-target-modal__error">{errors.type}</span>
                                        )}
                                    </div>

                                    {/* Выбор Вида / рода войск (зависит от страны) */}
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">Вид / род войск</label>
                                        <div className="edit-target-modal__marker-select" ref={branchDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className={`edit-target-modal__marker-trigger ${errors.branch ? 'edit-target-modal__input--error' : ''}`}
                                                onClick={branchDropdown.handleToggle}
                                            >
                                                <span>{formData.branch ? availableBranches.find(b => b.id === formData.branch)?.title || 'Выберите вид/род войск' : 'Выберите вид/род войск (необязательно)'}</span>
                                                <svg 
                                                    className={`edit-target-modal__marker-arrow${branchDropdown.isOpen ? ' edit-target-modal__marker-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {branchDropdown.isOpen && (
                                                <div className="edit-target-modal__marker-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={branchDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск вида/рода войск..."
                                                            value={branchDropdown.search}
                                                            onChange={(e) => branchDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__marker-list">
                                                        {branchDropdown.filtered.length > 0 ? (
                                                            branchDropdown.filtered.map(branchItem => (
                                                                <button
                                                                    key={branchItem.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__marker-option${formData.branch === branchItem.id ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                                    onClick={() => branchDropdown.handleSelect(branchItem.id)}
                                                                >
                                                                    {branchItem.title}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено (для выбранной страны)</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {errors.branch && (
                                            <span className="edit-target-modal__error">{errors.branch}</span>
                                        )}
                                    </div>

                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Наименование объекта <span className="edit-target-modal__required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            className={`edit-target-modal__input ${errors.title ? 'edit-target-modal__input--error' : ''}`}
                                            placeholder="Введите название"
                                        />
                                        {errors.title && (
                                            <span className="edit-target-modal__error">{errors.title}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Метка
                                        </label>
                                        <input
                                            type="text"
                                            name="label"
                                            value={formData.label}
                                            onChange={handleChange}
                                            className="edit-target-modal__input"
                                            placeholder="Введите метку (необязательно)"
                                        />
                                    </div>
                                    
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Маркер
                                        </label>
                                        <div className="edit-target-modal__marker-select" ref={markerDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className="edit-target-modal__marker-trigger"
                                                onClick={markerDropdown.handleToggle}
                                            >
                                                {formData.marker ? (
                                                    <div className="edit-target-modal__marker-selected">
                                                        {markerSvgs.get(formData.marker) && (
                                                            <div 
                                                                className="edit-target-modal__marker-icon"
                                                                dangerouslySetInnerHTML={{ 
                                                                    __html: addColorClassToSvg(
                                                                        markerSvgs.get(formData.marker), 
                                                                        selectedCountryColor
                                                                    ) 
                                                                }}
                                                            />
                                                        )}
                                                        <span>{markers.find(m => m.id === formData.marker)?.title || 'Выберите маркер'}</span>
                                                    </div>
                                                ) : (
                                                    <span>Без маркера</span>
                                                )}
                                                <svg 
                                                    className={`edit-target-modal__marker-arrow${markerDropdown.isOpen ? ' edit-target-modal__marker-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {markerDropdown.isOpen && (
                                                <div className="edit-target-modal__marker-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={markerDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск маркера..."
                                                            value={markerDropdown.search}
                                                            onChange={(e) => markerDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__marker-list">
                                                        <button
                                                            type="button"
                                                            className={`edit-target-modal__marker-option${!formData.marker ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                            onClick={() => markerDropdown.handleSelect('')}
                                                        >
                                                            <span>Без маркера</span>
                                                        </button>
                                                        {markerDropdown.filtered.length > 0 ? (
                                                            markerDropdown.filtered.map(marker => (
                                                                <button
                                                                    key={marker.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__marker-option${formData.marker === marker.id ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                                    onClick={() => markerDropdown.handleSelect(marker.id)}
                                                                >
                                                                    {markerSvgs.get(marker.id) && (
                                                                        <div 
                                                                            className="edit-target-modal__marker-icon"
                                                                            dangerouslySetInnerHTML={{ 
                                                                                __html: addColorClassToSvg(
                                                                                    markerSvgs.get(marker.id), 
                                                                                    selectedCountryColor
                                                                                ) 
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span>{marker.title}</span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Выбор parent */}
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">Вышестоящий объект (parent)</label>
                                        <div className="edit-target-modal__marker-select" ref={parentDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className={`edit-target-modal__marker-trigger ${errors.parent ? 'edit-target-modal__input--error' : ''}`}
                                                onClick={parentDropdown.handleToggle}
                                            >
                                                <span>{formData.parent ? parentOptions.find(p => p.id === formData.parent)?.title || 'Выберите вышестоящий' : 'Выберите вышестоящий (необязательно)'}</span>
                                                <svg 
                                                    className={`edit-target-modal__marker-arrow${parentDropdown.isOpen ? ' edit-target-modal__marker-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {parentDropdown.isOpen && (
                                                <div className="edit-target-modal__marker-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={parentDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск объекта..."
                                                            value={parentDropdown.search}
                                                            onChange={(e) => parentDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__marker-list">
                                                        <button
                                                            type="button"
                                                            className={`edit-target-modal__marker-option${!formData.parent ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                            onClick={() => parentDropdown.handleSelect('')}
                                                        >
                                                            (нет)
                                                        </button>
                                                        {parentDropdown.filtered.length > 0 ? (
                                                            parentDropdown.filtered.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__marker-option${formData.parent === p.id ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                                    onClick={() => parentDropdown.handleSelect(p.id)}
                                                                >
                                                                    {p.title}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {errors.parent && (
                                            <span className="edit-target-modal__error">{errors.parent}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-target-modal__row">
                                        <div className="edit-target-modal__field">
                                            <label className="edit-target-modal__label">
                                                Широта <span className="edit-target-modal__required">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                name="lat"
                                                value={formData.lat}
                                                onChange={handleChange}
                                                step="0.000001"
                                                className={`edit-target-modal__input ${errors.lat ? 'edit-target-modal__input--error' : ''}`}
                                                placeholder="Например: 55.751244"
                                            />
                                            {errors.lat && (
                                                <span className="edit-target-modal__error">{errors.lat}</span>
                                            )}
                                        </div>
                                        
                                        <div className="edit-target-modal__field">
                                            <label className="edit-target-modal__label">
                                                Долгота <span className="edit-target-modal__required">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                name="lng"
                                                value={formData.lng}
                                                onChange={handleChange}
                                                step="0.000001"
                                                className={`edit-target-modal__input ${errors.lng ? 'edit-target-modal__input--error' : ''}`}
                                                placeholder="Например: 37.618423"
                                            />
                                            {errors.lng && (
                                                <span className="edit-target-modal__error">{errors.lng}</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="edit-target-modal__section">
                                        <div className="edit-target-modal__section-header">
                                            <label className="edit-target-modal__label">
                                                Действия объекта
                                            </label>
                                            <button
                                                type="button"
                                                className="edit-target-modal__button-add-action"
                                                onClick={handleAddAction}
                                            >
                                                + Добавить действие
                                            </button>
                                        </div>
                                        
                                        {formData.actions.length > 0 && (
                                            <div className="edit-target-modal__actions-list">
                                                {formData.actions.map((action, index) => (
                                                    <div key={index} className="edit-target-modal__action-item">
                                                        <div className="edit-target-modal__action-fields">
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">
                                                                    Тип действия
                                                                </label>
                                                                <select
                                                                    value={action.action_type_id}
                                                                    onChange={(e) => handleActionChange(index, 'action_type_id', e.target.value)}
                                                                    className={`edit-target-modal__select ${errors[`action_${index}_type`] ? 'edit-target-modal__input--error' : ''}`}
                                                                >
                                                                    <option value="">Выберите тип</option>
                                                                    {actionTypes.map(type => (
                                                                        <option key={type.id} value={type.id}>
                                                                            {type.title}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {errors[`action_${index}_type`] && (
                                                                    <span className="edit-target-modal__error">{errors[`action_${index}_type`]}</span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">
                                                                    Радиус, км
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={action.radius}
                                                                    onChange={(e) => handleActionChange(index, 'radius', e.target.value)}
                                                                    step="0.1"
                                                                    min="0"
                                                                    className={`edit-target-modal__input ${errors[`action_${index}_radius`] ? 'edit-target-modal__input--error' : ''}`}
                                                                    placeholder="0"
                                                                />
                                                                {errors[`action_${index}_radius`] && (
                                                                    <span className="edit-target-modal__error">{errors[`action_${index}_radius`]}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__button-remove-action"
                                                            onClick={() => handleRemoveAction(index)}
                                                            aria-label="Удалить действие"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {activeTab === 'formular' && (
                                <div className="edit-target-modal__tab-content">
                                    {sections.map(section => renderSection(section))}
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                <div className="edit-target-modal__footer">
                    <button
                        type="button"
                        className="edit-target-modal__button edit-target-modal__button--cancel"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="edit-target-modal__button edit-target-modal__button--save"
                        onClick={handleSave}
                        disabled={isSubmitting || loading}
                    >
                        {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                </div>
            </div>
            {previewImage && (
                <div className="edit-target-modal__image-preview" onClick={() => setPreviewImage(null)}>
                    <div className="edit-target-modal__image-preview-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="edit-target-modal__image-preview-close"
                            onClick={() => setPreviewImage(null)}
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                        <img src={previewImage.image} alt={previewImage.title} />
                        <div className="edit-target-modal__image-preview-caption">
                            <strong>{previewImage.title}</strong>
                            {previewImage.description && <p>{previewImage.description}</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
