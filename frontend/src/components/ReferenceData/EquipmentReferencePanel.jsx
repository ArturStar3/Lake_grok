import { useState } from 'react';
import EquipmentCatalogPanel from './EquipmentCatalogPanel';
import EquipmentCategoriesPanel from './EquipmentCategoriesPanel';
import EquipmentParametersPanel from './EquipmentParametersPanel';
import EquipmentUnitsPanel from './EquipmentUnitsPanel';
import './EquipmentReferencePanel.css';

const SUB_TABS = [
  { id: 'samples', label: 'Образцы' },
  { id: 'categories', label: 'Категории' },
  { id: 'parameters', label: 'Параметры ТТХ' },
  { id: 'units', label: 'Единицы измерения' },
];

export default function EquipmentReferencePanel({
  isActive,
  initialEquipmentId = null,
  schemaVersion = 0,
  onSchemaChanged,
}) {
  const [activeSubTab, setActiveSubTab] = useState('samples');

  return (
    <div className="equipment-reference-panel">
      <p className="equipment-reference-panel__hint">
        Рекомендуемый порядок: единицы и категории → параметры ТТХ → образцы техники.
      </p>

      <nav className="equipment-reference-panel__subtabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`equipment-reference-panel__subtab${
              activeSubTab === tab.id ? ' equipment-reference-panel__subtab--active' : ''
            }`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="equipment-reference-panel__content">
        {activeSubTab === 'samples' && (
          <EquipmentCatalogPanel
            isActive={isActive && activeSubTab === 'samples'}
            initialEquipmentId={initialEquipmentId}
            schemaVersion={schemaVersion}
          />
        )}
        {activeSubTab === 'categories' && (
          <EquipmentCategoriesPanel
            isActive={isActive && activeSubTab === 'categories'}
            onSchemaChanged={onSchemaChanged}
          />
        )}
        {activeSubTab === 'parameters' && (
          <EquipmentParametersPanel
            isActive={isActive && activeSubTab === 'parameters'}
            onSchemaChanged={onSchemaChanged}
            schemaVersion={schemaVersion}
          />
        )}
        {activeSubTab === 'units' && (
          <EquipmentUnitsPanel
            isActive={isActive && activeSubTab === 'units'}
            onSchemaChanged={onSchemaChanged}
          />
        )}
      </div>
    </div>
  );
}
