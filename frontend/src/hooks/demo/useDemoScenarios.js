import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createDemoScenario,
  deleteDemoScenario,
  listDemoScenarios,
  updateDemoScenario,
} from '../../api/demoScenarios';
import { normalizeScenario, serializeScenario } from '../../utils/demoScenario';

/**
 * Список сценариев демонстрации с сервера.
 * Загружается лениво: первый вызов refresh() происходит при открытии конструктора
 * или при запуске демонстрации, чтобы не тратить запрос на каждый вход в карту.
 */
export function useDemoScenarios(canRead = true) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!canRead) {
      setScenarios([]);
      setLoaded(true);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listDemoScenarios();
      const normalized = data.map((item) => normalizeScenario(item));
      setScenarios(normalized);
      return normalized;
    } catch (err) {
      console.error('Не удалось загрузить сценарии демонстрации', err);
      setError(
        err?.response?.status === 403
          ? 'Нет доступа к сценариям демонстрации. Обратитесь к администратору.'
          : 'Не удалось загрузить сценарии демонстрации.',
      );
      return [];
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [canRead]);

  useEffect(() => {
    if (!canRead) {
      setScenarios([]);
      setError(null);
    }
  }, [canRead]);

  const saveScenario = useCallback(async (scenario) => {
    const payload = serializeScenario(scenario);
    const saved = scenario?.id
      ? await updateDemoScenario(scenario.id, payload)
      : await createDemoScenario(payload);
    const normalized = normalizeScenario(saved);
    setScenarios((prev) => {
      const withoutStaleDefault = normalized.is_default
        ? prev.map((item) => (item.id === normalized.id ? item : { ...item, is_default: false }))
        : prev;
      const exists = withoutStaleDefault.some((item) => String(item.id) === String(normalized.id));
      const next = exists
        ? withoutStaleDefault.map((item) => (
          String(item.id) === String(normalized.id) ? normalized : item
        ))
        : [...withoutStaleDefault, normalized];
      return next.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    });
    return normalized;
  }, []);

  const removeScenario = useCallback(async (id) => {
    await deleteDemoScenario(id);
    setScenarios((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, []);

  const defaultScenario = useMemo(
    () => scenarios.find((item) => item.is_default) || scenarios[0] || null,
    [scenarios],
  );

  return {
    scenarios,
    defaultScenario,
    loading,
    error,
    loaded,
    refresh,
    saveScenario,
    removeScenario,
  };
}
