import { useCallback } from 'react';

/**
 * Управление массивом deployed_equipment в формах Target.
 * @param {Function} setFormData
 */
export function useDeployedEquipmentArray(setFormData) {
  const handleAddEquipmentWithId = useCallback((equipmentId, quantity = 1) => {
    setFormData((prev) => ({
      ...prev,
      deployed_equipment: [
        ...(prev.deployed_equipment || []),
        { equipment_id: equipmentId, quantity },
      ],
    }));
  }, [setFormData]);

  const handleRemoveEquipment = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      deployed_equipment: (prev.deployed_equipment || []).filter((_, i) => i !== index),
    }));
  }, [setFormData]);

  const handleEquipmentChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const next = [...(prev.deployed_equipment || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, deployed_equipment: next };
    });
  }, [setFormData]);

  return { handleAddEquipmentWithId, handleRemoveEquipment, handleEquipmentChange };
}
