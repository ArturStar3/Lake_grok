"""Утилиты для API каталога техники."""

from equipment.models import EquipmentParameterDefinition, EquipmentParameterValue


def replace_equipment_parameter_values(equipment, values_data):
    """
    Атомарная замена значений ТТХ образца.
    values_data: [{parameter_id, value}, ...] или None — не менять.
    """
    if values_data is None:
        return
    equipment.parameter_values.all().delete()
    if not values_data:
        return
    param_ids = [row['parameter_id'] for row in values_data]
    params_by_id = EquipmentParameterDefinition.objects.in_bulk(param_ids)
    to_create = [
        EquipmentParameterValue(
            equipment=equipment,
            parameter=params_by_id[row['parameter_id']],
            value=row['value'],
        )
        for row in values_data
        if row.get('parameter_id') in params_by_id
    ]
    if to_create:
        EquipmentParameterValue.objects.bulk_create(to_create)
