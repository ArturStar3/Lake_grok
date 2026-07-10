"""Диагностика причин, по которым зона из ТТХ техники не попадает в API/каталог."""

from __future__ import annotations

from dataclasses import dataclass

from formular.enums import ZoneGeometryModes
from formular.models import Target

from equipment.models import EquipmentParameterDefinition, EquipmentParameterValue

ISSUE_MISSING_ACTION_TYPE = 'missing_action_type'
ISSUE_ZERO_VALUE = 'zero_value'
ISSUE_POLYGON_ZONE_MODE = 'polygon_zone_mode'
ISSUE_NON_KM_UNIT = 'non_km_unit'

ISSUE_LABELS = {
    ISSUE_MISSING_ACTION_TYPE: 'Не указан тип зоны действия у параметра ТТХ',
    ISSUE_ZERO_VALUE: 'Значение параметра (радиус, км) не задано или равно 0',
    ISSUE_POLYGON_ZONE_MODE: 'Тип действия в режиме «Полигон» — зоны техники не строятся',
    ISSUE_NON_KM_UNIT: 'Единица измерения не «км» — параметр не может быть зоной',
}


def unit_is_km(param: EquipmentParameterDefinition) -> bool:
    unit = param.unit
    if not unit or not unit.symbol:
        return False
    return unit.symbol.lower() in ('км', 'km')


def explain_zone_skip(param: EquipmentParameterDefinition, value) -> str | None:
    """
    Причина, по которой значение ТТХ не сериализуется как зона.
    None — зона должна попасть в deployed_equipment.zones.
    """
    if not param.action_type_id:
        if value and value > 0 and unit_is_km(param):
            return ISSUE_MISSING_ACTION_TYPE
        return None

    if not unit_is_km(param):
        return ISSUE_NON_KM_UNIT

    if not value or value <= 0:
        return ISSUE_ZERO_VALUE

    if param.action_type.zone_mode == ZoneGeometryModes.POLYGON:
        return ISSUE_POLYGON_ZONE_MODE

    return None


def build_zone_issue(param: EquipmentParameterDefinition, value, issue_code: str) -> dict:
    return {
        'code': issue_code,
        'message': ISSUE_LABELS.get(issue_code, issue_code),
        'parameter_id': param.id,
        'parameter_code': param.code,
        'parameter_title': param.title,
        'value': value,
        'action_type_id': param.action_type_id,
        'action_type_title': param.action_type.title if param.action_type_id else None,
    }


def collect_zone_issues_for_equipment(equipment) -> list[dict]:
    issues = []
    for pv in equipment.parameter_values.select_related('parameter', 'parameter__unit', 'parameter__action_type'):
        issue_code = explain_zone_skip(pv.parameter, pv.value)
        if issue_code:
            issues.append(build_zone_issue(pv.parameter, pv.value, issue_code))
    return issues


@dataclass
class ZoneAuditRow:
    country_title: str
    target_id: str
    target_label: str
    equipment_id: int
    equipment_title: str
    issue_code: str
    parameter_id: int
    parameter_title: str
    parameter_code: str
    value: float | None
    action_type_title: str | None


def audit_equipment_zones(*, country_title: str | None = None) -> list[ZoneAuditRow]:
    """Полный аудит развёрнутой техники: где зоны не строятся и почему."""
    qs = (
        Target.objects.select_related('country')
        .prefetch_related(
            'equipment_links__equipment__parameter_values__parameter',
            'equipment_links__equipment__parameter_values__parameter__unit',
            'equipment_links__equipment__parameter_values__parameter__action_type',
        )
        .order_by('country__title', 'label')
    )
    if country_title:
        qs = qs.filter(country__title=country_title)

    rows: list[ZoneAuditRow] = []
    for target in qs:
        country = target.country.title if target.country_id else 'Неизвестно'
        for link in target.equipment_links.all():
            equipment = link.equipment
            for pv in equipment.parameter_values.all():
                issue_code = explain_zone_skip(pv.parameter, pv.value)
                if not issue_code:
                    continue
                if issue_code == ISSUE_NON_KM_UNIT and not pv.parameter.action_type_id:
                    continue
                rows.append(
                    ZoneAuditRow(
                        country_title=country,
                        target_id=str(target.pk),
                        target_label=target.label or target.title,
                        equipment_id=equipment.id,
                        equipment_title=equipment.designation or equipment.title,
                        issue_code=issue_code,
                        parameter_id=pv.parameter_id,
                        parameter_title=pv.parameter.title,
                        parameter_code=pv.parameter.code,
                        value=pv.value,
                        action_type_title=(
                            pv.parameter.action_type.title if pv.parameter.action_type_id else None
                        ),
                    )
                )
    return rows


def audit_parameters_missing_action_type() -> list[EquipmentParameterDefinition]:
    """Параметры с единицей «км», у которых не задан тип зоны."""
    return list(
        EquipmentParameterDefinition.objects.filter(
            action_type__isnull=True,
            unit__symbol__iregex=r'^(км|km)$',
        )
        .select_related('unit')
        .order_by('title')
    )


def audit_parameter_values_without_zones() -> list[EquipmentParameterValue]:
    """Значения ТТХ > 0 по параметрам без action_type (кандидаты на «потерянные» зоны)."""
    return list(
        EquipmentParameterValue.objects.filter(
            value__gt=0,
            parameter__action_type__isnull=True,
            parameter__unit__symbol__iregex=r'^(км|km)$',
        )
        .select_related('parameter', 'parameter__unit', 'equipment')
        .order_by('equipment__designation', 'parameter__title')
    )
