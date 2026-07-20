import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownEditor from '../common/MarkdownEditor/MarkdownEditor';
import PolygonCoordinateEditor from '../common/PolygonCoordinateEditor/PolygonCoordinateEditor';
import CountriesMultiAutocomplete from '../common/CountriesMultiAutocomplete/CountriesMultiAutocomplete';
import { geoJsonToDrawPolygons } from '../../utils/inundationZone';
import { drawPointsToEditable, editablePointsKey, parseLatLngPoints } from '../../utils/polygonDrawUtils';
import { formatSituationDateTime, getSituationDisplayRevision, getSituationRevision, isSituationCurrentRevision } from '../../utils/situationUtils';
import './OperationalSituation.css';

const SAVE_MODES = {
  create: { label: 'Создать', showModePicker: false },
  correction: { label: 'Сохранить исправление', showModePicker: false },
  new_state: { label: 'Зафиксировать новое состояние', showModePicker: false },
  fork: { label: 'Создать на основе', showModePicker: false },
  edit: { label: 'Сохранить', showModePicker: true },
};

function drawPolygonsKey(polygons) {
  if (!polygons?.length) return '';
  return polygons.map((ring) => editablePointsKey(drawPointsToEditable(ring))).join('|');
}

export default function SituationModal({
  isOpen,
  onClose,
  mode = 'create',
  situation = null,
  baseRevision = null,
  drawPolygons = [],
  onDrawPolygonsChange,
  activeTerritoryIndex = 0,
  onActiveTerritoryIndexChange,
  countries = [],
  onSave,
}) {
  const rev = baseRevision || getSituationRevision(situation) || getSituationDisplayRevision(situation);
  const [form, setForm] = useState({
    title: '',
    description: '',
    situationDate: '',
    situationTime: '',
    color: '#2f80ed',
    countryIds: [],
    changeNote: '',
  });
  const [saveError, setSaveError] = useState('');
  const [saveMode, setSaveMode] = useState('correction');
  const [polygonEditables, setPolygonEditables] = useState([]);
  const skipPolygonSyncRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setSaveError('');
    if (mode === 'create') {
      setForm({
        title: '',
        description: '',
        situationDate: '',
        situationTime: '',
        color: '#2f80ed',
        countryIds: [],
        changeNote: '',
      });
      setSaveMode('create');
      return;
    }
    setForm({
      title: rev?.title || '',
      description: rev?.description || '',
      situationDate: rev?.situation_date || '',
      situationTime: rev?.situation_time ? String(rev.situation_time).slice(0, 5) : '',
      color: rev?.color || '#2f80ed',
      countryIds: rev?.countries?.map((c) => c.id) || [],
      changeNote: '',
    });
    setSaveMode(mode === 'fork' ? 'fork' : mode === 'new_state' ? 'new_state' : 'correction');
  }, [isOpen, mode, situation, rev]);

  const drawPolygonsKeyValue = drawPolygonsKey(drawPolygons);

  useEffect(() => {
    if (!isOpen) return;
    if (skipPolygonSyncRef.current) {
      skipPolygonSyncRef.current = false;
      return;
    }
    const sourcePolygons = drawPolygons.length > 0
      ? drawPolygons
      : geoJsonToDrawPolygons(rev?.geometry);
    const next = sourcePolygons.map((ring) => drawPointsToEditable(ring));
    const nextKey = drawPolygonsKey(sourcePolygons);
    setPolygonEditables((prev) => {
      const prevPolys = prev.map((editable) => parseLatLngPoints(editable) || []);
      if (drawPolygonsKey(prevPolys) === nextKey) return prev;
      return next;
    });
  }, [isOpen, drawPolygonsKeyValue, drawPolygons, rev]);

  const syncDrawPolygons = (editables) => {
    if (!onDrawPolygonsChange) return;
    skipPolygonSyncRef.current = true;
    const polys = editables.map((editable) => parseLatLngPoints(editable) || []).filter((ring) => ring.length >= 3);
    onDrawPolygonsChange(polys);
  };

  const handlePolygonChange = (index, editable) => {
    setPolygonEditables((prev) => {
      const next = [...prev];
      next[index] = editable;
      syncDrawPolygons(next);
      return next;
    });
  };

  const handleAddTerritory = () => {
    const newIndex = polygonEditables.length;
    setPolygonEditables((prev) => [...prev, drawPointsToEditable([])]);
    onActiveTerritoryIndexChange?.(newIndex);
  };

  const handleRemoveTerritory = (index) => {
    setPolygonEditables((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, idx) => idx !== index);
      syncDrawPolygons(next);
      let nextActive = activeTerritoryIndex;
      if (index === activeTerritoryIndex) {
        nextActive = Math.max(0, Math.min(index, next.length - 1));
      } else if (index < activeTerritoryIndex) {
        nextActive = activeTerritoryIndex - 1;
      }
      onActiveTerritoryIndexChange?.(nextActive);
      return next;
    });
  };

  const handleSelectTerritoryOnMap = (index) => {
    onActiveTerritoryIndexChange?.(index);
  };

  const countryOptions = useMemo(
    () => [...countries].sort((a, b) => a.title.localeCompare(b.title)),
    [countries],
  );

  const handleCountryChange = (countryIds) => {
    setForm((prev) => ({ ...prev, countryIds }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const polys = polygonEditables
      .map((editable) => parseLatLngPoints(editable, { minCount: 3 }))
      .filter(Boolean);
    if (!polys.length) return;
    const effectiveMode = mode === 'edit' ? saveMode : mode;
    try {
      await onSave?.({
        mode: effectiveMode,
        form,
        drawPolygons: polys,
        situationId: situation?.id,
        revisionId: rev?.id ?? null,
      });
      onClose();
    } catch (err) {
      const message = err?.response?.data
        ? JSON.stringify(err.response.data)
        : 'Не удалось сохранить обстановку.';
      setSaveError(message);
    }
  };

  if (!isOpen) return null;

  const modeConfig = SAVE_MODES[mode] || SAVE_MODES.edit;
  const isHistoricalRevision = Boolean(
    situation
    && rev
    && !isSituationCurrentRevision(situation, rev),
  );
  const titleMap = {
    create: 'Новая оперативная обстановка',
    edit: 'Редактирование обстановки',
    correction: 'Исправление обстановки',
    new_state: 'Новое состояние',
    fork: 'Создать на основе',
  };

  return (
    <div className="situation-modal__overlay situation-modal__overlay--floating">
      <div className="situation-modal">
        <div className="situation-modal__header">
          <h2>{titleMap[mode] || titleMap.edit}</h2>
          <button type="button" className="situation-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="situation-modal__form" onSubmit={handleSubmit}>
          {isHistoricalRevision && mode === 'edit' && saveMode === 'correction' && (
            <p className="situation-modal__hint">
              Исправление записи v{rev.version} в таймлайне
              {rev.situation_date ? ` (${formatSituationDateTime(rev)})` : ''}.
              Текущая версия серии — v{situation.current_revision?.version || '—'}.
            </p>
          )}
          <label className="situation-modal__field">
            <span>Название</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </label>
          <div className="situation-modal__field-row">
            <label className="situation-modal__field">
              <span>Дата обстановки</span>
              <input
                type="date"
                value={form.situationDate}
                onChange={(e) => setForm((prev) => ({ ...prev, situationDate: e.target.value }))}
              />
            </label>
            <label className="situation-modal__field">
              <span>Время обстановки</span>
              <input
                type="time"
                value={form.situationTime}
                onChange={(e) => setForm((prev) => ({ ...prev, situationTime: e.target.value }))}
              />
            </label>
          </div>
          <label className="situation-modal__field">
            <span>Цвет</span>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
            />
          </label>
          <div className="situation-modal__field">
            <span>Затронутые страны</span>
            <CountriesMultiAutocomplete
              countries={countryOptions}
              value={form.countryIds}
              onChange={handleCountryChange}
              placeholder="Начните вводить название страны"
            />
          </div>
          <label className="situation-modal__field">
            <span>Описание</span>
            <MarkdownEditor
              value={form.description}
              onChange={(val) => setForm((prev) => ({ ...prev, description: val }))}
              rows={4}
            />
          </label>
          <div className="situation-modal__field">
            <div className="situation-modal__territories-header">
              <span>Территории</span>
              <button
                type="button"
                className="situation-modal__btn situation-modal__btn--ghost"
                onClick={handleAddTerritory}
              >
                Добавить территорию
              </button>
            </div>
            {polygonEditables.map((editable, index) => (
              <div
                key={`territory-${index}`}
                className={`situation-modal__territory${
                  index === activeTerritoryIndex ? ' situation-modal__territory--active' : ''
                }`}
              >
                <div className="situation-modal__territory-header">
                  <span>Территория {index + 1}</span>
                  <div className="situation-modal__territory-actions">
                    <button
                      type="button"
                      className={`situation-modal__btn situation-modal__btn--ghost${
                        index === activeTerritoryIndex
                          ? ' situation-modal__btn--map-active'
                          : ''
                      }`}
                      onClick={() => handleSelectTerritoryOnMap(index)}
                    >
                      {index === activeTerritoryIndex ? 'На карте' : 'Редактировать на карте'}
                    </button>
                    {polygonEditables.length > 1 && (
                      <button
                        type="button"
                        className="situation-modal__btn situation-modal__btn--ghost"
                        onClick={() => handleRemoveTerritory(index)}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
                <PolygonCoordinateEditor
                  points={editable}
                  onChange={(next) => handlePolygonChange(index, next)}
                  hint={
                    index === activeTerritoryIndex
                      ? 'Задайте контур вручную или измените его на карте'
                      : 'Нажмите «Редактировать на карте», чтобы менять контур на карте'
                  }
                />
              </div>
            ))}
          </div>
          {modeConfig.showModePicker && (
            <div className="situation-modal__save-modes">
              <label>
                <input
                  type="radio"
                  name="saveMode"
                  value="correction"
                  checked={saveMode === 'correction'}
                  onChange={() => setSaveMode('correction')}
                />
                Сохранить исправление (без новой версии)
              </label>
              <label>
                <input
                  type="radio"
                  name="saveMode"
                  value="new_state"
                  checked={saveMode === 'new_state'}
                  onChange={() => setSaveMode('new_state')}
                />
                Зафиксировать новое состояние
              </label>
            </div>
          )}
          {(mode === 'new_state' || mode === 'fork' || (mode === 'edit' && saveMode === 'new_state')) && (
            <label className="situation-modal__field">
              <span>Комментарий к изменению</span>
              <input
                type="text"
                value={form.changeNote}
                onChange={(e) => setForm((prev) => ({ ...prev, changeNote: e.target.value }))}
              />
            </label>
          )}
          <div className="situation-modal__footer">
            {saveError && <p className="situation-modal__error">{saveError}</p>}
            <button type="button" className="situation-modal__btn situation-modal__btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="situation-modal__btn situation-modal__btn--primary">
              {mode === 'edit' ? (saveMode === 'new_state' ? 'Зафиксировать' : 'Сохранить исправление') : modeConfig.label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
