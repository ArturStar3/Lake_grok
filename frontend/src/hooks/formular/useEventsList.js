import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL as API_ROOT } from '../../config/api';
import { buildEventShape } from '../../utils/eventGeometry';

const EVENTS_API_URL = `${API_ROOT}/api/v1/events`;

const EMPTY_FILTERS = {
  title: '',
  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
  countries: [],
  eventTypes: [],
};

function buildEventRequestBody(payload) {
  const shape = buildEventShape(payload?.geometry);
  return {
    title: payload.title,
    object_name: payload.object,
    description: payload.info,
    date_start: payload.dateStart || null,
    date_end: payload.dateEnd || null,
    time_start: payload.timeStart || null,
    time_end: payload.timeEnd || null,
    event_type: payload.eventType?.id || null,
    country: payload.country?.id || null,
    marker: payload.marker?.id || null,
    color: payload.color || '#2f80ed',
    shape,
  };
}

export function useEventsList(activeTab) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const fetchAbortRef = useRef(null);
  const fetchSeqRef = useRef(0);

  const fetchEvents = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.title?.trim()) params.title = filters.title.trim();
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.timeFrom) params.time_from = filters.timeFrom;
      if (filters.timeTo) params.time_to = filters.timeTo;
      if (filters.countries.length > 0) params.countries = filters.countries.join(',');
      if (filters.eventTypes.length > 0) params.event_types = filters.eventTypes.join(',');

      const resp = await axios.get(EVENTS_API_URL, { params, signal: controller.signal });
      if (seq !== fetchSeqRef.current) return;
      setEvents(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== fetchSeqRef.current) return;
      console.error('Не удалось загрузить события', err);
      setError('Не удалось загрузить события.');
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    if (activeTab !== 'events') return undefined;
    const timer = setTimeout(fetchEvents, 350);
    return () => {
      clearTimeout(timer);
      fetchAbortRef.current?.abort();
    };
  }, [activeTab, fetchEvents]);

  const saveEvent = useCallback(async (payload) => {
    try {
      await axios.post(`${EVENTS_API_URL}/`, buildEventRequestBody(payload));
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Не удалось сохранить событие', err);
      return false;
    }
  }, [fetchEvents]);

  const updateEvent = useCallback(async (payload, eventId) => {
    if (!eventId) return false;
    try {
      await axios.patch(`${EVENTS_API_URL}/${eventId}/`, buildEventRequestBody(payload));
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Не удалось обновить событие', err);
      return false;
    }
  }, [fetchEvents]);

  const deleteEvent = useCallback(async (eventItem) => {
    const confirmed = window.confirm(`Удалить событие "${eventItem.title}"?`);
    if (!confirmed) return false;
    try {
      await axios.delete(`${EVENTS_API_URL}/${eventItem.id}/`);
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Не удалось удалить событие', err);
      return false;
    }
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    filters,
    setFilters,
    selectedEvents,
    setSelectedEvents,
    fetchEvents,
    saveEvent,
    updateEvent,
    deleteEvent,
  };
}
