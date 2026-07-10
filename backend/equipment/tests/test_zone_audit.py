"""Тесты диагностики зон из ТТХ техники."""

from django.test import TestCase

from accounts.tests.base import create_country
from api.target_utils import serialize_deployed_equipment
from equipment.models import (
    Equipment,
    EquipmentParameterDefinition,
    EquipmentParameterValue,
    UnitOfMeasure,
)
from equipment.services.zone_audit import (
    ISSUE_MISSING_ACTION_TYPE,
    ISSUE_POLYGON_ZONE_MODE,
    ISSUE_ZERO_VALUE,
    audit_equipment_zones,
    audit_parameter_values_without_zones,
    audit_parameters_missing_action_type,
    explain_zone_skip,
)
from formular.enums import ActionLineTypes, ZoneGeometryModes
from formular.models import ActionType, Target, TargetEquipment, TargetType


class ZoneAuditTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = create_country(iso_code='ZA1', title='Audit Country', title_short='AC')
        cls.target_type = TargetType.objects.create(title='База', order=1)
        cls.target_type.countries.add(cls.country)
        cls.target = Target.objects.create(
            title='Audit Object',
            label='A1',
            country=cls.country,
            type=cls.target_type,
            lat=50.0,
            lng=60.0,
        )
        cls.action_type_flat = ActionType.objects.create(
            title='ПВО',
            color='#e74c3c',
            line_type=ActionLineTypes.SOLID,
        )
        cls.action_type_polygon = ActionType.objects.create(
            title='Затопление',
            color='#3498db',
            line_type=ActionLineTypes.SOLID,
            zone_mode=ZoneGeometryModes.POLYGON,
            is_inundation_zone=True,
        )
        cls.unit_km = UnitOfMeasure.objects.create(title='Километр', symbol='км')
        cls.param_with_type = EquipmentParameterDefinition.objects.create(
            title='Радиус ПВО',
            code='pvo_radius',
            unit=cls.unit_km,
            action_type=cls.action_type_flat,
        )
        cls.param_no_type = EquipmentParameterDefinition.objects.create(
            title='Радиус без типа',
            code='no_action_type',
            unit=cls.unit_km,
        )
        cls.param_polygon = EquipmentParameterDefinition.objects.create(
            title='Полигон',
            code='polygon_radius',
            unit=cls.unit_km,
            action_type=cls.action_type_polygon,
        )
        cls.equipment = Equipment.objects.create(title='Су-34', designation='Су-34')
        EquipmentParameterValue.objects.create(
            equipment=cls.equipment,
            parameter=cls.param_with_type,
            value=80.0,
        )
        EquipmentParameterValue.objects.create(
            equipment=cls.equipment,
            parameter=cls.param_no_type,
            value=50.0,
        )
        EquipmentParameterValue.objects.create(
            equipment=cls.equipment,
            parameter=cls.param_polygon,
            value=30.0,
        )
        TargetEquipment.objects.create(
            target=cls.target,
            equipment=cls.equipment,
            quantity=1,
        )

    def test_explain_zone_skip_codes(self):
        self.assertIsNone(explain_zone_skip(self.param_with_type, 80))
        self.assertEqual(
            explain_zone_skip(self.param_no_type, 50),
            ISSUE_MISSING_ACTION_TYPE,
        )
        self.assertEqual(
            explain_zone_skip(self.param_polygon, 30),
            ISSUE_POLYGON_ZONE_MODE,
        )
        self.assertEqual(
            explain_zone_skip(self.param_with_type, 0),
            ISSUE_ZERO_VALUE,
        )

    def test_audit_lists_missing_action_type_on_target(self):
        rows = audit_equipment_zones(country_title='Audit Country')
        codes = {r.issue_code for r in rows}
        self.assertIn(ISSUE_MISSING_ACTION_TYPE, codes)
        self.assertIn(ISSUE_POLYGON_ZONE_MODE, codes)

    def test_audit_parameters_missing_action_type(self):
        params = audit_parameters_missing_action_type()
        self.assertEqual(len(params), 1)
        self.assertEqual(params[0].code, 'no_action_type')

    def test_audit_parameter_values_without_zones(self):
        values = audit_parameter_values_without_zones()
        self.assertEqual(len(values), 1)
        self.assertEqual(values[0].parameter.code, 'no_action_type')

    def test_serialize_includes_zone_issues(self):
        items = serialize_deployed_equipment(self.target)
        self.assertEqual(len(items), 1)
        issues = items[0]['zone_issues']
        codes = {i['code'] for i in issues}
        self.assertIn(ISSUE_MISSING_ACTION_TYPE, codes)
        self.assertIn(ISSUE_POLYGON_ZONE_MODE, codes)
        self.assertEqual(len(items[0]['zones']), 1)
        self.assertEqual(items[0]['zones'][0]['parameter_code'], 'pvo_radius')
