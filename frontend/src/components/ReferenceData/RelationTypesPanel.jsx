import { useMemo, useState } from 'react';
import {
  EMPTY_RELATION_TYPE_FORM,
  relationTypeToForm,
  useRelationTypesAdmin,
} from '../../hooks/referenceData/useRelationTypesAdmin';
import './EquipmentCatalogPanel.css';

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

function filterItems(search, items) {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    (item.title || '').toLowerCase().includes(q)
    || (item.reverse_title || '').toLowerCase().includes(q),
  );
}

export default function RelationTypesPanel({ isActive }) {
  const { items, loading, error, reload, saveItem, deleteItem } = useRelationTypesAdmin(isActive);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_RELATION_TYPE_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredItems = useMemo(() => filterItems(search, items), [items, search]);
  const showForm = isCreating || selectedId != null;

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_RELATION_TYPE_FORM });
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(relationTypeToForm(item));
    setFormError(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название связи');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await saveItem(isCreating ? null : selectedId, form);
      await reload();
      setIsCreating(false);
      setSelectedId(null);
      setForm({ ...EMPTY_RELATION_TYPE_FORM });
    } catch (err) {
      setFormError(formatApiError(err?.response?.data?.detail, 'Не удалось сохранить'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить характер связи?')) return;
    try {
      await deleteItem(id);
      if (selectedId === id) {
        setSelectedId(null);
        setForm({ ...EMPTY_RELATION_TYPE_FORM });
      }
      await reload();
    } catch (err) {
      setFormError(formatApiError(err?.response?.data?.detail, 'Не удалось удалить'));
    }
  };

  return (
    <div className="equipment-catalog-panel">
      <div className="equipment-catalog-panel__toolbar">
        <input
          type="search"
          className="equipment-catalog-panel__search"
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="equipment-catalog-panel__add-btn" onClick={startCreate}>
          Добавить
        </button>
      </div>

      {loading && <p>Загрузка...</p>}
      {error && <p className="equipment-catalog-panel__error">{error}</p>}

      <div className="equipment-catalog-panel__layout">
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
                <strong>{item.title}</strong>
                {item.reverse_title && item.reverse_title !== item.title && (
                  <span> / {item.reverse_title}</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {showForm && (
          <div className="equipment-catalog-panel__form">
            <h3>{isCreating ? 'Новый характер связи' : 'Редактирование'}</h3>
            {formError && <p className="equipment-catalog-panel__error">{formError}</p>}
            <label>
              Название (прямое)
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label>
              Название (обратное)
              <input
                type="text"
                value={form.reverse_title}
                onChange={(e) => setForm((prev) => ({ ...prev, reverse_title: e.target.value }))}
                placeholder="Для симметричных связей можно оставить пустым"
              />
            </label>
            <div className="equipment-catalog-panel__form-actions">
              <button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              {!isCreating && selectedId && (
                <button type="button" onClick={() => handleDelete(selectedId)}>
                  Удалить
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
