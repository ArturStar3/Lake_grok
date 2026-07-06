import { useState, useEffect } from 'react';
import axios from 'axios';
import MarkdownEditor from '../common/MarkdownEditor/MarkdownEditor';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import './FormularEditor.css';

import { API_URL as API_ROOT } from '../../config/api';

export default function FormularEditor({ targetId, targetTitle, isOpen, onClose, onSaved }) {
    const [sections, setSections] = useState([]);
    const [formularData, setFormularData] = useState({});
    const [attachmentsBySection, setAttachmentsBySection] = useState({});
    const [attachmentDrafts, setAttachmentDrafts] = useState({});
    const [attachmentFormsOpen, setAttachmentFormsOpen] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        if (isOpen && targetId) {
            loadFormularStructure();
        }
    }, [isOpen, targetId]);
    
    const loadFormularStructure = async () => {
        setLoading(true);
        setError(null);
        
        try {
            // Загружаем структуру разделов формуляра
            const sectionsRes = await axios.get(`${API_ROOT}/api/v1/formular-sections/`);
            const allSections = sectionsRes.data;
            
            // Организуем разделы в иерархию
            const organized = organizeIntoHierarchy(allSections);
            setSections(organized);
            
            // Загружаем существующие данные формуляра для этого объекта
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
                // Если формуляра еще нет - это нормально, создадим пустой
                if (err.response?.status !== 404) {
                    console.warn('Ошибка загрузки существующего формуляра:', err);
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
        } catch (err) {
            console.error('Ошибка загрузки структуры формуляра:', err);
            setError('Не удалось загрузить структуру формуляра');
        } finally {
            setLoading(false);
        }
    };
    
    const organizeIntoHierarchy = (sections) => {
        const sectionMap = {};
        const rootSections = [];
        
        // Создаем карту всех разделов
        sections.forEach(section => {
            sectionMap[section.id] = { ...section, children: [] };
        });
        
        // Строим иерархию
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
        
        // Сортируем по order
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
    
    const handleContentChange = (sectionId, value) => {
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
    
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        
        try {
            // Отправляем данные на сервер
            const items = Object.entries(formularData).map(([sectionId, content]) => ({
                section_id: parseInt(sectionId),
                content: content || ''
            }));
            
            await axios.post(`${API_ROOT}/api/v1/formular/${targetId}/bulk/`, {
                items
            });
            
            if (onSaved) {
                onSaved();
            }
            
            onClose();
        } catch (err) {
            console.error('Ошибка сохранения формуляра:', err);
            setError(err.response?.data?.detail || 'Не удалось сохранить формуляр');
        } finally {
            setSaving(false);
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
            <div key={section.id} className={`formular-editor__section formular-editor__section--level-${level}`}>
                {isParent ? (
                    <h3 className={`formular-editor__section-title formular-editor__section-title--level-${level}`}>
                        {section.title}
                    </h3>
                ) : (
                    <div className={`formular-editor__field${isRoot ? " formular-editor__field--root" : ""}`}>
                        {isRoot ? (
                            <h3 className="formular-editor__section-title formular-editor__section-title--level-0">
                                {section.title}
                            </h3>
                        ) : (
                            <label className="formular-editor__label">
                                {section.title}
                            </label>
                        )}
                        <MarkdownEditor
                            className="formular-editor__markdown"
                            value={formularData[section.id] || ''}
                            onChange={(val) => handleContentChange(section.id, val)}
                            placeholder="Введите информацию..."
                            rows={3}
                        />

                        <div className="formular-editor__attachments">
                            <div className="formular-editor__attachments-title">Изображения</div>
                            {attachments.length > 0 && (
                                <div className="formular-editor__attachments-list">
                                    {attachments.map((item) => (
                                        <div key={item.id} className="formular-editor__attachment-card">
                                            <button
                                                type="button"
                                                className="formular-editor__attachment-thumb"
                                                onClick={() => setPreviewImage(item)}
                                            >
                                                <img src={item.image} alt={item.title} />
                                            </button>
                                            <div className="formular-editor__attachment-info">
                                                <strong>{item.title}</strong>
                                                {item.description && (
                                                    <MarkdownContent variant="compact">{item.description}</MarkdownContent>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="formular-editor__attachment-remove"
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
                                    className="formular-editor__attachment-toggle"
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
                                <div className="formular-editor__attachment-form">
                                    <input
                                        type="text"
                                        className="formular-editor__input"
                                        placeholder="Название изображения"
                                        value={draft.title}
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "title", e.target.value)}
                                    />
                                    <MarkdownEditor
                                        variant="compact"
                                        value={draft.description}
                                        onChange={(val) => handleAttachmentDraftChange(section.id, 'description', val)}
                                        placeholder="Описание (необязательно)"
                                        rows={2}
                                    />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "files", Array.from(e.target.files || []))}
                                    />
                                    <div className="formular-editor__attachment-actions">
                                        <button
                                            type="button"
                                            className="formular-editor__button formular-editor__button--save"
                                            onClick={() => handleAttachmentUpload(section.id)}
                                            disabled={!draft.files.length || !draft.title?.trim() || draft.uploading}
                                        >
                                            {draft.uploading ? "Загрузка..." : "Добавить"}
                                        </button>
                                        <button
                                            type="button"
                                            className="formular-editor__button formular-editor__button--cancel"
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
                    <div className="formular-editor__subsections">
                        {section.children.map(child => renderSection(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="formular-editor__overlay" onClick={onClose}>
            <div className="formular-editor__content" onClick={(e) => e.stopPropagation()}>
                <div className="formular-editor__header">
                    <h2>Формуляр объекта</h2>
                    {targetTitle && (
                        <p className="formular-editor__subtitle">{targetTitle}</p>
                    )}
                    <button 
                        className="formular-editor__close"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                
                {error && (
                    <div className="formular-editor__error">
                        {error}
                    </div>
                )}
                
                <div className="formular-editor__body">
                    {loading ? (
                        <div className="formular-editor__loading">Загрузка...</div>
                    ) : (
                        sections.map(section => renderSection(section))
                    )}
                </div>
                
                <div className="formular-editor__footer">
                    <button
                        type="button"
                        className="formular-editor__button formular-editor__button--cancel"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="formular-editor__button formular-editor__button--save"
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        {saving ? 'Сохранение...' : 'Сохранить формуляр'}
                    </button>
                </div>
            </div>
            {previewImage && (
                <div className="formular-editor__image-preview" onClick={() => setPreviewImage(null)}>
                    <div className="formular-editor__image-preview-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="formular-editor__image-preview-close"
                            onClick={() => setPreviewImage(null)}
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                        <img src={previewImage.image} alt={previewImage.title} />
                        <div className="formular-editor__image-preview-caption">
                            <strong>{previewImage.title}</strong>
                            {previewImage.description && (
                                <MarkdownContent variant="compact">{previewImage.description}</MarkdownContent>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
