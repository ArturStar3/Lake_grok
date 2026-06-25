import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL as API_ROOT } from '../../config/api';

const COUNTRIES_API_URL = `${API_ROOT}/api/v1/countries`;
const EVENT_TYPES_API_URL = `${API_ROOT}/api/v1/event-types`;
const ACTION_TYPES_API_URL = `${API_ROOT}/api/v1/action-types`;

/** Справочники для вкладок «События» и зон действия (без маркеров). */
export function useFormularReferenceLists() {
  const [countriesList, setCountriesList] = useState([]);
  const [eventTypesList, setEventTypesList] = useState([]);
  const [actionTypesList, setActionTypesList] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);
  const loadSeqRef = useRef(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const seq = ++loadSeqRef.current;

    const load = async () => {
      try {
        const [countriesRes, eventTypesRes, actionTypesRes] = await Promise.all([
          axios.get(COUNTRIES_API_URL, { signal }),
          axios.get(EVENT_TYPES_API_URL, { signal }),
          axios.get(ACTION_TYPES_API_URL, { signal }),
        ]);
        if (seq !== loadSeqRef.current) return;
        setCountriesList(Array.isArray(countriesRes.data) ? countriesRes.data : []);
        setEventTypesList(Array.isArray(eventTypesRes.data) ? eventTypesRes.data : []);
        setActionTypesList(Array.isArray(actionTypesRes.data) ? actionTypesRes.data : []);
      } catch (err) {
        if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
        if (seq !== loadSeqRef.current) return;
        console.error('Не удалось загрузить справочники Formular', err);
      }
    };

    load();
    return () => {
      controller.abort();
      loadSeqRef.current += 1;
    };
  }, [reloadToken]);

  return { countriesList, eventTypesList, actionTypesList, reloadReferenceLists: reload };
}
