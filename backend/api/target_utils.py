"""Утилиты для Target API: зоны техники, actions, сериализация."""

from formular.models import ActionType, TargetAction


def action_type_to_dict(action_type):
    if action_type is None:
        return None
    return {
        'id': action_type.id,
        'title': action_type.title,
        'color': action_type.color,
        'line_type': action_type.line_type,
    }


def serialize_deployed_equipment(target):
    """
    Техника на объекте и зоны из каталога ТТХ.
    Использует prefetch equipment_links → equipment → parameter_values.
    """
    items = []
    for link in target.equipment_links.all():
        equipment = link.equipment
        zones = []
        for pv in equipment.parameter_values.all():
            param = pv.parameter
            if not param.action_type_id or not pv.value or pv.value <= 0:
                continue
            zones.append({
                'parameter_title': param.title,
                'action_type': action_type_to_dict(param.action_type),
                'radius_km': pv.value,
            })
        items.append({
            'equipment': {
                'id': equipment.id,
                'title': equipment.title,
                'designation': equipment.designation,
            },
            'quantity': link.quantity,
            'zones': zones,
        })
    return items


def replace_target_actions(target, actions_data):
    """
    Атомарная замена TargetAction для объекта.
    actions_data: [{action_type_id, radius}, ...] или None — не менять.
    """
    if actions_data is None:
        return
    target.actions.all().delete()
    if not actions_data:
        return
    type_ids = [a['action_type_id'] for a in actions_data]
    types_by_id = ActionType.objects.in_bulk(type_ids)
    to_create = [
        TargetAction(
            target=target,
            action_type=types_by_id[action_data['action_type_id']],
            radius=action_data.get('radius'),
        )
        for action_data in actions_data
        if action_data.get('action_type_id') in types_by_id
    ]
    if to_create:
        TargetAction.objects.bulk_create(to_create)


def create_target_actions(target, actions_data):
    """Создание TargetAction при POST (без удаления существующих)."""
    if not actions_data:
        return
    type_ids = [a['action_type_id'] for a in actions_data]
    types_by_id = ActionType.objects.in_bulk(type_ids)
    to_create = [
        TargetAction(
            target=target,
            action_type=types_by_id[action_data['action_type_id']],
            radius=action_data.get('radius'),
        )
        for action_data in actions_data
        if action_data.get('action_type_id') in types_by_id
    ]
    if to_create:
        TargetAction.objects.bulk_create(to_create)
