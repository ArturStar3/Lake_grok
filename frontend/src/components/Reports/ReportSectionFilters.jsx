import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DROPDOWN_Z_INDEX = 12000;

function computeDropdownPosition(triggerEl) {
  if (!triggerEl) return null;
  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const maxHeight = Math.min(280, Math.max(spaceBelow, spaceAbove, 120));
  const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

  return {
    position: 'fixed',
    left: rect.left,
    width: rect.width,
    zIndex: DROPDOWN_Z_INDEX,
    maxHeight,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };
}

function MultiSelect({ label, options, values, onChange, getOptionLabel, getOptionValue }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const fieldRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const valueOf = (item) => (getOptionValue ? getOptionValue(item) : item.id);
  const labelOf = (item) => (getOptionLabel ? getOptionLabel(item) : item.title);

  const selectedSet = useMemo(() => new Set(values || []), [values]);

  const filtered = useMemo(() => {
    const list = options || [];
    if (!search.trim()) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((item) => String(labelOf(item)).toLowerCase().includes(needle));
  }, [options, search]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (fieldRef.current?.contains(event.target)) return;
      if (dropdownRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, close]);

  const updateDropdownPosition = useCallback(() => {
    setDropdownStyle(computeDropdownPosition(triggerRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setDropdownStyle(null);
      return undefined;
    }
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  const toggle = (id) => {
    const next = selectedSet.has(id)
      ? values.filter((v) => v !== id)
      : [...values, id];
    onChange(next);
  };

  const selectedLabels = (options || [])
    .filter((item) => selectedSet.has(valueOf(item)))
    .map((item) => labelOf(item));

  const dropdown = open && dropdownStyle
    ? createPortal(
      <div
        ref={dropdownRef}
        className="report-filters__dropdown report-filters__dropdown--portal"
        style={dropdownStyle}
      >
        <input
          type="search"
          className="report-filters__search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск…"
          autoFocus
        />
        <div className="report-filters__dropdown-list">
          {filtered.length === 0 && (
            <div className="report-filters__empty">Ничего не найдено</div>
          )}
          {filtered.map((item) => {
            const id = valueOf(item);
            return (
              <label key={id} className="report-filters__check">
                <input
                  type="checkbox"
                  checked={selectedSet.has(id)}
                  onChange={() => toggle(id)}
                />
                <span>{labelOf(item)}</span>
              </label>
            );
          })}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="report-filters__field" ref={fieldRef}>
      <label className="report-filters__label">{label}</label>
      <button
        type="button"
        ref={triggerRef}
        className="report-filters__multi-trigger"
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        aria-expanded={open}
      >
        {selectedLabels.length
          ? selectedLabels.slice(0, 3).join(', ') + (selectedLabels.length > 3 ? ` +${selectedLabels.length - 3}` : '')
          : 'Не выбрано'}
      </button>
      {dropdown}
    </div>
  );
}

export default function ReportSectionFilters({
  sectionType,
  filters,
  onChange,
  countries = [],
  eventTypes = [],
  actionTypes = [],
  targetTypes = [],
  equipmentCategories = [],
  targets = [],
}) {
  const patch = (partial) => onChange({ ...filters, ...partial });

  if (sectionType === 'countries') {
    return (
      <div className="report-filters">
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
      </div>
    );
  }

  if (sectionType === 'targets') {
    return (
      <div className="report-filters">
        <div className="report-filters__field">
          <label className="report-filters__label">Наименование</label>
          <input
            className="report-filters__input"
            value={filters.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Поиск по названию"
          />
        </div>
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
        <MultiSelect
          label="Типы объектов"
          options={targetTypes}
          values={filters.type_ids || []}
          onChange={(type_ids) => patch({ type_ids })}
        />
      </div>
    );
  }

  if (sectionType === 'equipment') {
    return (
      <div className="report-filters">
        <div className="report-filters__field">
          <label className="report-filters__label">Наименование</label>
          <input
            className="report-filters__input"
            value={filters.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Поиск по названию / обозначению"
          />
        </div>
        <MultiSelect
          label="Категории"
          options={equipmentCategories}
          values={filters.category_ids || []}
          onChange={(category_ids) => patch({ category_ids })}
        />
        <MultiSelect
          label="Страны происхождения"
          options={countries}
          values={filters.origin_country_ids || []}
          onChange={(origin_country_ids) => patch({ origin_country_ids })}
        />
      </div>
    );
  }

  if (sectionType === 'events') {
    return (
      <div className="report-filters">
        <div className="report-filters__field">
          <label className="report-filters__label">Название</label>
          <input
            className="report-filters__input"
            value={filters.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div className="report-filters__row">
          <div className="report-filters__field">
            <label className="report-filters__label">Дата от</label>
            <input
              type="date"
              className="report-filters__input"
              value={filters.date_from || ''}
              onChange={(e) => patch({ date_from: e.target.value })}
            />
          </div>
          <div className="report-filters__field">
            <label className="report-filters__label">Дата до</label>
            <input
              type="date"
              className="report-filters__input"
              value={filters.date_to || ''}
              onChange={(e) => patch({ date_to: e.target.value })}
            />
          </div>
        </div>
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
        <MultiSelect
          label="Типы событий"
          options={eventTypes}
          values={filters.event_type_ids || []}
          onChange={(event_type_ids) => patch({ event_type_ids })}
        />
      </div>
    );
  }

  if (sectionType === 'situations') {
    return (
      <div className="report-filters">
        <div className="report-filters__field">
          <label className="report-filters__label">Название</label>
          <input
            className="report-filters__input"
            value={filters.title || ''}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div className="report-filters__row">
          <div className="report-filters__field">
            <label className="report-filters__label">Дата от</label>
            <input
              type="date"
              className="report-filters__input"
              value={filters.date_from || ''}
              onChange={(e) => patch({ date_from: e.target.value })}
            />
          </div>
          <div className="report-filters__field">
            <label className="report-filters__label">Дата до</label>
            <input
              type="date"
              className="report-filters__input"
              value={filters.date_to || ''}
              onChange={(e) => patch({ date_to: e.target.value })}
            />
          </div>
        </div>
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
      </div>
    );
  }

  if (sectionType === 'zones') {
    return (
      <div className="report-filters">
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
        <MultiSelect
          label="Типы зон"
          options={actionTypes}
          values={filters.action_type_ids || []}
          onChange={(action_type_ids) => patch({ action_type_ids })}
        />
        <MultiSelect
          label="Объекты"
          options={targets}
          values={filters.target_ids || []}
          onChange={(target_ids) => patch({ target_ids })}
          getOptionValue={(item) => String(item.id)}
        />
      </div>
    );
  }

  if (sectionType === 'vulnerabilities') {
    return (
      <div className="report-filters">
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
        <MultiSelect
          label="Объекты"
          options={targets}
          values={filters.target_ids || []}
          onChange={(target_ids) => patch({ target_ids })}
          getOptionValue={(item) => String(item.id)}
        />
      </div>
    );
  }

  if (sectionType === 'country_full') {
    return (
      <div className="report-filters">
        <MultiSelect
          label="Страны"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
        <p className="report-filters__hint">
          В PDF войдут досье страны и подробные формуляры всех её объектов.
        </p>
      </div>
    );
  }

  if (sectionType === 'objects_full') {
    return (
      <div className="report-filters">
        <MultiSelect
          label="Страны (опционально)"
          options={countries}
          values={filters.country_ids || []}
          onChange={(country_ids) => patch({ country_ids })}
        />
        <MultiSelect
          label="Объекты"
          options={targets}
          values={filters.target_ids || []}
          onChange={(target_ids) => patch({ target_ids })}
          getOptionValue={(item) => String(item.id)}
        />
        <p className="report-filters__hint">
          Формуляр, зоны действия, вооружение и уязвимости по выбранным объектам.
        </p>
      </div>
    );
  }

  return <p className="report-filters__empty">Нет настроек выборки для этого раздела</p>;
}
