import { useCallback, useEffect, useState } from 'react';
import EquipmentReferencePanel from './EquipmentReferencePanel';
import ActionTypesPanel from './ActionTypesPanel';
import RelationTypesPanel from './RelationTypesPanel';
import TargetTypesPanel from './TargetTypesPanel';
import './ReferenceDataModal.css';

const TABS = [
  { id: 'equipment', label: 'Вооружение и техника' },
  { id: 'target-types', label: 'Типы объектов' },
  { id: 'action-types', label: 'Типы зон действия' },
  { id: 'relation-types', label: 'Характеры связей' },
];

export default function ReferenceDataModal({
  isOpen,
  onClose,
  onActionTypesChanged,
  onTargetTypesChanged,
  initialEquipmentId = null,
}) {
  const [activeTab, setActiveTab] = useState('equipment');
  const [schemaVersion, setSchemaVersion] = useState(0);

  const handleSchemaChanged = useCallback(() => {
    setSchemaVersion((v) => v + 1);
  }, []);

  const handleActionTypesChanged = useCallback(() => {
    onActionTypesChanged?.();
    setSchemaVersion((v) => v + 1);
  }, [onActionTypesChanged]);

  const handleTargetTypesChanged = useCallback(() => {
    onTargetTypesChanged?.();
  }, [onTargetTypesChanged]);

  useEffect(() => {
    if (isOpen && initialEquipmentId) {
      setActiveTab('equipment');
    }
  }, [isOpen, initialEquipmentId]);

  if (!isOpen) return null;

  return (
    <div className="reference-data-modal__overlay" onClick={onClose}>
      <div
        className="reference-data-modal__content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reference-data-modal-title"
      >
        <header className="reference-data-modal__header">
          <div>
            <h2 id="reference-data-modal-title">Справочники</h2>
          </div>
          <button
            type="button"
            className="reference-data-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <nav className="reference-data-modal__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`reference-data-modal__tab${
                activeTab === tab.id ? ' reference-data-modal__tab--active' : ''
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="reference-data-modal__body">
          {activeTab === 'equipment' && (
            <EquipmentReferencePanel
              isActive={isOpen && activeTab === 'equipment'}
              initialEquipmentId={initialEquipmentId}
              schemaVersion={schemaVersion}
              onSchemaChanged={handleSchemaChanged}
            />
          )}
          {activeTab === 'target-types' && (
            <TargetTypesPanel
              isActive={isOpen && activeTab === 'target-types'}
              onChanged={handleTargetTypesChanged}
            />
          )}
          {activeTab === 'action-types' && (
            <ActionTypesPanel
              isActive={isOpen && activeTab === 'action-types'}
              onChanged={handleActionTypesChanged}
            />
          )}
          {activeTab === 'relation-types' && (
            <RelationTypesPanel isActive={isOpen && activeTab === 'relation-types'} />
          )}
        </div>
      </div>
    </div>
  );
}
