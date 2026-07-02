"""Зоны размещённой техники вычисляются из ТТХ каталога (EquipmentParameterValue)."""

from equipment.models import EquipmentParameterValue


def catalog_zone_values_for_equipment(equipment):
    return (
        EquipmentParameterValue.objects.filter(
            equipment=equipment,
            parameter__action_type__isnull=False,
            value__gt=0,
        )
        .select_related('parameter', 'parameter__action_type')
    )
