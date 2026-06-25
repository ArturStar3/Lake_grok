import { useState } from 'react';
import EquipmentCatalogPanel from './EquipmentCatalogPanel';
import ActionTypesPanel from './ActionTypesPanel';
import './ReferenceDataModal.css';

const TABS = [
  { id: 'equipment', label: 'Вооружение и техника' },
  { id: 'action-types', label: 'Типы зон действия' },
];

export default function ReferenceDataModal({ isOpen, onClose, onActionTypesChanged }) {
  const [activeTab, setActiveTab] = useState('equipment');

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
            <EquipmentCatalogPanel isActive={isOpen && activeTab === 'equipment'} />
          )}
          {activeTab === 'action-types' && (
            <ActionTypesPanel
              isActive={isOpen && activeTab === 'action-types'}
              onChanged={onActionTypesChanged}
            />
          )}
        </div>
      </div>
    </div>
  );
}
