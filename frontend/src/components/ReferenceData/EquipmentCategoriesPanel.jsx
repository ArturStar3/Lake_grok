import { useMemo, useState } from 'react';
import {
  EMPTY_CATEGORY_FORM,
  categoryToForm,
  useEquipmentCategoriesAdmin,
} from '../../hooks/referenceData/useEquipmentCategoriesAdmin';
import { formatApiError } from '../../hooks/referenceData/formatApiError';
import './EquipmentCatalogPanel.css';

function filterCategories(search, items) {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => (item.title || '').toLowerCase().includes(q));
}

function buildCategoryDepthMap(categories) {
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
  const cache = {};
  const depth = (id) => {
    if (cache[id] !== undefined) return cache[id];
    const cat = byId[id];
    if (!cat || cat.parent == null) {
      cache[id] = 0;
      return 0;
    }
    cache[id] = depth(cat.parent) + 1;
    return cache[id];
  };
  return depth;
}

function sortCategories(items) {
  return [...items].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.title || '').localeCompare(b.title || '', 'ru');
  });
}

export default function EquipmentCategoriesPanel({ isActive, onSchemaChanged }) {
  const { items, loading, error, reload, saveItem, deleteItem } = useEquipmentCategoriesAdmin(isActive);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const depthOf = useMemo(() => buildCategoryDepthMap(items), [items]);

  const filteredItems = useMemo(() => {
    const filtered = filterCategories(search, items);
    return sortCategories(filtered);
  }, [items, search]);

  const parentOptions = useMemo(() => {
    if (!selectedId) return items;
    const exclude = new Set([selectedId]);
    const collectDescendants = (parentId) => {
      items.forEach((cat) => {
        if (cat.parent === parentId) {
          exclude.add(cat.id);
          collectDescendants(cat.id);
        }
      });
    };
    collectDescendants(selectedId);
    return items.filter((cat) => !exclude.has(cat.id));
  }, [items, selectedId]);

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const showForm = isCreating || selectedId != null;

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_CATEGORY_FORM });
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(categoryToForm(item));
    setFormError(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название категории');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const saved = await saveItem(isCreating ? null : selectedId, form);
      await reload();
      onSchemaChanged?.();
      setIsCreating(false);
      setSelectedId(saved.id);
      setForm(categoryToForm(saved));
    } catch (err) {
      console.error('Ошибка сохранения категории', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось сохранить категорию'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const label = selectedItem?.title || 'категорию';
    if (!window.confirm(`Удалить «${label}»?`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteItem(selectedId);
      setSelectedId(null);
      setIsCreating(false);
      setForm(EMPTY_CATEGORY_FORM);
      await reload();
      onSchemaChanged?.();
    } catch (err) {
      console.error('Ошибка удаления категории', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось удалить категорию'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="equipment-catalog-panel">
      <div className="equipment-catalog-panel__toolbar">
        <input
          type="search"
          className="equipment-catalog-panel__search"
          placeholder="Поиск по названию…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="equipment-catalog-panel__create" onClick={startCreate}>
          + Новая категория
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
                    style={{ paddingLeft: `${12 + depthOf(item.id) * 16}px` }}
                    onClick={() => startEdit(item)}
                  >
                    <span className="equipment-catalog-panel__list-title">{item.title}</span>
                    <span className="equipment-catalog-panel__list-meta">порядок: {item.order}</span>
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
              <p>Выберите категорию из списка или создайте новую.</p>
              <p className="equipment-catalog-panel__hint">
                Сначала создайте корневые категории (ВВС, СВ, ПВО), затем подкатегории.
              </p>
            </div>
          ) : (
            <>
              <h3 className="equipment-catalog-panel__editor-title">
                {isCreating ? 'Новая категория техники' : 'Редактирование категории'}
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
                  <span>Родительская категория</span>
                  <select
                    value={form.parent_id}
                    onChange={(e) => handleFormChange('parent_id', e.target.value)}
                  >
                    <option value="">— корневая —</option>
                    {sortCategories(parentOptions).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {'—'.repeat(depthOf(cat.id))}
                        {depthOf(cat.id) > 0 ? ' ' : ''}
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Порядок</span>
                  <input
                    type="number"
                    min="1"
                    value={form.order}
                    onChange={(e) => handleFormChange('order', e.target.value)}
                  />
                </label>
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
