import { useMemo, useState } from 'react';
import {
  EMPTY_PARAMETER_FORM,
  parameterToForm,
  useEquipmentParametersAdmin,
} from '../../hooks/referenceData/useEquipmentParametersAdmin';
import { formatApiError } from '../../hooks/referenceData/formatApiError';
import {
  LINE_TYPE_LABELS,
  getZoneDashArray,
  normalizeHexColor,
} from '../../utils/actionZoneStyle';
import ZoneColorPicker from './ZoneColorPicker';
import './EquipmentCatalogPanel.css';

const LINE_TYPE_OPTIONS = Object.entries(LINE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

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

function filterParameters(search, items) {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      (item.title || '').toLowerCase().includes(q)
      || (item.code || '').toLowerCase().includes(q),
  );
}

function sortCategories(items) {
  return [...items].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
}

export default function EquipmentParametersPanel({ isActive, onSchemaChanged, schemaVersion = 0 }) {
  const {
    items,
    units,
    categories,
    actionTypes,
    loading,
    error,
    reload,
    saveItem,
    deleteItem,
  } = useEquipmentParametersAdmin(isActive, schemaVersion);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_PARAMETER_FORM);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredItems = useMemo(() => filterParameters(search, items), [items, search]);
  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : null;
  const showForm = isCreating || selectedId != null;
  const isZoneParameter = Boolean(form.action_type_id);
  const linkedActionType = actionTypes.find(
    (at) => String(at.id) === String(form.action_type_id),
  );
  const previewColor = form.use_custom_zone_style
    ? normalizeHexColor(form.zone_color, linkedActionType?.color || '#3388ff')
    : (linkedActionType?.color || '#3388ff');
  const previewLineType = form.use_custom_zone_style
    ? (form.zone_line_type || 'solid')
    : (linkedActionType?.line_type || 'solid');

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    setForm({ ...EMPTY_PARAMETER_FORM, category_ids: [] });
    setFormError(null);
  };

  const startEdit = (item) => {
    setIsCreating(false);
    setSelectedId(item.id);
    setForm(parameterToForm(item));
    setFormError(null);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'action_type_id' && !value) {
        next.use_custom_zone_style = false;
        next.zone_color = '';
        next.zone_line_type = 'solid';
      }
      if (field === 'use_custom_zone_style' && value && !prev.zone_color && prev.action_type_id) {
        const at = actionTypes.find((item) => String(item.id) === String(prev.action_type_id));
        next.zone_color = at?.color || '#3388ff';
      }
      return next;
    });
  };

  const toggleCategory = (categoryId) => {
    const idStr = String(categoryId);
    setForm((prev) => {
      const set = new Set(prev.category_ids || []);
      if (set.has(idStr)) set.delete(idStr);
      else set.add(idStr);
      return { ...prev, category_ids: [...set] };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('Укажите название параметра');
      return;
    }
    if (!form.code.trim()) {
      setFormError('Укажите код параметра (snake_case)');
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
      setForm(parameterToForm(saved));
    } catch (err) {
      console.error('Ошибка сохранения параметра ТТХ', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось сохранить параметр'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const label = selectedItem?.title || 'параметр';
    if (!window.confirm(`Удалить «${label}»?`)) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await deleteItem(selectedId);
      setSelectedId(null);
      setIsCreating(false);
      setForm(EMPTY_PARAMETER_FORM);
      await reload();
      onSchemaChanged?.();
    } catch (err) {
      console.error('Ошибка удаления параметра', err);
      setFormError(formatApiError(err.response?.data, 'Не удалось удалить параметр'));
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
          placeholder="Поиск по названию или коду…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="equipment-catalog-panel__create" onClick={startCreate}>
          + Новый параметр
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
                    <span className="equipment-catalog-panel__list-meta">
                      {item.code}
                      {item.action_type ? ' · зона на карте' : ''}
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
              <p>Выберите параметр из списка или создайте новый шаблон ТТХ.</p>
              <p className="equipment-catalog-panel__hint">
                Для зоны на карте укажите тип зоны и единицу «км».
              </p>
            </div>
          ) : (
            <>
              <h3 className="equipment-catalog-panel__editor-title">
                {isCreating ? 'Новый параметр ТТХ' : 'Редактирование параметра'}
              </h3>
              {isZoneParameter && (
                <p className="equipment-catalog-panel__zone-badge">Параметр задаёт зону на карте</p>
              )}
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
                  <span>Код *</span>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => handleFormChange('code', e.target.value)}
                    placeholder="range_km"
                    disabled={!isCreating}
                  />
                </label>
                <label className="equipment-catalog-panel__field">
                  <span>Единица измерения</span>
                  <select
                    value={form.unit_id}
                    onChange={(e) => handleFormChange('unit_id', e.target.value)}
                  >
                    <option value="">— не задана —</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.title} ({unit.symbol})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="equipment-catalog-panel__field equipment-catalog-panel__field--full">
                  <span>Тип зоны действия</span>
                  <select
                    value={form.action_type_id}
                    onChange={(e) => handleFormChange('action_type_id', e.target.value)}
                  >
                    <option value="">— не зона на карте —</option>
                    {actionTypes.map((at) => (
                      <option key={at.id} value={at.id}>
                        {at.title}
                        {LINE_TYPE_LABELS[at.line_type] ? ` (${LINE_TYPE_LABELS[at.line_type]})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {isZoneParameter && (
                  <fieldset className="equipment-catalog-panel__checkbox-group equipment-catalog-panel__field--full">
                    <legend>Оформление зоны</legend>
                    <label className="equipment-catalog-panel__checkbox-label equipment-catalog-panel__field--full">
                      <input
                        type="checkbox"
                        checked={Boolean(form.use_custom_zone_style)}
                        onChange={(e) => handleFormChange('use_custom_zone_style', e.target.checked)}
                      />
                      Свой стиль (иначе — из типа действия)
                    </label>
                    {form.use_custom_zone_style ? (
                      <div className="equipment-catalog-panel__form-grid">
                        <label className="equipment-catalog-panel__field equipment-catalog-panel__field--full">
                          <span>Цвет контура и заливки</span>
                          <ZoneColorPicker
                            value={form.zone_color}
                            fallback={linkedActionType?.color || '#3388ff'}
                            onChange={(color) => handleFormChange('zone_color', color)}
                          />
                        </label>
                        <label className="equipment-catalog-panel__field">
                          <span>Тип линии</span>
                          <select
                            value={form.zone_line_type}
                            onChange={(e) => handleFormChange('zone_line_type', e.target.value)}
                          >
                            {LINE_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <p className="equipment-catalog-panel__hint">
                        Используется стиль типа действия
                        {linkedActionType ? `: ${linkedActionType.title}` : ''}.
                      </p>
                    )}
                    <div className="action-types-panel__preview">
                      <span>Предпросмотр:</span>
                      <LineTypePreview color={previewColor} lineType={previewLineType} />
                    </div>
                  </fieldset>
                )}

                <label className="equipment-catalog-panel__field equipment-catalog-panel__field--full">
                  <span>Подсказка</span>
                  <input
                    type="text"
                    value={form.help_text}
                    onChange={(e) => handleFormChange('help_text', e.target.value)}
                  />
                </label>
              </div>

              <fieldset className="equipment-catalog-panel__checkbox-group">
                <legend>Категории техники</legend>
                {sortCategories(categories).length === 0 ? (
                  <p className="equipment-catalog-panel__hint">Сначала создайте категории.</p>
                ) : (
                  <div className="equipment-catalog-panel__checkbox-list">
                    {sortCategories(categories).map((cat) => (
                      <label key={cat.id} className="equipment-catalog-panel__checkbox-label">
                        <input
                          type="checkbox"
                          checked={(form.category_ids || []).includes(String(cat.id))}
                          onChange={() => toggleCategory(cat.id)}
                        />
                        {cat.title}
                      </label>
                    ))}
                  </div>
                )}
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
