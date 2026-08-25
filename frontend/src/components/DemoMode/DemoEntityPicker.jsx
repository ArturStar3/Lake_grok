import { useMemo, useState } from 'react';
import CountriesMultiAutocomplete from '../common/CountriesMultiAutocomplete/CountriesMultiAutocomplete';
import { ZONE_LEAF_MANUAL, makeParamLeaf } from '../../utils/inundationZone';
import { getSituationDisplayRevision, getSituationTitle } from '../../utils/situationUtils';
import { DEMO_TOOL } from '../../utils/demoScenario';
import { useDemoContentCards } from '../../hooks/demo/useDemoContentCards';

function matchesQuery(text, query) {
  if (!query) return true;
  return String(text || '').toLowerCase().includes(query.toLowerCase());
}

function uniqueCountriesFromItems(items) {
  const seen = new Set();
  items.forEach((item) => {
    const titles = item.countryTitles?.length
      ? item.countryTitles
      : (item.countryTitle ? [item.countryTitle] : []);
    titles.forEach((title) => {
      if (title) seen.add(title);
    });
  });
  return [...seen].sort((a, b) => a.localeCompare(b, 'ru'));
}

function itemMatchesCountry(item, selectedTitles) {
  if (!selectedTitles?.length) return true;
  const selected = new Set(selectedTitles);
  if (item.countryTitles?.length) return item.countryTitles.some((title) => selected.has(title));
  return selected.has(item.countryTitle);
}

function leafKey(row) {
  return `${row.country}\u0001${row.actionTypeId}\u0001${row.leaf}`;
}

function titlesToCountryOptions(titles) {
  return titles.map((title) => ({ id: title, title }));
}

function CountryFilter({ countries, value, onChange }) {
  const options = useMemo(() => titlesToCountryOptions(countries), [countries]);
  if (countries.length < 2) return null;
  return (
    <label className="demo-picker__country">
      <span className="demo-picker__country-label">Страна</span>
      <CountriesMultiAutocomplete
        countries={options}
        value={value}
        onChange={onChange}
        placeholder="Все страны"
      />
    </label>
  );
}

function ContentCardPicker({ tool, selection, onChange }) {
  const { cards, loading } = useDemoContentCards(tool, selection);
  const selected = useMemo(
    () => new Set((selection.card_ids || []).map(String)),
    [selection.card_ids],
  );
  const hasEntity = tool === DEMO_TOOL.FORMULAR
    ? Boolean((selection.target_ids || []).length)
    : Boolean((selection.country_isos || []).length);

  if (!hasEntity) {
    return (
      <p className="demo-field__hint">
        Сначала выберите {tool === DEMO_TOOL.FORMULAR ? 'объект' : 'страну'}, затем пункты для проваливания.
      </p>
    );
  }

  const toggle = (id) => {
    const key = String(id);
    const current = selection.card_ids || [];
    onChange(
      current.map(String).includes(key)
        ? current.filter((item) => String(item) !== key)
        : [...current, key],
    );
  };

  return (
    <div className="demo-picker demo-picker--cards">
      <p className="demo-picker__country-label">Пункты для проваливания</p>
      {loading && <p className="demo-picker__empty">Загрузка пунктов…</p>}
      {!loading && !cards.length && (
        <p className="demo-picker__empty">Пункты не найдены.</p>
      )}
      {!loading && cards.length > 0 && (
        <div className="demo-picker__list">
          {cards.map((card) => (
            <CheckboxRow
              key={card.id}
              checked={selected.has(String(card.id))}
              onChange={() => toggle(card.id)}
              label={card.title}
            />
          ))}
        </div>
      )}
      <p className="demo-field__hint">
        Пустой список — обзорная сетка. Несколько пунктов показываются по очереди.
      </p>
    </div>
  );
}

function CheckboxRow({ checked, onChange, label, hint }) {
  return (
    <label className="demo-picker__row">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="demo-picker__row-label">{label}</span>
      {hint ? <span className="demo-picker__row-hint">{hint}</span> : null}
    </label>
  );
}

function ListPicker({
  items,
  selectedIds = [],
  onToggle,
  onSetAll,
  emptyText,
  searchPlaceholder,
  showCountryFilter = true,
  single = false,
}) {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState([]);
  const selected = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const countries = useMemo(() => uniqueCountriesFromItems(items), [items]);

  const filtered = useMemo(
    () => items.filter((item) => (
      itemMatchesCountry(item, countryFilter)
      && (matchesQuery(item.label, query) || matchesQuery(item.hint, query))
    )),
    [items, query, countryFilter],
  );

  const selectVisible = () => {
    const visibleIds = filtered.map((item) => String(item.id));
    onSetAll([...new Set([...selectedIds.map(String), ...visibleIds])]);
  };

  const clearVisible = () => {
    const visible = new Set(filtered.map((item) => String(item.id)));
    onSetAll(selectedIds.filter((id) => !visible.has(String(id))));
  };

  if (!items.length) {
    return <p className="demo-picker__empty">{emptyText}</p>;
  }

  return (
    <div className="demo-picker">
      <div className="demo-picker__toolbar demo-picker__toolbar--wrap">
        {showCountryFilter && (
          <CountryFilter
            countries={countries}
            value={countryFilter}
            onChange={setCountryFilter}
          />
        )}
        <input
          type="search"
          className="demo-picker__search"
          value={query}
          placeholder={searchPlaceholder}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!single && (
          <>
            <button type="button" className="demo-btn demo-btn--ghost" onClick={selectVisible}>
              Все
            </button>
            <button type="button" className="demo-btn demo-btn--ghost" onClick={clearVisible}>
              Ничего
            </button>
          </>
        )}
      </div>
      <div className="demo-picker__list">
        {filtered.map((item) => (
          <CheckboxRow
            key={item.id}
            checked={selected.has(String(item.id))}
            onChange={() => {
              if (single) {
                onSetAll(selected.has(String(item.id)) ? [] : [item.id]);
                return;
              }
              onToggle(item.id);
            }}
            label={item.label}
            hint={item.hint}
          />
        ))}
        {!filtered.length && <p className="demo-picker__empty">Ничего не найдено</p>}
      </div>
      <p className="demo-picker__counter">
        {single ? (selected.size ? 'Выбрано' : 'Не выбрано') : `Выбрано: ${selected.size}`}
      </p>
    </div>
  );
}

function ZoneLeafPicker({ catalogByCountry, zoneLeaves, onChange, inundationOnly }) {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState([]);
  const selectedKeys = useMemo(
    () => new Set(zoneLeaves.map((leaf) => `${leaf.country}\u0001${leaf.action_type_id}\u0001${leaf.leaf}`)),
    [zoneLeaves],
  );

  const grouped = useMemo(() => {
    const result = [];
    Object.keys(catalogByCountry)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .forEach((country) => {
        if (countryFilter.length && !countryFilter.includes(country)) return;
        const leaves = [];
        (catalogByCountry[country] || []).forEach((group) => {
          if (inundationOnly && !group.isInundation) return;
          const actionTypeId = String(group.actionTypeId);
          const candidates = [];
          if (group.hasManual) {
            candidates.push({
              country,
              actionTypeId,
              leaf: ZONE_LEAF_MANUAL,
              label: group.actionTypeTitle,
            });
          }
          (group.ttxParameters || []).forEach((param) => {
            candidates.push({
              country,
              actionTypeId,
              leaf: makeParamLeaf(param.parameterId),
              label: `${group.actionTypeTitle} · ${param.title}`,
            });
          });
          candidates.forEach((row) => {
            if (matchesQuery(row.label, query) || matchesQuery(country, query)) {
              leaves.push(row);
            }
          });
        });
        if (leaves.length) result.push({ country, leaves });
      });
    return result;
  }, [catalogByCountry, countryFilter, inundationOnly, query]);

  const visibleRows = useMemo(
    () => grouped.flatMap((group) => group.leaves),
    [grouped],
  );

  const countries = useMemo(
    () => Object.keys(catalogByCountry)
      .filter((country) => (catalogByCountry[country] || []).some(
        (group) => !inundationOnly || group.isInundation,
      ))
      .sort((a, b) => a.localeCompare(b, 'ru')),
    [catalogByCountry, inundationOnly],
  );

  const toggle = (row) => {
    const key = leafKey(row);
    if (selectedKeys.has(key)) {
      onChange(zoneLeaves.filter(
        (leaf) => `${leaf.country}\u0001${leaf.action_type_id}\u0001${leaf.leaf}` !== key,
      ));
      return;
    }
    onChange([
      ...zoneLeaves,
      { country: row.country, action_type_id: row.actionTypeId, leaf: row.leaf },
    ]);
  };

  const selectRows = (rows) => {
    const next = [...zoneLeaves];
    const seen = new Set(selectedKeys);
    rows.forEach((row) => {
      const key = leafKey(row);
      if (seen.has(key)) return;
      seen.add(key);
      next.push({ country: row.country, action_type_id: row.actionTypeId, leaf: row.leaf });
    });
    onChange(next);
  };

  const clearRows = (rows) => {
    const remove = new Set(rows.map(leafKey));
    onChange(zoneLeaves.filter(
      (leaf) => !remove.has(`${leaf.country}\u0001${leaf.action_type_id}\u0001${leaf.leaf}`),
    ));
  };

  const toggleCountry = (leaves, allOn) => {
    if (allOn) clearRows(leaves);
    else selectRows(leaves);
  };

  const hasAnyLeaves = Object.values(catalogByCountry).some((groups) => (
    groups.some((group) => !inundationOnly || group.isInundation)
  ));

  if (!hasAnyLeaves) {
    return (
      <p className="demo-picker__empty">
        {inundationOnly
          ? 'Зоны затопления не найдены. Задайте у типа действия признак «зона затопления».'
          : 'Зоны действия у объектов не настроены.'}
      </p>
    );
  }

  return (
    <div className="demo-picker">
      <div className="demo-picker__toolbar demo-picker__toolbar--wrap">
        <CountryFilter
          countries={countries}
          value={countryFilter}
          onChange={setCountryFilter}
        />
        <input
          type="search"
          className="demo-picker__search"
          value={query}
          placeholder="Поиск типа зоны"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="demo-btn demo-btn--ghost" onClick={() => selectRows(visibleRows)}>
          Все
        </button>
        <button type="button" className="demo-btn demo-btn--ghost" onClick={() => clearRows(visibleRows)}>
          Ничего
        </button>
      </div>
      <div className="demo-picker__list demo-picker__list--groups">
        {grouped.map(({ country, leaves }) => {
          const selectedCount = leaves.filter((row) => selectedKeys.has(leafKey(row))).length;
          const allOn = selectedCount === leaves.length && leaves.length > 0;
          const someOn = selectedCount > 0 && !allOn;
          return (
            <details key={country} className="demo-picker__country-group" open>
              <summary className="demo-picker__country-header">
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = someOn;
                  }}
                  onChange={() => toggleCountry(leaves, allOn)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="demo-picker__country-name">{country}</span>
                <span className="demo-picker__country-count">({leaves.length})</span>
              </summary>
              <div className="demo-picker__country-leaves">
                {leaves.map((row) => {
                  const key = leafKey(row);
                  return (
                    <CheckboxRow
                      key={key}
                      checked={selectedKeys.has(key)}
                      onChange={() => toggle(row)}
                      label={row.label}
                    />
                  );
                })}
              </div>
            </details>
          );
        })}
        {!grouped.length && <p className="demo-picker__empty">Ничего не найдено</p>}
      </div>
      <p className="demo-picker__counter">Выбрано: {zoneLeaves.length}</p>
    </div>
  );
}

/**
 * Подбор конкретных сущностей для шага сценария из уже загруженных списков карты.
 */
export default function DemoEntityPicker({
  tool,
  selection,
  onSelectionChange,
  objects = [],
  events = [],
  situations = [],
  zoneCatalogByCountry = {},
  overlayLayers = [],
  countriesList = [],
}) {
  const patch = (partial) => onSelectionChange({ ...selection, ...partial });

  const toggleId = (field) => (id) => {
    const list = selection[field] || [];
    const key = String(id);
    patch({
      [field]: list.map(String).includes(key)
        ? list.filter((item) => String(item) !== key)
        : [...list, key],
    });
  };

  const setAllIds = (field) => (ids) => patch({ [field]: ids.map(String) });

  switch (tool) {
    case DEMO_TOOL.OBJECTS:
      return (
        <ListPicker
          items={objects.map((obj) => ({
            id: obj.id,
            label: obj.title || obj.label || '—',
            hint: obj.country?.title || '',
            countryTitle: obj.country?.title || '',
          }))}
          selectedIds={selection.target_ids || []}
          onToggle={toggleId('target_ids')}
          onSetAll={setAllIds('target_ids')}
          emptyText="Объекты не загружены."
          searchPlaceholder="Поиск объекта"
        />
      );
    case DEMO_TOOL.FORMULAR:
      return (
        <>
          <ListPicker
            items={objects.map((obj) => ({
              id: obj.id,
              label: obj.title || obj.label || '—',
              hint: obj.country?.title || '',
              countryTitle: obj.country?.title || '',
            }))}
            selectedIds={selection.target_ids || []}
            onToggle={toggleId('target_ids')}
            onSetAll={setAllIds('target_ids')}
            emptyText="Объекты не загружены."
            searchPlaceholder="Поиск объекта"
          />
          <ContentCardPicker
            tool={tool}
            selection={selection}
            onChange={(card_ids) => patch({ card_ids })}
          />
        </>
      );
    case DEMO_TOOL.EVENTS:
      return (
        <ListPicker
          items={events.map((item) => ({
            id: item.id,
            label: item.title || 'Событие',
            hint: [item.country?.title, item.date_start].filter(Boolean).join(' · '),
            countryTitle: item.country?.title || '',
          }))}
          selectedIds={selection.event_ids || []}
          onToggle={toggleId('event_ids')}
          onSetAll={setAllIds('event_ids')}
          emptyText="События не загружены. Откройте вкладку «События», чтобы подтянуть список."
          searchPlaceholder="Поиск события"
        />
      );
    case DEMO_TOOL.SITUATIONS:
      return (
        <ListPicker
          items={situations.map((item) => {
            const rev = getSituationDisplayRevision(item);
            const countryTitles = (rev?.countries || []).map((country) => country.title).filter(Boolean);
            return {
              id: item.id,
              label: getSituationTitle(item) || 'Обстановка',
              hint: [countryTitles.join(', '), `состояний: ${item.revision_count ?? 1}`]
                .filter(Boolean)
                .join(' · '),
              countryTitles,
            };
          })}
          selectedIds={(selection.situation_ids || []).slice(0, 1)}
          onToggle={toggleId('situation_ids')}
          onSetAll={setAllIds('situation_ids')}
          emptyText="Обстановки не загружены. Откройте вкладку «Оперативная обстановка»."
          searchPlaceholder="Поиск обстановки"
          single
        />
      );
    case DEMO_TOOL.ZONES:
      return (
        <ZoneLeafPicker
          catalogByCountry={zoneCatalogByCountry}
          zoneLeaves={selection.zone_leaves || []}
          onChange={(zoneLeaves) => patch({ zone_leaves: zoneLeaves })}
          inundationOnly={false}
        />
      );
    case DEMO_TOOL.INUNDATION:
      return (
        <ZoneLeafPicker
          catalogByCountry={zoneCatalogByCountry}
          zoneLeaves={selection.zone_leaves || []}
          onChange={(zoneLeaves) => patch({ zone_leaves: zoneLeaves })}
          inundationOnly
        />
      );
    case DEMO_TOOL.LAYERS:
      return (
        <ListPicker
          items={overlayLayers.map((layer) => ({
            id: layer.id,
            label: layer.label || layer.id,
            hint: '',
          }))}
          selectedIds={selection.overlay_layer_ids || []}
          onToggle={toggleId('overlay_layer_ids')}
          onSetAll={setAllIds('overlay_layer_ids')}
          emptyText="Переключаемые слои не настроены."
          searchPlaceholder="Поиск слоя"
          showCountryFilter={false}
        />
      );
    case DEMO_TOOL.COUNTRY:
      return (
        <>
          <ListPicker
            items={countriesList
              .map((country) => ({
                id: String(country.iso_code || '').toUpperCase(),
                label: country.title || country.iso_code || '—',
                hint: country.iso_code || '',
              }))
              .filter((item) => item.id)}
            selectedIds={selection.country_isos || []}
            onToggle={toggleId('country_isos')}
            onSetAll={setAllIds('country_isos')}
            emptyText="Страны не загружены."
            searchPlaceholder="Поиск страны"
            showCountryFilter={false}
          />
          <ContentCardPicker
            tool={tool}
            selection={selection}
            onChange={(card_ids) => patch({ card_ids })}
          />
        </>
      );
    default:
      return (
        <p className="demo-picker__empty">
          Для этого инструмента выбор сущностей не требуется — настройте камеру ниже.
        </p>
      );
  }
}
