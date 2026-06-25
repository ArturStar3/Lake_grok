import { useMemo, useState } from 'react';
import {
  EMPTY_ACTION_TYPE_FORM,
  actionTypeToForm,
  useActionTypesAdmin,
} from '../../hooks/referenceData/useActionTypesAdmin';
import { LINE_TYPE_LABELS, getZoneDashArray, normalizeHexColor } from '../../utils/actionZoneStyle';
import './EquipmentCatalogPanel.css';

const LINE_TYPE_OPTIONS = Object.entries(LINE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function formatApiError(detail, fallback) {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object') {
    return Object.entries(detail)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('; ');
  }
  return fallback;
}

function filterActionTypes(search, items) {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => (item.title || '').toLowerCase().includes(q));
}

function LineTypePreview({ color, lineType }) {
  const dashArray = getZoneDashArray(lineType);
  const style = {
    stroke: color || '#3388ff',
    strokeWidth: 3,
    fill: 'none',
    strokeDasharray: dashArray || undefined,
  };
  return (
    <svg width="48" height="16" aria-hidden="true" className="action-types-panel__line-preview">
      <line x1="2" y1="8" x2="46" y2="8" style={style} />
    </svg>
  );
}

export default function ActionTypesPanel({ isActive, onChanged }) {
  const {
    items,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
    notifyChanged,
  } = useActionTypesAdmin(isActive);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_ACTION_TYPE_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredItems = useMemo(
    () => filterActionTypes(search, items),
    [items, search],
  );

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const showForm = isCreating || selectedId != null;

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_ACTION_TYPE_FORM });
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(actionTypeToForm(item));
    setFormError(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const colorInputValue = normalizeHexColor(form.color);

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название типа зоны');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const saved = await saveItem(isCreating ? null : selectedId, form);
      await reload();
      notifyChanged();
      onChanged?.();
      setIsCreating(false);
      setSelectedId(saved.id);
      setForm(actionTypeToForm(saved));
    } catch (err) {
      console.error('Ошибка сохранения типа зоны', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось сохранить тип зоны'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const label = selectedItem?.title || 'тип зоны';
    if (!window.confirm(`Удалить «${label}»?`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteItem(selectedId);
      setSelectedId(null);
      setIsCreating(false);
      setForm(EMPTY_ACTION_TYPE_FORM);
      await reload();
      notifyChanged();
      onChanged?.();
    } catch (err) {
      console.error('Ошибка удаления типа зоны', err);
      setFormError('Не удалось удалить тип. Возможно, он используется в зонах или ТТХ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="equipment-catalog-panel action-types-panel">
      <div className="equipment-catalog-panel__toolbar">
        <input
          type="search"
          className="equipment-catalog-panel__search"
          placeholder="Поиск по названию…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="equipment-catalog-panel__create" onClick={startCreate}>
          + Новый тип
        </button>
      </div>

      {error && <p className="equipment-catalog-panel__error">{error}</p>}

      <div className="equipment-catalog-panel__body">
        <aside className="equipment-catalog-panel__list-wrap">
          {loading ? (
            <p className="equipment-catalog-panel__hint">Загрузка…</p>
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
                    <span className="action-types-panel__list-head">
                      <span
                        className="action-types-panel__swatch"
                        style={{ backgroundColor: item.color || '#3388ff' }}
                        aria-hidden="true"
                      />
                      <span className="equipment-catalog-panel__list-title">{item.title}</span>
                    </span>
                    <span className="equipment-catalog-panel__list-meta">
                      {LINE_TYPE_LABELS[item.line_type] || item.line_type}
                    </span>
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
              <p>Выберите тип из списка или создайте новый.</p>
            </div>
          ) : (
            <>
              <h3 className="equipment-catalog-panel__editor-title">
                {isCreating ? 'Новый тип зоны действия' : 'Редактирование типа зоны'}
              </h3>
              {formError && <p className="equipment-catalog-panel__error">{formError}</p>}

              <div className="equipment-catalog-panel__form-grid">
                <label className="equipment-catalog-panel__field equipment-catalog-panel__field--full">
                  <span>Название *</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                  />
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Цвет контура и заливки</span>
                  <div className="action-types-panel__color-row">
                    <input
                      type="color"
                      value={colorInputValue}
                      onChange={(e) => handleFormChange('color', e.target.value)}
                      aria-label="Выбор цвета"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) => handleFormChange('color', e.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      placeholder="#3388ff"
                    />
                  </div>
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Тип линии</span>
                  <select
                    value={form.line_type}
                    onChange={(e) => handleFormChange('line_type', e.target.value)}
                  >
                    {LINE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="action-types-panel__preview">
                <span>Предпросмотр:</span>
                <LineTypePreview color={colorInputValue} lineType={form.line_type} />
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
