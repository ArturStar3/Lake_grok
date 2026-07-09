import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownEditor from '../common/MarkdownEditor/MarkdownEditor';
import PolygonCoordinateEditor from '../common/PolygonCoordinateEditor/PolygonCoordinateEditor';
import CountriesMultiAutocomplete from '../common/CountriesMultiAutocomplete/CountriesMultiAutocomplete';
import { geoJsonPolygonToDrawPoints } from '../../utils/inundationZone';
import { drawPointsToEditable, editablePointsKey, drawPointsKey, parseLatLngPoints } from '../../utils/polygonDrawUtils';
import { getSituationDisplayRevision, getSituationRevision } from '../../utils/situationUtils';
import './OperationalSituation.css';

const SAVE_MODES = {
  create: { label: 'Создать', showModePicker: false },
  correction: { label: 'Сохранить исправление', showModePicker: false },
  new_state: { label: 'Зафиксировать новое состояние', showModePicker: false },
  fork: { label: 'Создать на основе', showModePicker: false },
  edit: { label: 'Сохранить', showModePicker: true },
};

export default function SituationModal({
  isOpen,
  onClose,
  mode = 'create',
  situation = null,
  baseRevision = null,
  drawPoints = [],
  onDrawPointsChange,
  countries = [],
  onSave,
}) {
  // Приоритет: явно переданная ревизия таймлайна → current → display.
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
  const [polygonEditable, setPolygonEditable] = useState([]);
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
    setSaveMode(mode === 'fork' ? 'fork' : mode === 'new_state' ? 'new_state' : 'edit');
  }, [isOpen, mode, situation, rev]);

  const drawPointsKeyValue = drawPointsKey(drawPoints);

  useEffect(() => {
    if (!isOpen) return;
    if (skipPolygonSyncRef.current) {
      skipPolygonSyncRef.current = false;
      return;
    }
    const sourcePoints = drawPoints.length > 0
      ? drawPoints
      : geoJsonPolygonToDrawPoints(rev?.geometry);
    const next = drawPointsToEditable(sourcePoints);
    const nextKey = editablePointsKey(next);
    setPolygonEditable((prev) => (editablePointsKey(prev) === nextKey ? prev : next));
  }, [isOpen, drawPointsKeyValue, drawPoints, rev]);

  const handlePolygonChange = (editable) => {
    setPolygonEditable(editable);
    if (!onDrawPointsChange) return;
    skipPolygonSyncRef.current = true;
    onDrawPointsChange(parseLatLngPoints(editable) || []);
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
    const points = parseLatLngPoints(polygonEditable, { minCount: 3 });
    if (!points) return;
    const effectiveMode = mode === 'edit' ? saveMode : mode;
    try {
      await onSave?.({
        mode: effectiveMode,
        form,
        drawPoints: points,
        situationId: situation?.id,
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
            <PolygonCoordinateEditor
              points={polygonEditable}
              onChange={handlePolygonChange}
              hint="Задайте контур вручную или измените его на карте"
            />
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
