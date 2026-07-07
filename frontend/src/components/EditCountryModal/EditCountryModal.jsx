import { useState, useEffect } from 'react';
import axios from 'axios';
import MarkdownEditor from '../common/MarkdownEditor/MarkdownEditor';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import './EditCountryModal.css';
import { API_URL } from '../../config/api';

const API_ROOT = API_URL;

export default function EditCountryModal({ countryId, countryIso, isOpen, onClose, onCountryUpdated, isNewCountry = false }) {
    const [activeTab, setActiveTab] = useState('country');
    const [formData, setFormData] = useState({
        title: '',
        title_short: '',
        iso_code: countryIso || '',
        color: 'blue'
    });
    
    const [countryInfos, setCountryInfos] = useState([]);
    const [sections, setSections] = useState([]);
    const [attachmentsBySection, setAttachmentsBySection] = useState({});
    const [attachmentFormsOpen, setAttachmentFormsOpen] = useState({});
    const [attachmentDrafts, setAttachmentDrafts] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(!isNewCountry);
    
    const colorOptions = [
        { value: 'blue', label: 'Синий' },
        { value: 'green', label: 'Зеленый' },
        { value: 'red', label: 'Красный' },
        { value: 'yellow', label: 'Желтый' }
    ];
    
    useEffect(() => {
        if (isOpen) {
            if (isNewCountry) {
                // Для новой страны просто устанавливаем ISO код из GeoJSON
                setFormData(prev => ({
                    ...prev,
                    iso_code: countryIso || ''
                }));
                loadSections();
            } else if (countryId) {
                loadData();
            }
        }
    }, [isOpen, countryId, isNewCountry, countryIso]);
    
    const loadAttachments = async (id) => {
        try {
            const attachmentsRes = await axios.get(`${API_ROOT}/api/v1/country-attachments/`, {
                params: { country: id }
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
            console.warn('Ошибка загрузки изображений страны:', err);
            setAttachmentsBySection({});
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [countryRes, countryInfoRes, sectionsRes] = await Promise.all([
                axios.get(`${API_ROOT}/api/v1/countries/${countryId}/`),
                axios.get(`${API_ROOT}/api/v1/country/${countryIso}/`),
                axios.get(`${API_ROOT}/api/v1/country-sections/`)
            ]);
            
            const country = countryRes.data;
            setFormData({
                title: country.title || '',
                title_short: country.title_short || '',
                iso_code: country.iso_code || '',
                color: country.color || 'blue'
            });
            
            setCountryInfos(countryInfoRes.data || []);
            setSections(sectionsRes.data || []);
            if (countryId) {
                await loadAttachments(countryId);
            }
        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            if (err.response?.status === 404) {
                // Если CountryInfo не найдено, это нормально
                setCountryInfos([]);
                setAttachmentsBySection({});
            } else {
                setErrors({ general: 'Не удалось загрузить данные' });
            }
        } finally {
            setLoading(false);
        }
    };
    
    const loadSections = async () => {
        try {
            const sectionsRes = await axios.get(`${API_ROOT}/api/v1/country-sections/`);
            setSections(sectionsRes.data);
        } catch (err) {
            console.error('Ошибка загрузки секций:', err);
        }
    };
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };
    
    const handleCountryInfoChange = (index, value) => {
        const newInfos = [...countryInfos];
        newInfos[index] = { ...newInfos[index], content: value };
        setCountryInfos(newInfos);
    };
    
    const handleAddSection = () => {
        // Добавляем пустой раздел
        setCountryInfos([...countryInfos, {
            section: null,
            content: '',
            isNew: true
        }]);
    };
    
    const handleRemoveSection = (index) => {
        const newInfos = countryInfos.filter((_, i) => i !== index);
        setCountryInfos(newInfos);
    };
    
    const handleSectionChange = (index, sectionId) => {
        const newInfos = [...countryInfos];
        const section = sections.find(s => s.id === parseInt(sectionId));
        newInfos[index] = { 
            ...newInfos[index], 
            section: section 
        };
        setCountryInfos(newInfos);
    };

    const handleAttachmentDraftChange = (sectionId, field, value) => {
        setAttachmentDrafts(prev => {
            const draft = prev[sectionId] || { title: '', description: '', files: [], uploading: false };
            return {
                ...prev,
                [sectionId]: {
                    ...draft,
                    [field]: value
                }
            };
        });
    };

    const handleAttachmentUpload = async (sectionId) => {
        if (!countryId) return;
        const draft = attachmentDrafts[sectionId] || { title: '', description: '', files: [], uploading: false };
        if (!draft.files || draft.files.length === 0) return;

        setAttachmentDrafts(prev => ({
            ...prev,
            [sectionId]: { ...draft, uploading: true }
        }));

        try {
            for (const file of draft.files) {
                const formData = new FormData();
                formData.append('country', countryId);
                formData.append('section', sectionId);
                formData.append('title', draft.title || file.name);
                formData.append('description', draft.description || '');
                formData.append('image', file);

                const resp = await axios.post(`${API_ROOT}/api/v1/country-attachments/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                setAttachmentsBySection(prev => {
                    const current = prev[sectionId] || [];
                    return {
                        ...prev,
                        [sectionId]: [...current, resp.data]
                    };
                });
            }

            setAttachmentDrafts(prev => ({
                ...prev,
                [sectionId]: { title: '', description: '', files: [], uploading: false }
            }));
            setAttachmentFormsOpen(prev => ({
                ...prev,
                [sectionId]: false
            }));
        } catch (err) {
            console.error('Ошибка загрузки изображения:', err);
            setAttachmentDrafts(prev => ({
                ...prev,
                [sectionId]: { ...draft, uploading: false }
            }));
        }
    };

    const handleAttachmentDelete = async (sectionId, attachmentId) => {
        try {
            await axios.delete(`${API_ROOT}/api/v1/country-attachments/${attachmentId}/`);
            setAttachmentsBySection(prev => {
                const current = prev[sectionId] || [];
                return {
                    ...prev,
                    [sectionId]: current.filter(item => item.id !== attachmentId)
                };
            });
        } catch (err) {
            console.error('Ошибка удаления изображения:', err);
        }
    };
    
    // Проверка заполнения обязательных полей для доступа к вкладке CountryInfo
    const isBasicInfoFilled = () => {
        return formData.title.trim() !== '' && 
               formData.title_short.trim() !== '' && 
               formData.iso_code.trim() !== '' &&
               formData.iso_code.length <= 3;
    };
    
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.title || formData.title.trim() === '') {
            newErrors.title = 'Название обязательно';
        }
        
        if (!formData.title_short || formData.title_short.trim() === '') {
            newErrors.title_short = 'Сокращение обязательно';
        }
        
        if (!formData.iso_code || formData.iso_code.trim() === '') {
            newErrors.iso_code = 'ISO код обязателен';
        } else if (formData.iso_code.length > 3) {
            newErrors.iso_code = 'ISO код не должен превышать 3 символа';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        setErrors({});
        
        try {
            const dataToSend = {
                title: formData.title.trim(),
                title_short: formData.title_short.trim().toUpperCase(),
                iso_code: formData.iso_code.trim().toUpperCase(),
                color: formData.color
            };
            
            let savedCountry;
            if (isNewCountry) {
                const response = await axios.post(`${API_ROOT}/api/v1/countries/`, dataToSend);
                savedCountry = response.data;
            } else {
                const response = await axios.put(`${API_ROOT}/api/v1/countries/${countryId}/`, dataToSend);
                savedCountry = response.data;
            }
            
            // Сохраняем CountryInfo
            if (countryInfos.length > 0) {
                const countryIdToUse = savedCountry.id;
                
                for (const info of countryInfos) {
                    if (!info.section || !info.section.id) continue;
                    
                    const infoData = {
                        country: countryIdToUse,
                        section: info.section.id,
                        content: info.content || ''
                    };
                    
                    if (info.id) {
                        // Обновляем существующий
                        await axios.put(`${API_ROOT}/api/v1/country-infos/${info.id}/`, infoData);
                    } else {
                        // Создаем новый
                        await axios.post(`${API_ROOT}/api/v1/country-infos/`, infoData);
                    }
                }
            }
            
            if (onCountryUpdated) {
                onCountryUpdated(savedCountry);
            }
            onClose();
        } catch (err) {
            console.error('Ошибка при сохранении:', err);
            
            if (err.response?.data) {
                const serverErrors = {};
                Object.keys(err.response.data).forEach(key => {
                    const value = err.response.data[key];
                    serverErrors[key] = Array.isArray(value) ? value[0] : value;
                });
                setErrors(serverErrors);
            } else {
                setErrors({ general: 'Не удалось сохранить данные' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <>
            <div className="edit-country-modal-overlay" onClick={handleOverlayClick}>
                <div className="edit-country-modal">
                <div className="edit-country-modal__header">
                    <h2 className="edit-country-modal__title">
                        {isNewCountry ? 'Добавить страну' : 'Редактировать страну'}
                    </h2>
                    <button 
                        className="edit-country-modal__close" 
                        onClick={onClose}
                        disabled={isSubmitting}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                
                {errors.general && (
                    <div className="edit-country-modal__error-general">
                        {errors.general}
                    </div>
                )}
                
                <div className="edit-country-modal__tabs">
                    <button
                        className={`edit-country-modal__tab ${activeTab === 'country' ? 'edit-country-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('country')}
                    >
                        Основная информация
                    </button>
                    <button
                        className={`edit-country-modal__tab ${activeTab === 'info' ? 'edit-country-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('info')}
                        disabled={isNewCountry && !isBasicInfoFilled()}
                        title={isNewCountry && !isBasicInfoFilled() ? 'Заполните все обязательные поля' : ''}
                    >
                        Информация о стране
                    </button>
                </div>
                
                <div className="edit-country-modal__body">
                    {loading ? (
                        <div className="edit-country-modal__loading">Загрузка...</div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {activeTab === 'country' && (
                                <div className="edit-country-modal__tab-content">
                                    <div className="edit-country-modal__field">
                                        <label htmlFor="title" className="edit-country-modal__label">
                                            Название <span className="edit-country-modal__required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="title"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            className={`edit-country-modal__input ${errors.title ? 'edit-country-modal__input--error' : ''}`}
                                            disabled={isSubmitting}
                                            placeholder="Введите название страны"
                                        />
                                        {errors.title && (
                                            <span className="edit-country-modal__error">{errors.title}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-country-modal__field">
                                        <label htmlFor="title_short" className="edit-country-modal__label">
                                            Сокращение <span className="edit-country-modal__required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="title_short"
                                            name="title_short"
                                            value={formData.title_short}
                                            onChange={handleChange}
                                            className={`edit-country-modal__input ${errors.title_short ? 'edit-country-modal__input--error' : ''}`}
                                            disabled={isSubmitting}
                                            maxLength="10"
                                            placeholder="Введите сокращение"
                                        />
                                        {errors.title_short && (
                                            <span className="edit-country-modal__error">{errors.title_short}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-country-modal__field">
                                        <label htmlFor="iso_code" className="edit-country-modal__label">
                                            ISO код <span className="edit-country-modal__required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="iso_code"
                                            name="iso_code"
                                            value={formData.iso_code}
                                            onChange={handleChange}
                                            className={`edit-country-modal__input ${errors.iso_code ? 'edit-country-modal__input--error' : ''}`}
                                            disabled={isSubmitting}
                                            readOnly
                                            maxLength="3"
                                            placeholder="KAZ"
                                        />
                                        {errors.iso_code && (
                                            <span className="edit-country-modal__error">{errors.iso_code}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-country-modal__field">
                                        <label htmlFor="color" className="edit-country-modal__label">
                                            Цвет маркера <span className="edit-country-modal__required">*</span>
                                        </label>
                                        <select
                                            id="color"
                                            name="color"
                                            value={formData.color}
                                            onChange={handleChange}
                                            className={`edit-country-modal__select ${errors.color ? 'edit-country-modal__input--error' : ''}`}
                                            disabled={isSubmitting}
                                        >
                                            {colorOptions.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.color && (
                                            <span className="edit-country-modal__error">{errors.color}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {activeTab === 'info' && (
                                <div className="edit-country-modal__tab-content">
                                    <div className="edit-country-modal__info-sections">
                                        {countryInfos.map((info, index) => (
                                            <div key={index} className="edit-country-modal__info-section">
                                                <div className="edit-country-modal__info-section-header">
                                                    {info.isNew ? (
                                                        <select
                                                            value={info.section?.id || ''}
                                                            onChange={(e) => handleSectionChange(index, e.target.value)}
                                                            className="edit-country-modal__section-select"
                                                            disabled={isSubmitting}
                                                        >
                                                            <option value="">Выберите раздел</option>
                                                            {sections.map(section => (
                                                                <option key={section.id} value={section.id}>
                                                                    {section.title}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <label className="edit-country-modal__info-label">
                                                            {info.section?.title}
                                                        </label>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSection(index)}
                                                        className="edit-country-modal__remove-section"
                                                        disabled={isSubmitting}
                                                        title="Удалить раздел"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <MarkdownEditor
                                                    value={info.content || ''}
                                                    onChange={(val) => handleCountryInfoChange(index, val)}
                                                    placeholder="Введите содержание"
                                                    rows={4}
                                                    disabled={isSubmitting}
                                                />
                                                {info.section?.id ? (
                                                    <div className="edit-country-modal__attachments">
                                                        <div className="edit-country-modal__attachments-title">Изображения</div>
                                                        {(() => {
                                                            const sectionId = info.section.id;
                                                            const attachments = attachmentsBySection[sectionId] || [];
                                                            const draft = attachmentDrafts[sectionId] || { title: '', description: '', files: [], uploading: false };
                                                            const isAttachmentFormOpen = !!attachmentFormsOpen[sectionId];

                                                            return (
                                                                <>
                                                                    {attachments.length > 0 && (
                                                                        <div className="edit-country-modal__attachments-list">
                                                                            {attachments.map((item) => (
                                                                                <div key={item.id} className="edit-country-modal__attachment-card">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="edit-country-modal__attachment-thumb"
                                                                                        onClick={() => setPreviewImage(item)}
                                                                                    >
                                                                                        <img src={item.image} alt={item.title} />
                                                                                    </button>
                                                                                    <div className="edit-country-modal__attachment-info">
                                                                                        <strong>{item.title}</strong>
                                                                                        {item.description && (
                                                                                            <MarkdownContent variant="compact">
                                                                                                {item.description}
                                                                                            </MarkdownContent>
                                                                                        )}
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="edit-country-modal__attachment-remove"
                                                                                        onClick={() => handleAttachmentDelete(sectionId, item.id)}
                                                                                        disabled={draft.uploading || isSubmitting}
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {!countryId ? (
                                                                        <div className="edit-country-modal__attachments-hint">
                                                                            Сначала сохраните страну, чтобы добавить изображения.
                                                                        </div>
                                                                    ) : !isAttachmentFormOpen ? (
                                                                        <button
                                                                            type="button"
                                                                            className="edit-country-modal__attachment-toggle"
                                                                            onClick={() => setAttachmentFormsOpen((prev) => ({
                                                                                ...prev,
                                                                                [sectionId]: true
                                                                            }))}
                                                                        >
                                                                            Добавить изображение
                                                                        </button>
                                                                    ) : (
                                                                        <div className="edit-country-modal__attachment-form">
                                                                            <input
                                                                                type="text"
                                                                                className="edit-country-modal__input"
                                                                                placeholder="Название изображения"
                                                                                value={draft.title}
                                                                                onChange={(e) => handleAttachmentDraftChange(sectionId, 'title', e.target.value)}
                                                                            />
                                                                            <MarkdownEditor
                                                                                variant="compact"
                                                                                value={draft.description}
                                                                                onChange={(val) => handleAttachmentDraftChange(sectionId, 'description', val)}
                                                                                placeholder="Описание (необязательно)"
                                                                                rows={2}
                                                                            />
                                                                            <input
                                                                                type="file"
                                                                                multiple
                                                                                accept="image/*"
                                                                                onChange={(e) => handleAttachmentDraftChange(sectionId, 'files', Array.from(e.target.files || []))}
                                                                            />
                                                                            <div className="edit-country-modal__attachment-actions">
                                                                                <button
                                                                                    type="button"
                                                                                    className="edit-country-modal__button edit-country-modal__button--submit"
                                                                                    onClick={() => handleAttachmentUpload(sectionId)}
                                                                                    disabled={draft.uploading || draft.files.length === 0}
                                                                                >
                                                                                    {draft.uploading ? 'Загрузка...' : 'Загрузить'}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="edit-country-modal__button edit-country-modal__button--cancel"
                                                                                    onClick={() => setAttachmentFormsOpen((prev) => ({
                                                                                        ...prev,
                                                                                        [sectionId]: false
                                                                                    }))}
                                                                                >
                                                                                    Отмена
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="edit-country-modal__attachments-hint">
                                                        Выберите раздел, чтобы добавить изображения.
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={handleAddSection}
                                        className="edit-country-modal__add-section"
                                        disabled={isSubmitting}
                                    >
                                        + Добавить раздел
                                    </button>
                                </div>
                            )}
                            
                            <div className="edit-country-modal__buttons">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="edit-country-modal__button edit-country-modal__button--cancel"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="edit-country-modal__button edit-country-modal__button--submit"
                                >
                                    {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
                </div>
            </div>

            {previewImage && (
                <div className="edit-country-modal__image-preview" onClick={() => setPreviewImage(null)}>
                    <div className="edit-country-modal__image-preview-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="edit-country-modal__image-preview-close"
                            onClick={() => setPreviewImage(null)}
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                        <img src={previewImage.image} alt={previewImage.title} />
                        <div className="edit-country-modal__image-preview-caption">
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
