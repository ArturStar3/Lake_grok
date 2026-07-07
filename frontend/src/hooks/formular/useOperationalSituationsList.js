import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL as API_ROOT } from '../../config/api';

const API_URL = `${API_ROOT}/api/v1/operational-situations/`;

const EMPTY_FILTERS = {
  title: '',
  dateFrom: '',
  dateTo: '',
  countries: [],
};

export function useOperationalSituationsList(activeTab, canRead = true) {
  const [situations, setSituations] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSituations, setSelectedSituations] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const fetchAbortRef = useRef(null);
  const fetchSeqRef = useRef(0);

  const buildParams = useCallback(() => {
    const params = {};
    if (filters.title?.trim()) params.title = filters.title.trim();
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.countries.length > 0) params.countries = filters.countries.join(',');
    return params;
  }, [filters]);

  const fetchSituations = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const params = buildParams();
      const [listResp, timelineResp] = await Promise.all([
        axios.get(API_URL, { params, signal: controller.signal }),
        axios.get(`${API_URL}timeline/`, { params, signal: controller.signal }),
      ]);
      if (seq !== fetchSeqRef.current) return;
      setSituations(Array.isArray(listResp.data) ? listResp.data : []);
      setTimeline(Array.isArray(timelineResp.data) ? timelineResp.data : []);
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') return;
      if (seq !== fetchSeqRef.current) return;
      console.error('Не удалось загрузить оперативную обстановку', err);
      if (err?.response?.status === 403) {
        setError('Нет доступа к модулю «Оперативная обстановка». Обратитесь к администратору.');
      } else {
        setError('Не удалось загрузить оперативную обстановку.');
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [buildParams]);

  const fetchRevisions = useCallback(async (situationId) => {
    if (!situationId) return [];
    const resp = await axios.get(`${API_URL}${situationId}/revisions/`);
    return Array.isArray(resp.data) ? resp.data : [];
  }, []);

  useEffect(() => {
    if (activeTab !== 'situations' || !canRead) return undefined;
    const timer = setTimeout(fetchSituations, 350);
    return () => {
      clearTimeout(timer);
      fetchAbortRef.current?.abort();
    };
  }, [activeTab, canRead, fetchSituations]);

  const createSituation = useCallback(async (payload) => {
    await axios.post(API_URL, payload);
    await fetchSituations();
  }, [fetchSituations]);

  const correctSituation = useCallback(async (situationId, payload) => {
    await axios.patch(`${API_URL}${situationId}/current/`, payload);
    await fetchSituations();
  }, [fetchSituations]);

  const createSituationRevision = useCallback(async (situationId, payload) => {
    await axios.post(`${API_URL}${situationId}/revisions/`, payload);
    await fetchSituations();
  }, [fetchSituations]);

  const forkSituation = useCallback(async (situationId, payload) => {
    const resp = await axios.post(`${API_URL}${situationId}/fork/`, payload);
    await fetchSituations();
    return resp.data;
  }, [fetchSituations]);

  const deleteSituation = useCallback(async (situation) => {
    const title = situation?.display_revision?.title
      || situation?.current_revision?.title
      || 'обстановку';
    const confirmed = window.confirm(`Удалить «${title}»?`);
    if (!confirmed) return false;
    try {
      await axios.delete(`${API_URL}${situation.id}/`);
      await fetchSituations();
      return true;
    } catch (err) {
      console.error('Не удалось удалить обстановку', err);
      return false;
    }
  }, [fetchSituations]);

  return {
    situations,
    timeline,
    loading,
    error,
    filters,
    setFilters,
    selectedSituations,
    setSelectedSituations,
    fetchSituations,
    fetchRevisions,
    createSituation,
    correctSituation,
    createSituationRevision,
    forkSituation,
    deleteSituation,
  };
}
