
import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

/**
 * Хук для загрузки справочников (countries, markers, actionTypes) с SVG маркеров
 * @param {boolean} isOpen - Флаг открытия модального окна
 * @returns {Object} Состояние загрузки и данные справочников
 */
export const useTargetFormData = (isOpen) => {
  const [countries, setCountries] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [targetTypes, setTargetTypes] = useState([]);
  const [militaryBranches, setMilitaryBranches] = useState([]);
  const [targets, setTargets] = useState([]);  // для выбора parent
  const [markerSvgs, setMarkerSvgs] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    Promise.all([
      axios.get(`${API_URL}/api/v1/countries`),
      axios.get(`${API_URL}/api/v1/markers`),
      axios.get(`${API_URL}/api/v1/action-types`),
      axios.get(`${API_URL}/api/v1/target-types`),
      axios.get(`${API_URL}/api/v1/military-branches`),
      axios.get(`${API_URL}/api/v1/targets`)  // для выбора parent
    ])
      .then(([countriesRes, markersRes, actionTypesRes, targetTypesRes, branchesRes, targetsRes]) => {
        setCountries(countriesRes.data);
        setMarkers(markersRes.data);
        setActionTypes(actionTypesRes.data);
        setTargetTypes(targetTypesRes.data);
        setMilitaryBranches(branchesRes.data || []);
        setTargets(targetsRes.data || []);

        // Загружаем SVG для каждого маркера
        markersRes.data.forEach(async (marker) => {
          if (marker.path) {
            try {
              const res = await axios.get(marker.path, { responseType: 'text' });
              setMarkerSvgs(prev => new Map(prev).set(marker.id, res.data));
            } catch (err) {
              console.warn('Не удалось загрузить SVG маркера:', marker.path, err);
            }
          }
        });

        setLoading(false);
      })
      .catch(err => {
        console.error('Ошибка загрузки данных:', err);
        setError(err);
        setLoading(false);
      });
  }, [isOpen]);

  return { countries, markers, actionTypes, targetTypes, militaryBranches, targets, markerSvgs, loading, error };
};
