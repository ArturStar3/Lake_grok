import { useMemo, useState } from 'react';
import {
  EMPTY_TARGET_TYPE_FORM,
  targetTypeToForm,
  useTargetTypesAdmin,
} from '../../hooks/referenceData/useTargetTypesAdmin';
import { formatApiError } from '../../hooks/referenceData/formatApiError';
import { filterTypesForTreeList } from '../../utils/targetTypeTree';
import ReferenceTreeAutocomplete from './ReferenceTreeAutocomplete';
import './EquipmentCatalogPanel.css';

function buildDepthMap(types) {
  const byId = Object.fromEntries(types.map((t) => [t.id, t]));
  const cache = {};
  const depth = (id) => {
    if (cache[id] !== undefined) return cache[id];
    const node = byId[id];
    if (!node || node.parent == null) {
      cache[id] = 0;
      return 0;
    }
    cache[id] = depth(node.parent) + 1;
    return cache[id];
  };
  return depth;
}

function sortTypes(items) {
  return [...items].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.title || '').localeCompare(b.title || '', 'ru');
  });
}

export default function TargetTypesPanel({ isActive, onChanged }) {
  const {
    items,
    countries,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
    notifyChanged,
  } = useTargetTypesAdmin(isActive);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_TARGET_TYPE_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const depthOf = useMemo(() => buildDepthMap(items), [items]);

  const listEntries = useMemo(
    () => filterTypesForTreeList(search, items),
    [items, search],
  );

  const parentOptions = useMemo(() => {
    if (!selectedId) return items;
    const exclude = new Set([selectedId]);
    const collectDescendants = (parentId) => {
      items.forEach((t) => {
        if (t.parent === parentId) {
          exclude.add(t.id);
          collectDescendants(t.id);
        }
      });
    };
    collectDescendants(selectedId);
    return items.filter((t) => !exclude.has(t.id));
  }, [items, selectedId]);

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const showForm = isCreating || selectedId != null;

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_TARGET_TYPE_FORM, country_ids: [] });
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(targetTypeToForm(item));
    setFormError(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCountry = (countryId) => {
    const idStr = String(countryId);
    setForm((prev) => {
      const set = new Set(prev.country_ids || []);
      if (set.has(idStr)) set.delete(idStr);
      else set.add(idStr);
      return { ...prev, country_ids: [...set] };
    });
  };

  const clearCountrySelection = () => {
    handleFormChange('country_ids', []);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название типа');
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
      setForm(targetTypeToForm(saved));
    } catch (err) {
      console.error('Ошибка сохранения типа объекта', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось сохранить тип'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const label = selectedItem?.title || 'тип';
    if (!window.confirm(`Удалить «${label}»?`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteItem(selectedId);
      setSelectedId(null);
      setIsCreating(false);
      setForm(EMPTY_TARGET_TYPE_FORM);
      await reload();
      notifyChanged();
      onChanged?.();
    } catch (err) {
      console.error('Ошибка удаления типа', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось удалить тип'));
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
              {listEntries.map(({ node, depth }) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={`equipment-catalog-panel__list-item${
                      selectedId === node.id ? ' equipment-catalog-panel__list-item--active' : ''
                    }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => startEdit(node)}
                  >
                    <span className="equipment-catalog-panel__list-title">{node.title}</span>
                    <span className="equipment-catalog-panel__list-meta">порядок: {node.order}</span>
                  </button>
                </li>
              ))}
              {!loading && listEntries.length === 0 && (
                <li className="equipment-catalog-panel__hint">Ничего не найдено</li>
              )}
            </ul>
          )}
        </aside>

        <section className="equipment-catalog-panel__editor">
          {!showForm ? (
            <div className="equipment-catalog-panel__placeholder">
              <p>Выберите тип из списка или создайте новый.</p>
              <p className="equipment-catalog-panel__hint">
                Создайте корневые типы (ВВС, СВ, ПВО), затем подтипы.
              </p>
            </div>
          ) : (
            <>
              <h3 className="equipment-catalog-panel__editor-title">
                {isCreating ? 'Новый тип объекта' : 'Редактирование типа'}
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
                  <span>Родительский тип</span>
                  <ReferenceTreeAutocomplete
                    items={sortTypes(parentOptions)}
                    value={form.parent_id}
                    onChange={(parentId) => handleFormChange('parent_id', parentId)}
                    depthOf={depthOf}
                    rootLabel="— корневой —"
                    placeholder="Поиск родительского типа…"
                    disabled={isSaving}
                  />
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

              <fieldset className="equipment-catalog-panel__checkbox-group">
                <legend className="equipment-catalog-panel__checkbox-legend-row">
                  <span>Страны (пусто = все страны)</span>
                  <button
                    type="button"
                    className="equipment-catalog-panel__checkbox-clear"
                    onClick={clearCountrySelection}
                    disabled={!(form.country_ids || []).length}
                  >
                    Снять выделение
                  </button>
                </legend>
                <div className="equipment-catalog-panel__checkbox-list">
                  {countries.map((country) => (
                    <label key={country.id} className="equipment-catalog-panel__checkbox-label">
                      <input
                        type="checkbox"
                        checked={(form.country_ids || []).includes(String(country.id))}
                        onChange={() => toggleCountry(country.id)}
                      />
                      {country.title}
                    </label>
                  ))}
                </div>
              </fieldset>

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
