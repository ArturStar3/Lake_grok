"""Тесты сериализации зон из ТТХ размещённой техники."""

from django.test import TestCase

from accounts.tests.base import create_country
from api.target_utils import resolve_deployed_equipment_los_zone, serialize_deployed_equipment
from equipment.models import (
    Equipment,
    EquipmentParameterDefinition,
    EquipmentParameterValue,
    UnitOfMeasure,
)
from formular.enums import ActionLineTypes, ZoneGeometryModes
from formular.models import ActionType, Target, TargetEquipment, TargetType


class DeployedEquipmentZoneStyleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = create_country(iso_code='TZ1', title='Test Country', title_short='TZ')
        cls.target_type = TargetType.objects.create(title='База', order=1)
        cls.target_type.countries.add(cls.country)
        cls.target = Target.objects.create(
            title='Test Object',
            label='T1',
            country=cls.country,
            type=cls.target_type,
            lat=55.0,
            lng=37.0,
        )
        cls.action_type = ActionType.objects.create(
            title='Боевой радиус',
            color='#e74c3c',
            line_type=ActionLineTypes.SOLID,
        )
        cls.unit_km = UnitOfMeasure.objects.create(title='Километр', symbol='км')
        cls.param_default = EquipmentParameterDefinition.objects.create(
            title='Радиус без override',
            code='radius_default',
            unit=cls.unit_km,
            action_type=cls.action_type,
        )
        cls.param_override = EquipmentParameterDefinition.objects.create(
            title='Радиус с override',
            code='radius_override',
            unit=cls.unit_km,
            action_type=cls.action_type,
            zone_color='#00ff00',
            zone_line_type=ActionLineTypes.DASHED,
        )
        cls.equipment = Equipment.objects.create(
            title='Су-35',
            designation='Су-35',
        )
        EquipmentParameterValue.objects.create(
            equipment=cls.equipment,
            parameter=cls.param_default,
            value=100.0,
        )
        EquipmentParameterValue.objects.create(
            equipment=cls.equipment,
            parameter=cls.param_override,
            value=200.0,
        )
        TargetEquipment.objects.create(
            target=cls.target,
            equipment=cls.equipment,
            quantity=1,
        )

    def test_zone_includes_parameter_id_and_effective_style(self):
        items = serialize_deployed_equipment(self.target)
        self.assertEqual(len(items), 1)
        zones = items[0]['zones']
        self.assertEqual(len(zones), 2)

        by_code = {z['parameter_code']: z for z in zones}
        default_zone = by_code['radius_default']
        override_zone = by_code['radius_override']

        self.assertEqual(default_zone['parameter_id'], self.param_default.id)
        self.assertEqual(default_zone['parameter_title'], 'Радиус без override')
        self.assertEqual(default_zone['zone_color'], '#e74c3c')
        self.assertEqual(default_zone['zone_line_type'], ActionLineTypes.SOLID)

        self.assertEqual(override_zone['parameter_id'], self.param_override.id)
        self.assertEqual(override_zone['zone_color'], '#00ff00')
        self.assertEqual(override_zone['zone_line_type'], ActionLineTypes.DASHED)

    def test_resolve_los_zone_requires_los_radar_mode(self):
        with self.assertRaises(ValueError):
            resolve_deployed_equipment_los_zone(
                self.target,
                self.equipment.id,
                self.param_default.id,
            )

    def test_resolve_los_zone_for_radar_parameter(self):
        self.action_type.zone_mode = ZoneGeometryModes.LOS_RADAR
        self.action_type.min_elevation_deg = 0.5
        self.action_type.save(update_fields=['zone_mode', 'min_elevation_deg'])

        params = resolve_deployed_equipment_los_zone(
            self.target,
            self.equipment.id,
            self.param_default.id,
        )
        self.assertEqual(params['radius_km'], 100.0)
        self.assertEqual(params['min_elevation_deg'], 0.5)
