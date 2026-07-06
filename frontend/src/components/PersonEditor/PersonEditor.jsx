import { useState, useEffect } from 'react';
import axios from 'axios';
import { useDropdownWithSearch } from '../../hooks/useDropdownWithSearch';
import '../FormularEditor/FormularEditor.css';
import './PersonEditor.css';
import { API_URL } from '../../config/api';

const API_ROOT = API_URL;

export default function PersonEditor({
  personId,
  targetId,
  isOpen,
  onClose,
  onSaved,
}) {
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [sections, setSections] = useState([]);
  const [infoData, setInfoData] = useState({});
  const [attachmentsBySection, setAttachmentsBySection] = useState({});
  const [attachmentDrafts, setAttachmentDrafts] = useState({});
  const [attachmentFormsOpen, setAttachmentFormsOpen] = useState({});
  const [relations, setRelations] = useState([]);
  const [relationTypes, setRelationTypes] = useState([]);
  const [allPersons, setAllPersons] = useState([]);
  const [newRelationTypeId, setNewRelationTypeId] = useState('');
  const [newRelationPersonId, setNewRelationPersonId] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoFormOpen, setPhotoFormOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState({ title: '', files: [], uploading: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resolvedPersonId, setResolvedPersonId] = useState(personId);

  useEffect(() => {
    setResolvedPersonId(personId);
  }, [personId]);

  const relationPersonOptions = allPersons
    .filter((p) => p.id !== resolvedPersonId)
    .map((p) => ({ ...p, title: p.full_name || '—' }));

  const relationPersonDropdown = useDropdownWithSearch(
    relationPersonOptions,
    (id) => setNewRelationPersonId(id),
  );

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, personId, targetId]);

  const organizeIntoHierarchy = (items) => {
    const sectionMap = {};
    const rootSections = [];
    items.forEach((section) => {
      sectionMap[section.id] = { ...section, children: [] };
    });
    items.forEach((section) => {
      if (section.parent && sectionMap[section.parent]) {
        sectionMap[section.parent].children.push(sectionMap[section.id]);
      } else {
        rootSections.push(sectionMap[section.id]);
      }
    });
    const sortByOrder = (arr) => {
      arr.sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));
      arr.forEach((item) => {
        if (item.children.length) sortByOrder(item.children);
      });
    };
    sortByOrder(rootSections);
    return rootSections;
  };

  const loadPhotos = async (currentPersonId) => {
    if (!currentPersonId) {
      setPhotos([]);
      return;
    }
    const res = await axios.get(`${API_ROOT}/api/v1/person-photos/`, {
      params: { person: currentPersonId },
    });
    const list = Array.isArray(res.data) ? res.data : [];
    list.sort((a, b) => (a.order || 9999) - (b.order || 9999));
    setPhotos(list);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectionsRes, typesRes, personsRes] = await Promise.all([
        axios.get(`${API_ROOT}/api/v1/person-sections/`),
        axios.get(`${API_ROOT}/api/v1/relation-types/`),
        axios.get(`${API_ROOT}/api/v1/persons/`),
      ]);
      setSections(organizeIntoHierarchy(sectionsRes.data || []));
      setRelationTypes(typesRes.data || []);
      setAllPersons(personsRes.data || []);

      if (personId) {
        const [personRes, detailRes, attachmentsRes] = await Promise.all([
          axios.get(`${API_ROOT}/api/v1/persons/${personId}/`),
          axios.get(`${API_ROOT}/api/v1/person/${personId}/`),
          axios.get(`${API_ROOT}/api/v1/person-attachments/`, { params: { person: personId } }),
        ]);
        setFullName(personRes.data.full_name || '');
        setPosition(personRes.data.position || '');
        const existing = {};
        (detailRes.data.info || []).forEach((item) => {
          existing[item.section.id] = item.content || '';
        });
        setInfoData(existing);
        setRelations(detailRes.data.relations || []);
        const grouped = {};
        (attachmentsRes.data || []).forEach((item) => {
          if (!grouped[item.section]) grouped[item.section] = [];
          grouped[item.section].push(item);
        });
        setAttachmentsBySection(grouped);
        await loadPhotos(personId);
      } else {
        setFullName('');
        setPosition('');
        setInfoData({});
        setRelations([]);
        setAttachmentsBySection({});
        setPhotos([]);
      }
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (sectionId, value) => {
    setInfoData((prev) => ({ ...prev, [sectionId]: value }));
  };

  const handleAttachmentDraftChange = (sectionId, field, value) => {
    setAttachmentDrafts((prev) => ({
      ...prev,
      [sectionId]: {
        title: prev[sectionId]?.title || '',
        description: prev[sectionId]?.description || '',
        files: prev[sectionId]?.files || [],
        uploading: prev[sectionId]?.uploading || false,
        [field]: value,
      },
    }));
  };

  const handleAttachmentUpload = async (sectionId, currentPersonId) => {
    const draft = attachmentDrafts[sectionId];
    if (!draft?.files?.length || !draft.title?.trim() || !currentPersonId) return;
    handleAttachmentDraftChange(sectionId, 'uploading', true);
    try {
      const uploaded = [];
      for (const file of draft.files) {
        const formData = new FormData();
        formData.append('person', currentPersonId);
        formData.append('section', sectionId);
        formData.append('title', draft.title.trim());
        formData.append('description', draft.description || '');
        formData.append('image', file);
        const resp = await axios.post(`${API_ROOT}/api/v1/person-attachments/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push(resp.data);
      }
      setAttachmentsBySection((prev) => ({
        ...prev,
        [sectionId]: [...(prev[sectionId] || []), ...uploaded],
      }));
      setAttachmentDrafts((prev) => ({
        ...prev,
        [sectionId]: { title: '', description: '', files: [], uploading: false },
      }));
    } catch (err) {
      console.error(err);
      handleAttachmentDraftChange(sectionId, 'uploading', false);
    }
  };

  const handleAttachmentDelete = async (sectionId, attachmentId) => {
    await axios.delete(`${API_ROOT}/api/v1/person-attachments/${attachmentId}/`);
    setAttachmentsBySection((prev) => ({
      ...prev,
      [sectionId]: (prev[sectionId] || []).filter((item) => item.id !== attachmentId),
    }));
  };

  const handlePhotoUpload = async (currentPersonId) => {
    if (!photoDraft.files?.length || !currentPersonId) return;
    setPhotoDraft((prev) => ({ ...prev, uploading: true }));
    try {
      const uploaded = [];
      for (const file of photoDraft.files) {
        const formData = new FormData();
        formData.append('person', currentPersonId);
        formData.append('title', photoDraft.title?.trim() || '');
        formData.append('image', file);
        if (photos.length === 0 && uploaded.length === 0) {
          formData.append('order', '1');
        }
        const resp = await axios.post(`${API_ROOT}/api/v1/person-photos/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push(resp.data);
      }
      await loadPhotos(currentPersonId);
      onSaved?.();
      setPhotoDraft({ title: '', files: [], uploading: false });
      setPhotoFormOpen(false);
    } catch (err) {
      console.error(err);
      setPhotoDraft((prev) => ({ ...prev, uploading: false }));
      setError(err?.response?.data?.detail || 'Не удалось загрузить фото');
    }
  };

  const handlePhotoDelete = async (photoId, currentPersonId) => {
    await axios.delete(`${API_ROOT}/api/v1/person-photos/${photoId}/`);
    await loadPhotos(currentPersonId);
    onSaved?.();
  };

  const handleSetAvatar = async (photoId, currentPersonId) => {
    await axios.patch(`${API_ROOT}/api/v1/person-photos/${photoId}/`, { order: 1 });
    await loadPhotos(currentPersonId);
    onSaved?.();
  };

  const handleAddRelation = async (currentPersonId) => {
    if (!newRelationPersonId || !newRelationTypeId || !currentPersonId) return;
    try {
      const res = await axios.post(`${API_ROOT}/api/v1/person-relations/`, {
        person_from: currentPersonId,
        person_to: newRelationPersonId,
        relation_type: newRelationTypeId,
      });
      const detailRes = await axios.get(`${API_ROOT}/api/v1/person/${currentPersonId}/`);
      setRelations(detailRes.data.relations || []);
      setNewRelationPersonId('');
      setNewRelationTypeId('');
      relationPersonDropdown.setSearch('');
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Не удалось добавить связь');
    }
  };

  const handleDeleteRelation = async (relationId, currentPersonId) => {
    await axios.delete(`${API_ROOT}/api/v1/person-relations/${relationId}/`);
    const detailRes = await axios.get(`${API_ROOT}/api/v1/person/${currentPersonId}/`);
    setRelations(detailRes.data.relations || []);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Укажите ФИО');
      return;
    }
    setSaving(true);
    setError(null);
    const wasNew = !resolvedPersonId;
    try {
      let savedPersonId = resolvedPersonId;
      const body = {
        target: targetId,
        full_name: fullName.trim(),
        position: position.trim(),
      };
      if (resolvedPersonId) {
        await axios.patch(`${API_ROOT}/api/v1/persons/${resolvedPersonId}/`, body);
      } else {
        const res = await axios.post(`${API_ROOT}/api/v1/persons/`, body);
        savedPersonId = res.data.id;
        setResolvedPersonId(savedPersonId);
        await loadPhotos(savedPersonId);
      }

      const items = Object.entries(infoData).map(([sectionId, content]) => ({
        section_id: parseInt(sectionId, 10),
        content: content || '',
      }));
      if (items.length > 0) {
        await axios.post(`${API_ROOT}/api/v1/person/${savedPersonId}/bulk/`, { items });
      }

      onSaved?.();
      if (!wasNew) {
        onClose();
      } else {
        setError(null);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (section, level = 0) => {
    if (section.is_hidden) return null;
    const hasChildren = section.children?.length > 0;
    const attachments = attachmentsBySection[section.id] || [];
    const draft = attachmentDrafts[section.id] || { title: '', description: '', files: [], uploading: false };
    const isAttachmentFormOpen = !!attachmentFormsOpen[section.id];

    return (
      <div key={section.id} className={`formular-editor__section formular-editor__section--level-${level}`}>
        {hasChildren ? (
          <h3 className={`formular-editor__section-title formular-editor__section-title--level-${level}`}>
            {section.title}
          </h3>
        ) : (
          <div className={`formular-editor__field${level === 0 ? ' formular-editor__field--root' : ''}`}>
            <label className="formular-editor__label">{section.title}</label>
            <textarea
              className="formular-editor__textarea"
              value={infoData[section.id] || ''}
              onChange={(e) => handleContentChange(section.id, e.target.value)}
              placeholder="Введите информацию..."
              rows={3}
            />
            <div className="formular-editor__attachments">
              <div className="formular-editor__attachments-title">Изображения</div>
              {attachments.length > 0 && (
                <div className="formular-editor__attachments-list">
                  {attachments.map((item) => (
                    <div key={item.id} className="formular-editor__attachment-card">
                      <button type="button" className="formular-editor__attachment-thumb" onClick={() => setPreviewImage(item)}>
                        <img src={item.image} alt={item.title} />
                      </button>
                      <div className="formular-editor__attachment-info">
                        <strong>{item.title}</strong>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <button type="button" className="formular-editor__attachment-remove" onClick={() => handleAttachmentDelete(section.id, item.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {!resolvedPersonId ? (
                <p className="formular-editor__attachments-hint">
                  Сохраните лицо, чтобы добавить изображения
                </p>
              ) : !isAttachmentFormOpen ? (
                <button
                  type="button"
                  className="formular-editor__attachment-toggle"
                  onClick={() =>
                    setAttachmentFormsOpen((prev) => ({
                      ...prev,
                      [section.id]: true,
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
                    onChange={(e) => handleAttachmentDraftChange(section.id, 'title', e.target.value)}
                  />
                  <textarea
                    className="formular-editor__textarea"
                    placeholder="Описание (необязательно)"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => handleAttachmentDraftChange(section.id, 'description', e.target.value)}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleAttachmentDraftChange(section.id, 'files', Array.from(e.target.files || []))}
                  />
                  <div className="formular-editor__attachment-actions">
                    <button
                      type="button"
                      className="formular-editor__button formular-editor__button--save"
                      onClick={() => handleAttachmentUpload(section.id, resolvedPersonId)}
                      disabled={!draft.files.length || !draft.title?.trim() || draft.uploading}
                    >
                      {draft.uploading ? 'Загрузка...' : 'Добавить'}
                    </button>
                    <button
                      type="button"
                      className="formular-editor__button formular-editor__button--cancel"
                      onClick={() =>
                        setAttachmentFormsOpen((prev) => ({
                          ...prev,
                          [section.id]: false,
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
            {section.children.map((child) => renderSection(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="formular-editor__overlay person-editor__overlay" onClick={onClose}>
      <div className="formular-editor__content" onClick={(e) => e.stopPropagation()}>
        <div className="formular-editor__header">
          <h2>{personId ? 'Редактирование лица' : 'Новое лицо'}</h2>
          <button type="button" className="formular-editor__close" onClick={onClose}>×</button>
        </div>
        {error && <div className="formular-editor__error">{error}</div>}
        <div className="formular-editor__body">
          {loading ? (
            <div className="formular-editor__loading">Загрузка...</div>
          ) : (
            <>
              <div className="person-editor__identity">
                <div className="formular-editor__field">
                  <label className="formular-editor__label">ФИО *</label>
                  <input
                    className="formular-editor__input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Фамилия Имя Отчество"
                  />
                </div>
                <div className="formular-editor__field">
                  <label className="formular-editor__label">Должность</label>
                  <input
                    className="formular-editor__input"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Должность или звание"
                  />
                </div>
              </div>
              <div className="person-editor__photos">
                <h3 className="person-editor__photos-title">Фотографии лица</h3>
                <p className="person-editor__photos-hint">
                  Первое фото (order 1) используется как аватар в списках и карточках.
                </p>
                {!resolvedPersonId ? (
                  <p className="formular-editor__attachments-hint">
                    Сохраните лицо, чтобы добавить фотографии
                  </p>
                ) : (
                  <>
                    {photos.length > 0 && (
                      <div className="person-editor__photos-list">
                        {photos.map((photo) => (
                          <div
                            key={photo.id}
                            className={`person-editor__photo-card${
                              photo.order === 1 ? ' person-editor__photo-card--avatar' : ''
                            }`}
                          >
                            {photo.order === 1 && (
                              <span className="person-editor__photo-badge">Аватар</span>
                            )}
                            <button
                              type="button"
                              className="person-editor__photo-thumb"
                              onClick={() => setPreviewImage(photo)}
                            >
                              <img src={photo.image} alt={photo.title || 'Фото'} />
                            </button>
                            {photo.title && (
                              <div className="person-editor__photo-title">{photo.title}</div>
                            )}
                            <div className="person-editor__photo-actions">
                              {photo.order !== 1 && (
                                <button
                                  type="button"
                                  className="person-editor__photo-action"
                                  onClick={() => handleSetAvatar(photo.id, resolvedPersonId)}
                                >
                                  Сделать аватаром
                                </button>
                              )}
                              <button
                                type="button"
                                className="person-editor__photo-action person-editor__photo-action--delete"
                                onClick={() => handlePhotoDelete(photo.id, resolvedPersonId)}
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!photoFormOpen ? (
                      <button
                        type="button"
                        className="formular-editor__attachment-toggle"
                        onClick={() => setPhotoFormOpen(true)}
                      >
                        Добавить фото
                      </button>
                    ) : (
                      <div className="formular-editor__attachment-form person-editor__photo-form">
                        <input
                          type="text"
                          className="formular-editor__input"
                          placeholder="Название (необязательно)"
                          value={photoDraft.title}
                          onChange={(e) => setPhotoDraft((prev) => ({ ...prev, title: e.target.value }))}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) =>
                            setPhotoDraft((prev) => ({
                              ...prev,
                              files: Array.from(e.target.files || []),
                            }))
                          }
                        />
                        <div className="formular-editor__attachment-actions">
                          <button
                            type="button"
                            className="formular-editor__button formular-editor__button--save"
                            onClick={() => handlePhotoUpload(resolvedPersonId)}
                            disabled={!photoDraft.files.length || photoDraft.uploading}
                          >
                            {photoDraft.uploading ? 'Загрузка...' : 'Добавить'}
                          </button>
                          <button
                            type="button"
                            className="formular-editor__button formular-editor__button--cancel"
                            onClick={() => {
                              setPhotoFormOpen(false);
                              setPhotoDraft({ title: '', files: [], uploading: false });
                            }}
                            disabled={photoDraft.uploading}
                          >
                            Скрыть
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {sections.map((section) => renderSection(section, 0))}
              {resolvedPersonId && (
                <div className="person-editor__relations">
                  <h3 className="person-editor__relations-title">Связи</h3>
                  {relations.length === 0 ? (
                    <p className="person-editor__relations-empty">Связи не указаны</p>
                  ) : (
                    <div className="person-editor__relation-list">
                      {relations.map((rel) => {
                        const other = rel.direction === 'out' ? rel.person_to : rel.person_from;
                        return (
                          <div key={rel.id} className="person-editor__relation-row">
                            <span>
                              <strong className="person-editor__relation-label">{rel.label}</strong>
                              {': '}
                              {other?.full_name || '—'}
                            </span>
                            <button
                              type="button"
                              className="person-editor__relation-remove"
                              onClick={() => handleDeleteRelation(rel.id, resolvedPersonId)}
                              aria-label="Удалить связь"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="person-editor__relation-form">
                    <div className="person-editor__field">
                      <label className="person-editor__field-label" htmlFor="person-relation-type">
                        Характер связи
                      </label>
                      <select
                        id="person-relation-type"
                        className="person-editor__select"
                        value={newRelationTypeId}
                        onChange={(e) => setNewRelationTypeId(e.target.value)}
                      >
                        <option value="">Выберите...</option>
                        {relationTypes.map((rt) => (
                          <option key={rt.id} value={rt.id}>{rt.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="person-editor__field">
                      <label className="person-editor__field-label">Связанное лицо</label>
                      <div className="person-editor__dropdown" ref={relationPersonDropdown.dropdownRef}>
                        <button
                          type="button"
                          className={`person-editor__dropdown-trigger${
                            !newRelationPersonId ? ' person-editor__dropdown-trigger--placeholder' : ''
                          }`}
                          onClick={relationPersonDropdown.handleToggle}
                        >
                          <span>
                            {newRelationPersonId
                              ? allPersons.find((p) => p.id === newRelationPersonId)?.full_name
                              : 'Выберите лицо'}
                          </span>
                          <svg
                            className={`person-editor__dropdown-arrow${
                              relationPersonDropdown.isOpen ? ' person-editor__dropdown-arrow--open' : ''
                            }`}
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            aria-hidden
                          >
                            <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" />
                          </svg>
                        </button>
                        {relationPersonDropdown.isOpen && (
                          <div className="person-editor__dropdown-panel">
                            <div className="person-editor__search-wrapper">
                              <input
                                ref={relationPersonDropdown.searchInputRef}
                                className="person-editor__search-input"
                                value={relationPersonDropdown.search}
                                onChange={(e) => relationPersonDropdown.setSearch(e.target.value)}
                                placeholder="Поиск..."
                              />
                            </div>
                            <div className="person-editor__dropdown-list">
                              {relationPersonDropdown.filtered.length > 0 ? (
                                relationPersonDropdown.filtered.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className={`person-editor__dropdown-option${
                                      newRelationPersonId === p.id
                                        ? ' person-editor__dropdown-option--selected'
                                        : ''
                                    }`}
                                    onClick={() => relationPersonDropdown.handleSelect(p.id)}
                                  >
                                    {p.full_name}
                                  </button>
                                ))
                              ) : (
                                <div className="person-editor__dropdown-empty">Ничего не найдено</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="person-editor__add-relation"
                      onClick={() => handleAddRelation(resolvedPersonId)}
                      disabled={!newRelationPersonId || !newRelationTypeId}
                    >
                      Добавить связь
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="formular-editor__footer">
          <button type="button" className="formular-editor__button formular-editor__button--cancel" onClick={onClose} disabled={saving}>Отмена</button>
          <button type="button" className="formular-editor__button formular-editor__button--save" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Сохранение...' : resolvedPersonId && !personId ? 'Сохранить и продолжить' : 'Сохранить'}
          </button>
        </div>
      </div>
      {previewImage && (
        <div className="formular-editor__image-preview" onClick={() => setPreviewImage(null)}>
          <div className="formular-editor__image-preview-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage.image} alt={previewImage.title} />
          </div>
        </div>
      )}
    </div>
  );
}
