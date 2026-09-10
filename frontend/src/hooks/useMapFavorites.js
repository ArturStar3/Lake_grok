import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../config/axios';

export const FAVORITE_KIND = {
  OBJECT: 'object',
  EVENT: 'event',
  FORMULAR: 'formular',
  SITUATION: 'situation',
};

export const FAVORITE_KIND_LABELS = {
  [FAVORITE_KIND.OBJECT]: 'Объект',
  [FAVORITE_KIND.EVENT]: 'Событие',
  [FAVORITE_KIND.FORMULAR]: 'Пункт формуляра',
  [FAVORITE_KIND.SITUATION]: 'Оперативная обстановка',
};

export const FAVORITES_MAX = 24;

function storageKey(userId) {
  return `infolake.favorites.${userId || 'anon'}`;
}

function makeId() {
  return `fav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = Object.values(FAVORITE_KIND).includes(raw.kind) ? raw.kind : null;
  const entityId = raw.entityId != null ? String(raw.entityId).trim() : '';
  if (!kind || !entityId) return null;
  const cardId = raw.cardId != null && String(raw.cardId).trim()
    ? String(raw.cardId).trim()
    : null;
  const sourceTitle = typeof raw.sourceTitle === 'string' && raw.sourceTitle.trim()
    ? raw.sourceTitle.trim().slice(0, 160)
    : '';
  const titleRaw = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim().slice(0, 160)
    : '';
  const title = titleRaw || sourceTitle || 'Без названия';
  return {
    id: raw.id != null && String(raw.id).trim() ? String(raw.id).trim() : makeId(),
    kind,
    entityId,
    cardId: kind === FAVORITE_KIND.FORMULAR ? cardId : null,
    title,
    sourceTitle: sourceTitle || title,
    subtitle: typeof raw.subtitle === 'string' && raw.subtitle.trim()
      ? raw.subtitle.trim().slice(0, 160)
      : '',
  };
}

function itemKey(item) {
  return `${item.kind}:${item.entityId}:${item.cardId || ''}`;
}

function loadLocalItems(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const items = [];
    parsed.forEach((row) => {
      const item = normalizeItem(row);
      if (!item) return;
      const key = itemKey(item);
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    });
    return items.slice(0, FAVORITES_MAX);
  } catch {
    return [];
  }
}

function clearLocalItems(userId) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

function fromApi(raw) {
  return normalizeItem({
    id: raw.id,
    kind: raw.kind,
    entityId: raw.entity_id,
    cardId: raw.card_id,
    title: raw.title,
    sourceTitle: raw.source_title,
    subtitle: raw.subtitle,
  });
}

function toApiPayload(item) {
  return {
    kind: item.kind,
    entity_id: item.entityId,
    card_id: item.cardId || '',
    title: item.title,
    source_title: item.sourceTitle || item.title,
    subtitle: item.subtitle || '',
  };
}

function apiErrorMessage(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return String(data.non_field_errors[0]);
  }
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0]) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}

function isDuplicateFavoriteError(err) {
  const message = apiErrorMessage(err, '');
  return err?.response?.status === 400 && message.includes('уже в избранном');
}

async function fetchFavoriteItems() {
  const { data } = await apiClient.get('/map-favorites/');
  return Array.isArray(data) ? data.map(fromApi).filter(Boolean) : [];
}

const migrateLocks = new Map();

async function migrateLocalFavorites(userId) {
  const pending = migrateLocks.get(userId);
  if (pending) return pending;

  const run = (async () => {
    const local = loadLocalItems(userId);
    if (!local.length) return;
    for (const item of local) {
      try {
        await apiClient.post('/map-favorites/', toApiPayload(item));
      } catch (err) {
        if (!isDuplicateFavoriteError(err)) {
          /* пункт не перенёсся — оставляем localStorage */
          return;
        }
      }
    }
    clearLocalItems(userId);
  })();

  migrateLocks.set(userId, run);
  try {
    await run;
  } finally {
    migrateLocks.delete(userId);
  }
  return undefined;
}

export function useMapFavorites(userId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        let list = await fetchFavoriteItems();
        if (list.length === 0) {
          await migrateLocalFavorites(userId);
          list = await fetchFavoriteItems();
        }
        if (list.length > 0) clearLocalItems(userId);
        if (!cancelled) {
          itemsRef.current = list;
          setItems(list);
        }
      } catch {
        if (!cancelled) {
          const local = loadLocalItems(userId);
          itemsRef.current = local;
          setItems(local);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const addItem = useCallback(async (payload) => {
    const item = normalizeItem({ ...payload, id: makeId() });
    if (!item) return { ok: false, message: 'Не удалось добавить пункт.' };
    const prev = itemsRef.current;
    const key = itemKey(item);
    if (prev.some((row) => itemKey(row) === key)) {
      return { ok: false, message: 'Этот пункт уже в избранном.' };
    }
    if (prev.length >= FAVORITES_MAX) {
      return { ok: false, message: `Не больше ${FAVORITES_MAX} пунктов.` };
    }
    try {
      const { data } = await apiClient.post('/map-favorites/', toApiPayload(item));
      const created = fromApi(data);
      if (!created) return { ok: false, message: 'Не удалось добавить пункт.' };
      const next = [...itemsRef.current, created];
      itemsRef.current = next;
      setItems(next);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: apiErrorMessage(err, 'Не удалось сохранить избранное.') };
    }
  }, []);

  const removeItem = useCallback(async (id) => {
    const prev = itemsRef.current;
    const next = prev.filter((item) => item.id !== id);
    itemsRef.current = next;
    setItems(next);
    try {
      await apiClient.delete(`/map-favorites/${id}/`);
    } catch {
      itemsRef.current = prev;
      setItems(prev);
    }
  }, []);

  const updateItem = useCallback(async (id, patch) => {
    const prev = itemsRef.current;
    const current = prev.find((item) => item.id === id);
    if (!current) return;
    const optimistic = normalizeItem({ ...current, ...patch, id: current.id }) || current;
    const next = prev.map((item) => (item.id === id ? optimistic : item));
    itemsRef.current = next;
    setItems(next);
    try {
      const { data } = await apiClient.patch(`/map-favorites/${id}/`, {
        title: optimistic.title,
        source_title: optimistic.sourceTitle,
        subtitle: optimistic.subtitle,
      });
      const saved = fromApi(data);
      if (!saved) return;
      const synced = itemsRef.current.map((item) => (item.id === id ? saved : item));
      itemsRef.current = synced;
      setItems(synced);
    } catch {
      itemsRef.current = prev;
      setItems(prev);
    }
  }, []);

  return { items, loading, addItem, removeItem, updateItem };
}
