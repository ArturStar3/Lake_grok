import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_TOOL } from '../../utils/demoScenario';
import { useDemoContentCards } from '../../hooks/demo/useDemoContentCards';
import { getSituationDisplayRevision, getSituationTitle } from '../../utils/situationUtils';
import { apiClient } from '../../config/axios';
import {
  FAVORITE_KIND,
  FAVORITE_KIND_LABELS,
  FAVORITES_MAX,
} from '../../hooks/useMapFavorites';

function matchesQuery(text, query) {
  if (!query) return true;
  return String(text || '').toLowerCase().includes(query.toLowerCase());
}

function uniqueCountryTitles(items) {
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

function itemMatchesCountry(item, countryTitle) {
  if (!countryTitle) return true;
  if (item.countryTitles?.length) return item.countryTitles.includes(countryTitle);
  return item.countryTitle === countryTitle;
}

function itemSecondary(item) {
  const parts = [];
  if (item.sourceTitle && item.sourceTitle !== item.title) parts.push(item.sourceTitle);
  if (item.subtitle && item.subtitle !== item.title && item.subtitle !== item.sourceTitle) {
    parts.push(item.subtitle);
  }
  return parts.join(' · ');
}

function FavoriteRow({ item, onSelect, onRemove, onUpdate, onNotice, settingsOnly }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const skipCommitRef = useRef(false);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(item.title);
    setEditing(true);
  };

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    const next = draft.trim();
    onUpdate?.(item.id, { title: next || item.sourceTitle || item.title });
    setEditing(false);
  };

  const secondary = itemSecondary(item);

  return (
    <li className="map-fs-favorites__row">
      {editing ? (
        <input
          className="map-fs-favorites__rename"
          value={draft}
          autoFocus
          maxLength={160}
          aria-label="Подпись"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              skipCommitRef.current = true;
              setDraft(item.title);
              setEditing(false);
            }
          }}
        />
      ) : settingsOnly ? (
        <div className="map-fs-favorites__settings-item">
          <small>{FAVORITE_KIND_LABELS[item.kind] || item.kind}</small>
          <span>{item.title}</span>
          {secondary ? <em>{secondary}</em> : null}
        </div>
      ) : (
        <button
          type="button"
          className="map-fs-favorites__go"
          onClick={() => {
            const message = onSelect?.(item);
            if (message) onNotice(message);
            else onNotice('');
          }}
        >
          <small>{FAVORITE_KIND_LABELS[item.kind] || item.kind}</small>
          <span>{item.title}</span>
          {secondary ? <em>{secondary}</em> : null}
        </button>
      )}
      <button
        type="button"
        className="map-fs-favorites__rename-btn"
        aria-label="Изменить подпись"
        title="Подпись"
        onMouseDown={(e) => e.preventDefault()}
        onClick={startEdit}
      >
        ✎
      </button>
      <button
        type="button"
        className="map-fs-favorites__remove"
        aria-label="Удалить"
        onClick={() => onRemove?.(item.id)}
      >
        ×
      </button>
    </li>
  );
}

function KindTabs({ kinds, value, onChange }) {
  return (
    <div className="map-fs-favorites__tabs" role="tablist">
      {kinds.map((kind) => (
        <button
          key={kind}
          type="button"
          role="tab"
          aria-selected={value === kind}
          className={`map-fs-favorites__tab${value === kind ? ' is-active' : ''}`}
          onClick={() => onChange(kind)}
        >
          {FAVORITE_KIND_LABELS[kind]}
        </button>
      ))}
    </div>
  );
}

function SearchList({
  items,
  emptyText,
  loading,
  onPick,
  countryOptions = [],
  countryFilter = '',
  onCountryFilterChange,
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => items.filter((item) => (
      itemMatchesCountry(item, countryFilter)
      && matchesQuery(`${item.label} ${item.hint || ''}`, query)
    )),
    [items, query, countryFilter],
  );

  return (
    <div className="map-fs-favorites__picker">
      {countryOptions.length > 0 && onCountryFilterChange && (
        <select
          className="map-fs-favorites__country"
          value={countryFilter}
          onChange={(e) => onCountryFilterChange(e.target.value)}
          aria-label="Страна"
        >
          <option value="">Все страны</option>
          {countryOptions.map((title) => (
            <option key={title} value={title}>{title}</option>
          ))}
        </select>
      )}
      <input
        type="search"
        className="map-fs-favorites__search"
        placeholder="Поиск"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading ? (
        <p className="map-fs-favorites__empty">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <p className="map-fs-favorites__empty">{emptyText}</p>
      ) : (
        <ul className="map-fs-favorites__pick-list">
          {filtered.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item)}>
                <span>{item.label}</span>
                {item.hint ? <small>{item.hint}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularCardStep({ targetId, onPick, onBack }) {
  const { cards, loading } = useDemoContentCards(DEMO_TOOL.FORMULAR, {
    target_ids: [targetId],
  });
  const [personsOpen, setPersonsOpen] = useState(false);
  const [persons, setPersons] = useState([]);
  const [personsLoading, setPersonsLoading] = useState(false);

  useEffect(() => {
    if (!personsOpen) return undefined;
    let cancelled = false;
    setPersonsLoading(true);
    apiClient.get(`/persons/?target=${targetId}`)
      .then(({ data }) => {
        if (!cancelled) setPersons(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPersons([]);
      })
      .finally(() => {
        if (!cancelled) setPersonsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personsOpen, targetId]);

  if (personsOpen) {
    const personItems = persons.map((person) => ({
      id: `persons:${person.id}`,
      label: person.full_name || 'Персона',
      hint: person.position || '',
    }));
    return (
      <div>
        <button type="button" className="map-fs-favorites__back" onClick={() => setPersonsOpen(false)}>
          ← К пунктам формуляра
        </button>
        <SearchList
          items={personItems}
          emptyText="Персоналии не найдены."
          loading={personsLoading}
          onPick={onPick}
        />
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="map-fs-favorites__back" onClick={onBack}>
        ← К объектам
      </button>
      <SearchList
        items={cards.map((card) => ({ id: card.id, label: card.title }))}
        emptyText="Пункты формуляра не найдены."
        loading={loading}
        onPick={(card) => {
          if (card.id === 'persons') {
            setPersonsOpen(true);
            return;
          }
          onPick(card);
        }}
      />
    </div>
  );
}

export default function MapFavoritesMenu({
  items = [],
  onAdd,
  onRemove,
  onUpdate,
  onSelect,
  objects = [],
  events = [],
  situations = [],
  canReadEvents = true,
  canReadSituations = true,
  eventsLoading = false,
  situationsLoading = false,
  onNeedEvents,
  onNeedSituations,
  loading = false,
  embedded = false,
  settingsOnly = false,
}) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState(FAVORITE_KIND.OBJECT);
  const [formularTarget, setFormularTarget] = useState(null);
  const [countryFilter, setCountryFilter] = useState('');
  const [caption, setCaption] = useState('');
  const [notice, setNotice] = useState('');

  const kinds = useMemo(() => {
    const list = [FAVORITE_KIND.OBJECT, FAVORITE_KIND.FORMULAR];
    if (canReadEvents) list.splice(1, 0, FAVORITE_KIND.EVENT);
    if (canReadSituations) list.push(FAVORITE_KIND.SITUATION);
    return list;
  }, [canReadEvents, canReadSituations]);

  useEffect(() => {
    onNeedEvents?.();
    onNeedSituations?.();
  }, [onNeedEvents, onNeedSituations]);

  useEffect(() => {
    if (!adding) return;
    if (kind === FAVORITE_KIND.EVENT) onNeedEvents?.();
    if (kind === FAVORITE_KIND.SITUATION) onNeedSituations?.();
  }, [adding, kind, onNeedEvents, onNeedSituations]);

  useEffect(() => {
    if (!kinds.includes(kind)) setKind(kinds[0] || FAVORITE_KIND.OBJECT);
  }, [kind, kinds]);

  const objectItems = useMemo(
    () => (objects || []).map((obj) => ({
      id: obj.id,
      label: obj.title || obj.label || '—',
      hint: obj.country?.title || '',
      countryTitle: obj.country?.title || '',
      raw: obj,
    })),
    [objects],
  );

  const eventItems = useMemo(
    () => (events || []).map((item) => ({
      id: item.id,
      label: item.title || 'Событие',
      hint: [item.country?.title, item.date_start].filter(Boolean).join(' · '),
      countryTitle: item.country?.title || '',
      raw: item,
    })),
    [events],
  );

  const situationItems = useMemo(
    () => (situations || []).map((item) => {
      const rev = getSituationDisplayRevision(item);
      const countryTitles = (rev?.countries || []).map((country) => country.title).filter(Boolean);
      return {
        id: item.id,
        label: getSituationTitle(item) || 'Обстановка',
        hint: countryTitles.join(', '),
        countryTitles,
        raw: item,
      };
    }),
    [situations],
  );

  const pickerItems = kind === FAVORITE_KIND.EVENT
    ? eventItems
    : kind === FAVORITE_KIND.SITUATION
      ? situationItems
      : objectItems;

  const countryOptions = useMemo(() => uniqueCountryTitles(pickerItems), [pickerItems]);

  useEffect(() => {
    if (countryFilter && !countryOptions.includes(countryFilter)) {
      setCountryFilter('');
    }
  }, [countryFilter, countryOptions]);

  const report = async (result) => {
    const resolved = await Promise.resolve(result);
    if (resolved?.ok === false && resolved.message) {
      setNotice(resolved.message);
      return;
    }
    setNotice('');
    setAdding(false);
    setFormularTarget(null);
    setCountryFilter('');
    setCaption('');
  };

  const applyCaption = (fallbackTitle, subtitle = '') => {
    const custom = caption.trim();
    if (!custom) {
      setNotice('Введите подпись для кнопки.');
      return null;
    }
    return {
      title: custom,
      sourceTitle: fallbackTitle,
      subtitle,
    };
  };

  const handlePickObject = (item) => {
    const captionData = applyCaption(item.label, item.hint);
    if (!captionData) return;
    report(onAdd?.({
      kind: FAVORITE_KIND.OBJECT,
      entityId: item.id,
      ...captionData,
    }));
  };

  const handlePickEvent = (item) => {
    const captionData = applyCaption(item.label, item.hint);
    if (!captionData) return;
    report(onAdd?.({
      kind: FAVORITE_KIND.EVENT,
      entityId: item.id,
      ...captionData,
    }));
  };

  const handlePickSituation = (item) => {
    const captionData = applyCaption(item.label, item.hint);
    if (!captionData) return;
    report(onAdd?.({
      kind: FAVORITE_KIND.SITUATION,
      entityId: item.id,
      ...captionData,
    }));
  };

  const handlePickFormularCard = (card) => {
    const captionData = applyCaption(card.label, formularTarget.label);
    if (!captionData) return;
    report(onAdd?.({
      kind: FAVORITE_KIND.FORMULAR,
      entityId: formularTarget.id,
      cardId: card.id,
      ...captionData,
    }));
  };

  return (
    <div className={`map-fs-favorites${embedded ? ' map-fs-favorites--embedded' : ''}`} role="menu">
      <div className="map-fs-favorites__head">
        <span>Быстрые переходы</span>
        <span className="map-fs-favorites__count">{items.length}/{FAVORITES_MAX}</span>
      </div>
      {notice ? <p className="map-fs-favorites__notice">{notice}</p> : null}
      {loading && items.length === 0 && !adding ? (
        <p className="map-fs-favorites__empty">Загрузка…</p>
      ) : items.length === 0 && !adding ? (
        <p className="map-fs-favorites__empty">Добавьте объект, событие, пункт формуляра или оперативную обстановку.</p>
      ) : (
        <ul className="map-fs-favorites__list">
          {items.map((item) => (
            <FavoriteRow
              key={item.id}
              item={item}
              onSelect={onSelect}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onNotice={setNotice}
              settingsOnly={settingsOnly}
            />
          ))}
        </ul>
      )}
      {adding ? (
        <div className="map-fs-favorites__add">
          <KindTabs
            kinds={kinds}
            value={kind}
            onChange={(next) => {
              setKind(next);
              setFormularTarget(null);
              setNotice('');
            }}
          />
          <input
            type="text"
            className="map-fs-favorites__search"
            placeholder="Подпись кнопки"
            value={caption}
            maxLength={160}
            onChange={(e) => setCaption(e.target.value)}
            aria-label="Подпись кнопки"
          />
          {kind === FAVORITE_KIND.OBJECT && (
            <SearchList
              items={objectItems}
              emptyText={objectItems.length === 0 ? 'Объекты не загружены.' : 'Ничего не найдено.'}
              countryOptions={countryOptions}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
              onPick={handlePickObject}
            />
          )}
          {kind === FAVORITE_KIND.EVENT && (
            <SearchList
              items={eventItems}
              emptyText={eventItems.length === 0 ? 'События не загружены.' : 'Ничего не найдено.'}
              loading={eventsLoading && eventItems.length === 0}
              countryOptions={countryOptions}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
              onPick={handlePickEvent}
            />
          )}
          {kind === FAVORITE_KIND.SITUATION && (
            <SearchList
              items={situationItems}
              emptyText={situationItems.length === 0 ? 'Обстановки не загружены.' : 'Ничего не найдено.'}
              loading={situationsLoading && situationItems.length === 0}
              countryOptions={countryOptions}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
              onPick={handlePickSituation}
            />
          )}
          {kind === FAVORITE_KIND.FORMULAR && !formularTarget && (
            <SearchList
              items={objectItems}
              emptyText={objectItems.length === 0 ? 'Сначала выберите объект.' : 'Ничего не найдено.'}
              countryOptions={countryOptions}
              countryFilter={countryFilter}
              onCountryFilterChange={setCountryFilter}
              onPick={(item) => setFormularTarget(item)}
            />
          )}
          {kind === FAVORITE_KIND.FORMULAR && formularTarget && (
            <FormularCardStep
              targetId={formularTarget.id}
              onPick={handlePickFormularCard}
              onBack={() => setFormularTarget(null)}
            />
          )}
          <button
            type="button"
            className="map-fs-favorites__cancel"
            onClick={() => {
              setAdding(false);
              setFormularTarget(null);
              setCountryFilter('');
              setCaption('');
              setNotice('');
            }}
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="map-fs-favorites__add-btn"
          onClick={() => {
            setAdding(true);
            setNotice('');
          }}
        >
          Добавить кнопку
        </button>
      )}
    </div>
  );
}
