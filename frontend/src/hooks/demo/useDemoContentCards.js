import { useEffect, useState } from 'react';
import { apiClient } from '../../config/axios';
import { DEMO_TOOL } from '../../utils/demoScenario';
import { buildSectionCards, organizeSectionData } from '../../utils/organizeSectionData';

export const FORMULAR_SYNTHETIC_CARDS = [
  { id: 'zones', title: 'Зоны действия' },
  { id: 'equipment', title: 'Вооружение и техника' },
  { id: 'subordinates', title: 'Подчинённые подразделения' },
  { id: 'persons', title: 'Персоналии' },
  { id: 'vulnerabilities', title: 'Уязвимости' },
];

export const COUNTRY_SYNTHETIC_CARDS = [
  { id: 'formular-completion', title: 'Заполненность формуляров' },
];

function cardsFromSectionPayload(raw) {
  const items = Array.isArray(raw) ? raw : (raw?.formular || []);
  const organized = organizeSectionData(items);
  return buildSectionCards({ organized, attachmentsBySection: {} })
    .map((card) => ({ id: card.id, title: card.title }));
}

function mergeCards(apiCards, extras) {
  const seen = new Set(apiCards.map((card) => card.id));
  const merged = [...apiCards];
  extras.forEach((item) => {
    if (!seen.has(item.id)) merged.push(item);
  });
  return merged;
}

/**
 * Список пунктов формуляра / справки по стране для конструктора демонстрации.
 * Берётся из первого выбранного объекта или страны.
 */
export function useDemoContentCards(tool, selection) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);

  const targetId = tool === DEMO_TOOL.FORMULAR ? (selection?.target_ids || [])[0] : null;
  const countryIso = tool === DEMO_TOOL.COUNTRY
    ? String((selection?.country_isos || [])[0] || '').trim().toUpperCase()
    : '';

  useEffect(() => {
    let cancelled = false;
    if (tool !== DEMO_TOOL.FORMULAR && tool !== DEMO_TOOL.COUNTRY) {
      setCards([]);
      return undefined;
    }
    if (!targetId && !countryIso) {
      setCards([]);
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      try {
        if (tool === DEMO_TOOL.FORMULAR) {
          const { data: result } = await apiClient.get(`/formular/${targetId}/`);
          const fromApi = cardsFromSectionPayload(result);
          if (!cancelled) setCards(mergeCards(fromApi, FORMULAR_SYNTHETIC_CARDS));
        } else {
          const { data: result } = await apiClient.get(`/country/${countryIso}/`);
          const fromApi = cardsFromSectionPayload(result);
          if (!cancelled) setCards(mergeCards(fromApi, COUNTRY_SYNTHETIC_CARDS));
        }
      } catch {
        if (!cancelled) {
          setCards(tool === DEMO_TOOL.FORMULAR ? FORMULAR_SYNTHETIC_CARDS : COUNTRY_SYNTHETIC_CARDS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tool, targetId, countryIso]);

  return { cards, loading };
}
