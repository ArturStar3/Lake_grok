import { useMemo, useState, useEffect, useRef } from 'react';
import MarkdownEditor from '../common/MarkdownEditor/MarkdownEditor';
import {
  EMPTY_EQUIPMENT_FORM,
  equipmentToForm,
  useEquipmentCatalogAdmin,
} from '../../hooks/referenceData/useEquipmentCatalogAdmin';
import { filterEquipmentCatalog, formatEquipmentLabel } from '../../utils/equipmentCatalogUtils';
import './EquipmentCatalogPanel.css';

export default function EquipmentCatalogPanel({ isActive, initialEquipmentId = null, schemaVersion = 0 }) {
  const {
    items,
    categories,
    parameters,
    countries,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
    uploadImages,
    deleteImage,
  } = useEquipmentCatalogAdmin(isActive, schemaVersion);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_EQUIPMENT_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState([]);
  const appliedInitialIdRef = useRef(null);

  const resetImages = (itemImages = []) => {
    setImages(Array.isArray(itemImages) ? itemImages : []);
    setPendingFiles([]);
  };

  useEffect(() => {
    const urls = pendingFiles.map((file) => URL.createObjectURL(file));
    setPendingPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [pendingFiles]);

  useEffect(() => {
    if (!initialEquipmentId) {
      appliedInitialIdRef.current = null;
    }
  }, [initialEquipmentId]);

  useEffect(() => {
    if (!isActive || !initialEquipmentId || loading) return;
    if (appliedInitialIdRef.current === initialEquipmentId) return;
    const item = items.find((entry) => entry.id === initialEquipmentId);
    if (!item) return;
    appliedInitialIdRef.current = initialEquipmentId;
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(equipmentToForm(item));
    resetImages(item.images);
    setFormError(null);
  }, [isActive, initialEquipmentId, loading, items]);

  const filteredItems = useMemo(() => {
    const { items: list } = filterEquipmentCatalog(search, items, 500);
    return list;
  }, [items, search]);

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const showForm = isCreating || selectedId != null;

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_EQUIPMENT_FORM, parameter_values: [] });
    resetImages();
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(equipmentToForm(item));
    resetImages(item.images);
    setFormError(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddParameter = () => {
    setForm((prev) => ({
      ...prev,
      parameter_values: [...prev.parameter_values, { parameter_id: '', value: '' }],
    }));
  };

  const handleParameterChange = (index, field, value) => {
    setForm((prev) => {
      const next = [...prev.parameter_values];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, parameter_values: next };
    });
  };

  const handleRemoveParameter = (index) => {
    setForm((prev) => ({
      ...prev,
      parameter_values: prev.parameter_values.filter((_, i) => i !== index),
    }));
  };

  const handleImagesSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    event.target.value = '';

    if (selectedId && !isCreating) {
      setIsSaving(true);
      setFormError(null);
      try {
        const uploaded = await uploadImages(selectedId, files);
        setImages((prev) => [...prev, ...uploaded]);
        await reload();
      } catch (err) {
        console.error('Ошибка загрузки изображений', err);
        setFormError('Не удалось загрузить изображения');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setPendingFiles((prev) => [...prev, ...files]);
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Удалить изображение?')) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      await reload();
    } catch (err) {
      console.error('Ошибка удаления изображения', err);
      setFormError('Не удалось удалить изображение');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите наименование образца');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const saved = await saveItem(isCreating ? null : selectedId, form);
      if (pendingFiles.length) {
        await uploadImages(saved.id, pendingFiles);
        setPendingFiles([]);
      }
      const list = await reload();
      const refreshed = list.find((item) => item.id === saved.id) || saved;
      setIsCreating(false);
      setSelectedId(refreshed.id);
      setForm(equipmentToForm(refreshed));
      setImages(refreshed.images || []);
    } catch (err) {
      console.error('Ошибка сохранения техники', err);
      setFormError(err.response?.data?.detail || 'Не удалось сохранить образец');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const label = formatEquipmentLabel(selectedItem) || 'образец';
    if (!window.confirm(`Удалить «${label}» из каталога?`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteItem(selectedId);
      setSelectedId(null);
      setIsCreating(false);
      setForm(EMPTY_EQUIPMENT_FORM);
      resetImages();
      await reload();
    } catch (err) {
      console.error('Ошибка удаления техники', err);
      setFormError('Не удалось удалить образец. Возможно, он привязан к объектам.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasImages = images.length > 0 || pendingFiles.length > 0;

  return (
    <div className="equipment-catalog-panel">
      <div className="equipment-catalog-panel__toolbar">
        <input
          type="search"
          className="equipment-catalog-panel__search"
          placeholder="Поиск в каталоге…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="equipment-catalog-panel__create" onClick={startCreate}>
          + Новый образец
        </button>
      </div>

      {error && <p className="equipment-catalog-panel__error">{error}</p>}

      <div className="equipment-catalog-panel__body">
        <aside className="equipment-catalog-panel__list-wrap">
          {loading ? (
            <p className="equipment-catalog-panel__hint">Загрузка каталога…</p>
          ) : (
            <ul className="equipment-catalog-panel__list">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`equipment-catalog-panel__list-item${
                      selectedId === item.id ? ' equipment-catalog-panel__list-item--active' : ''
                    }`}
                    onClick={() => startEdit(item)}
                  >
                    <span className="equipment-catalog-panel__list-title">
                      {formatEquipmentLabel(item)}
                    </span>
                    {item.category?.title && (
                      <span className="equipment-catalog-panel__list-meta">{item.category.title}</span>
                    )}
                  </button>
                </li>
              ))}
              {!loading && filteredItems.length === 0 && (
                <li className="equipment-catalog-panel__hint">Ничего не найдено</li>
              )}
            </ul>
          )}
        </aside>

        <section className="equipment-catalog-panel__editor">
          {!showForm ? (
            <div className="equipment-catalog-panel__placeholder">
              <p>Выберите образец из списка или создайте новый.</p>
            </div>
          ) : (
            <>
              <h3 className="equipment-catalog-panel__editor-title">
                {isCreating ? 'Новый образец' : 'Редактирование образца'}
              </h3>
              {formError && <p className="equipment-catalog-panel__error">{formError}</p>}

              <div className="equipment-catalog-panel__form-grid">
                <label className="equipment-catalog-panel__field">
                  <span>Наименование *</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                  />
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Обозначение</span>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={(e) => handleFormChange('designation', e.target.value)}
                  />
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Категория</span>
                  <select
                    value={form.category_id}
                    onChange={(e) => handleFormChange('category_id', e.target.value)}
                  >
                    <option value="">—</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.title}</option>
                    ))}
                  </select>
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Страна происхождения</span>
                  <select
                    value={form.origin_country_id}
                    onChange={(e) => handleFormChange('origin_country_id', e.target.value)}
                  >
                    <option value="">—</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>{country.title}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="equipment-catalog-panel__field equipment-catalog-panel__field--full">
                <span>Описание</span>
                <MarkdownEditor
                  value={form.description}
                  onChange={(val) => handleFormChange('description', val)}
                  placeholder="Описание образца техники"
                  rows={3}
                />
              </label>

              <div className="equipment-catalog-panel__image">
                <div className="equipment-catalog-panel__image-header">
                  <span className="equipment-catalog-panel__image-label">Изображения</span>
                  <label className="equipment-catalog-panel__image-upload">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImagesSelect}
                    />
                    + Добавить
                  </label>
                </div>
                {!hasImages && (
                  <p className="equipment-catalog-panel__hint">Изображения не загружены</p>
                )}
                {hasImages && (
                  <ul className="equipment-catalog-panel__gallery">
                    {images.map((img) => (
                      <li key={img.id} className="equipment-catalog-panel__gallery-item">
                        <img
                          src={img.image}
                          alt={img.title || form.title || 'Изображение техники'}
                          className="equipment-catalog-panel__gallery-thumb"
                        />
                        <button
                          type="button"
                          className="equipment-catalog-panel__gallery-remove"
                          onClick={() => handleDeleteImage(img.id)}
                          disabled={isSaving}
                          aria-label="Удалить изображение"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                    {pendingPreviewUrls.map((url, index) => (
                      <li key={`pending-${url}`} className="equipment-catalog-panel__gallery-item">
                        <img
                          src={url}
                          alt="Новое изображение"
                          className="equipment-catalog-panel__gallery-thumb equipment-catalog-panel__gallery-thumb--pending"
                        />
                        <button
                          type="button"
                          className="equipment-catalog-panel__gallery-remove"
                          onClick={() => handleRemovePendingFile(index)}
                          disabled={isSaving}
                          aria-label="Убрать из очереди"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {isCreating && pendingFiles.length > 0 && (
                  <p className="equipment-catalog-panel__hint">
                    Новые изображения будут загружены после сохранения образца.
                  </p>
                )}
              </div>

              <div className="equipment-catalog-panel__params">
                <div className="equipment-catalog-panel__params-header">
                  <span>Тактико-технические характеристики</span>
                  <button type="button" onClick={handleAddParameter}>+ Параметр</button>
                </div>
                {form.parameter_values.length === 0 && (
                  <p className="equipment-catalog-panel__hint">Параметры не заданы</p>
                )}
                {form.parameter_values.map((row, index) => (
                  <div key={index} className="equipment-catalog-panel__param-row">
                    <select
                      value={row.parameter_id}
                      onChange={(e) => handleParameterChange(index, 'parameter_id', e.target.value)}
                    >
                      <option value="">Параметр</option>
                      {parameters.map((param) => (
                        <option key={param.id} value={param.id}>
                          {param.title}
                          {param.unit?.symbol ? ` (${param.unit.symbol})` : ''}
                          {param.action_type ? ' — зона' : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="any"
                      placeholder="Значение"
                      value={row.value}
                      onChange={(e) => handleParameterChange(index, 'value', e.target.value)}
                    />
                    <button
                      type="button"
                      className="equipment-catalog-panel__param-remove"
                      onClick={() => handleRemoveParameter(index)}
                      aria-label="Удалить параметр"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="equipment-catalog-panel__actions">
                <button
                  type="button"
                  className="equipment-catalog-panel__save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Сохранение…' : 'Сохранить'}
                </button>
                {!isCreating && selectedId && (
                  <button
                    type="button"
                    className="equipment-catalog-panel__delete"
                    onClick={handleDelete}
                    disabled={isSaving}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
