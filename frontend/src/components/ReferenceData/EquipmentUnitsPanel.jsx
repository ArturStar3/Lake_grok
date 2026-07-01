import { useMemo, useState } from 'react';
import {
  EMPTY_UNIT_FORM,
  unitToForm,
  useEquipmentUnitsAdmin,
} from '../../hooks/referenceData/useEquipmentUnitsAdmin';
import { formatApiError } from '../../hooks/referenceData/formatApiError';
import './EquipmentCatalogPanel.css';

function filterUnits(search, items) {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      (item.title || '').toLowerCase().includes(q)
      || (item.symbol || '').toLowerCase().includes(q),
  );
}

export default function EquipmentUnitsPanel({ isActive, onSchemaChanged }) {
  const { items, loading, error, reload, saveItem, deleteItem } = useEquipmentUnitsAdmin(isActive);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_UNIT_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredItems = useMemo(() => filterUnits(search, items), [items, search]);
  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const showForm = isCreating || selectedId != null;

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_UNIT_FORM });
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(unitToForm(item));
    setFormError(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название единицы');
      return;
    }
    if (!form.symbol.trim()) {
      setFormError('Укажите обозначение');
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
      setForm(unitToForm(saved));
    } catch (err) {
      console.error('Ошибка сохранения единицы измерения', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось сохранить единицу'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const label = selectedItem?.symbol || selectedItem?.title || 'единицу';
    if (!window.confirm(`Удалить «${label}»?`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteItem(selectedId);
      setSelectedId(null);
      setIsCreating(false);
      setForm(EMPTY_UNIT_FORM);
      await reload();
      onSchemaChanged?.();
    } catch (err) {
      console.error('Ошибка удаления единицы', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось удалить единицу'));
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
          placeholder="Поиск по названию или обозначению…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="equipment-catalog-panel__create" onClick={startCreate}>
          + Новая единица
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
                    <span className="equipment-catalog-panel__list-title">{item.title}</span>
                    <span className="equipment-catalog-panel__list-meta">{item.symbol}</span>
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
              <p>Выберите единицу из списка или создайте новую.</p>
              <p className="equipment-catalog-panel__hint">
                Для параметров зон на карте нужна единица «км».
              </p>
            </div>
          ) : (
            <>
              <h3 className="equipment-catalog-panel__editor-title">
                {isCreating ? 'Новая единица измерения' : 'Редактирование единицы'}
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
                <label className="equipment-catalog-panel__field equipment-catalog-panel__field--full">
                  <span>Обозначение *</span>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(e) => handleFormChange('symbol', e.target.value)}
                    placeholder="км, мм, т"
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
