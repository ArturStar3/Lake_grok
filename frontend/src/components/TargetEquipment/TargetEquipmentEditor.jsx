import { useMemo, useState } from 'react';
import EquipmentAutocomplete from './EquipmentAutocomplete';
import { formatEquipmentLabel, formatEquipmentSubtitle } from '../../utils/equipmentCatalogUtils';
import './TargetEquipmentEditor.css';

export default function TargetEquipmentEditor({
  deployedEquipment = [],
  catalog = [],
  errors = {},
  onAddEquipment,
  onRemove,
  onChange,
}) {
  const [draftEquipmentId, setDraftEquipmentId] = useState('');
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [addError, setAddError] = useState('');

  const usedIds = useMemo(
    () =>
      new Set(
        deployedEquipment
          .map((row) => parseInt(row.equipment_id, 10))
          .filter((id) => Number.isFinite(id)),
      ),
    [deployedEquipment],
  );

  const handleAddSubmit = () => {
    const equipmentId = parseInt(draftEquipmentId, 10);
    if (!equipmentId) {
      setAddError('Выберите образец из результатов поиска');
      return;
    }
    if (usedIds.has(equipmentId)) {
      setAddError('Этот образец уже добавлен на объект');
      return;
    }
    const quantity = parseInt(draftQuantity, 10);
    if (!quantity || quantity < 1) {
      setAddError('Укажите количество не меньше 1');
      return;
    }
    onAddEquipment(equipmentId, quantity);
    setDraftEquipmentId('');
    setDraftQuantity(1);
    setAddError('');
  };

  return (
    <div className="target-equipment-editor">
      <label className="target-equipment-editor__label">Вооружение и техника</label>

      <div className="target-equipment-editor__add-form">
        <p className="target-equipment-editor__add-hint">
          Найдите образец в каталоге и добавьте на объект. Поиск по обозначению, названию и категории.
        </p>
        <div className="target-equipment-editor__add-fields">
          <div className="target-equipment-editor__add-search">
            <label className="target-equipment-editor__field-label">Образец техники</label>
            <EquipmentAutocomplete
              catalog={catalog}
              value={draftEquipmentId}
              onChange={(id) => {
                setDraftEquipmentId(id);
                setAddError('');
              }}
              excludeIds={[...usedIds]}
              clearOnSelect
              placeholder="Начните вводить Су-35, Т-90, С-400…"
              error={addError}
            />
          </div>
          <div className="target-equipment-editor__add-qty">
            <label className="target-equipment-editor__field-label">Количество</label>
            <input
              type="number"
              min="1"
              step="1"
              value={draftQuantity}
              onChange={(e) => setDraftQuantity(e.target.value)}
              className="target-equipment-editor__input"
            />
          </div>
          <div className="target-equipment-editor__add-action">
            <button
              type="button"
              className="target-equipment-editor__add-submit"
              onClick={handleAddSubmit}
            >
              Добавить
            </button>
          </div>
        </div>
      </div>

      {deployedEquipment.length === 0 ? (
        <p className="target-equipment-editor__empty">На объекте пока нет техники</p>
      ) : (
        <div className="target-equipment-editor__list">
          <div className="target-equipment-editor__list-title">
            На объекте ({deployedEquipment.length})
          </div>
          {deployedEquipment.map((row, index) => {
            const rowId = parseInt(row.equipment_id, 10);
            const selected = catalog.find((item) => item.id === rowId);

            return (
              <div key={`${rowId}-${index}`} className="target-equipment-editor__row">
                <div className="target-equipment-editor__row-main">
                  <div className="target-equipment-editor__identity">
                    <strong className="target-equipment-editor__name">
                      {selected ? formatEquipmentLabel(selected) : 'Неизвестный образец'}
                    </strong>
                    {selected && formatEquipmentSubtitle(selected) && (
                      <span className="target-equipment-editor__category">
                        {formatEquipmentSubtitle(selected)}
                      </span>
                    )}
                  </div>

                  <div className="target-equipment-editor__field target-equipment-editor__field--qty">
                    <label className="target-equipment-editor__field-label">Кол-во</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => onChange(index, 'quantity', e.target.value)}
                      className={`target-equipment-editor__input${
                        errors[`equipment_${index}_qty`] ? ' target-equipment-editor__input--error' : ''
                      }`}
                    />
                    {errors[`equipment_${index}_qty`] && (
                      <span className="target-equipment-editor__error">
                        {errors[`equipment_${index}_qty`]}
                      </span>
                    )}
                  </div>
                </div>

                {selected?.parameter_values?.length > 0 && (
                  <ul className="target-equipment-editor__specs">
                    {selected.parameter_values.map((pv) => (
                      <li key={pv.id}>
                        {pv.parameter?.title}: {pv.value}
                        {pv.parameter?.unit?.symbol ? ` ${pv.parameter.unit.symbol}` : ''}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  className="target-equipment-editor__remove"
                  onClick={() => onRemove(index)}
                  aria-label="Удалить образец"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
