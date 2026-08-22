"""Тесты API сценариев демонстрации возможностей карты."""

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.enums import ModuleLevel
from accounts.models import SecurityGroup
from accounts.tests.base import (
    ADMIN_PASSWORD,
    TEST_PASSWORD,
    auth_header,
    create_admin_group,
    create_user,
)
from formular.models import DemoScenario


def build_step(**overrides):
    step = {
        'title': 'Обзор региона',
        'tool': 'camera',
        'duration_ms': 5000,
        'start_mode': 'after_previous',
        'hold_previous': False,
        'camera': {'mode': 'fly_to', 'lat': 55.75, 'lng': 37.61, 'zoom': 9, 'duration_ms': 2000},
        'selection': {},
        'animation': {'effect': 'none'},
    }
    step.update(overrides)
    return step


class DemoScenarioApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_group = create_admin_group(name='Demo Admins')
        create_user('demo_admin', password=ADMIN_PASSWORD, groups=[cls.admin_group])

        cls.viewer_group = SecurityGroup.objects.create(
            name='Demo Viewers',
            demo_scenarios=ModuleLevel.READ,
        )
        create_user('demo_viewer', password=TEST_PASSWORD, groups=[cls.viewer_group])

        cls.outsider_group = SecurityGroup.objects.create(name='Demo Outsiders')
        create_user('demo_outsider', password=TEST_PASSWORD, groups=[cls.outsider_group])

    def create_scenario(self, headers, **overrides):
        payload = {
            'title': 'Демонстрация возможностей',
            'description': 'Полный обзор',
            'is_default': True,
            'loop': True,
            'default_step_duration_ms': 6000,
            'steps': [
                build_step(),
                build_step(
                    title='Зоны действия',
                    tool='zones',
                    selection={
                        'zone_leaves': [
                            {'country': 'Тестовая страна', 'action_type_id': 3, 'leaf': 'manual'},
                        ],
                    },
                    animation={'effect': 'reveal_from_center', 'duration_ms': 1400, 'easing': 'ease_out'},
                ),
            ],
        }
        payload.update(overrides)
        return self.client.post('/api/v1/demo-scenarios/', payload, format='json', **headers)

    def test_create_with_nested_steps_normalizes_payload(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        steps = response.data['steps']
        self.assertEqual(len(steps), 2)
        self.assertEqual([step['order'] for step in steps], [0, 1])
        self.assertEqual(response.data['step_count'], 2)

        camera = steps[0]['camera']
        self.assertEqual(camera['mode'], 'fly_to')
        self.assertEqual(camera['zoom'], 9)
        self.assertEqual(camera['padding'], 72)

        zone_step = steps[1]
        self.assertEqual(zone_step['tool'], 'zones')
        self.assertEqual(zone_step['animation']['effect'], 'reveal_from_center')
        self.assertFalse(zone_step['animation']['continuous'])
        self.assertEqual(
            zone_step['selection']['zone_leaves'],
            [{'country': 'Тестовая страна', 'action_type_id': '3', 'leaf': 'manual'}],
        )
        self.assertEqual(zone_step['selection']['event_ids'], [])
        self.assertIn('state_cycle', zone_step['animation'])

    def test_update_replaces_steps_and_reindexes_order(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        created = self.create_scenario(headers)
        scenario_id = created.data['id']

        response = self.client.patch(
            f'/api/v1/demo-scenarios/{scenario_id}/',
            {
                'steps': [
                    build_step(title='События', tool='events', animation={'effect': 'blink', 'repeat': 0}),
                    build_step(title='Затопление', tool='inundation', animation={
                        'effect': 'directional_wipe',
                        'direction': 'bottom',
                    }),
                    build_step(title='Обстановка', tool='situations', animation={
                        'effect': 'state_cycle',
                        'state_cycle': {'per_state_ms': 1200, 'cross_fade_ms': 400},
                    }),
                ],
            },
            format='json',
            **headers,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        steps = response.data['steps']
        self.assertEqual([step['order'] for step in steps], [0, 1, 2])
        self.assertEqual([step['tool'] for step in steps], ['events', 'inundation', 'situations'])
        self.assertEqual(steps[1]['animation']['direction'], 'bottom')
        self.assertEqual(steps[2]['animation']['state_cycle']['per_state_ms'], 1200)
        self.assertTrue(steps[0]['animation']['continuous'])
        self.assertFalse(steps[1]['animation']['continuous'])
        self.assertTrue(steps[2]['animation']['continuous'])

    def test_formular_and_country_tools_normalize_selection(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[
                build_step(
                    title='Формуляр',
                    tool='formular',
                    selection={'target_ids': ['11', 11, '22']},
                ),
                build_step(
                    title='Страна',
                    tool='country',
                    selection={'country_isos': ['am', 'AM', 'kz']},
                ),
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        steps = response.data['steps']
        self.assertEqual([step['tool'] for step in steps], ['formular', 'country'])
        self.assertEqual(steps[0]['selection']['target_ids'], ['11', '22'])
        self.assertEqual(steps[1]['selection']['country_isos'], ['AM', 'KZ'])
        self.assertEqual(steps[0]['animation']['effect'], 'none')

        scenario_id = response.data['id']
        fetched = self.client.get(f'/api/v1/demo-scenarios/{scenario_id}/', **headers)
        self.assertEqual(fetched.status_code, status.HTTP_200_OK, fetched.data)
        self.assertEqual(fetched.data['steps'][1]['selection']['country_isos'], ['AM', 'KZ'])

        patched = self.client.patch(
            f'/api/v1/demo-scenarios/{scenario_id}/',
            {
                'steps': [
                    build_step(
                        title='Страна',
                        tool='country',
                        selection={'country_isos': ['ru', 'BY']},
                    ),
                    build_step(
                        title='Формуляр',
                        tool='formular',
                        selection={'target_ids': [33]},
                    ),
                ],
            },
            format='json',
            **headers,
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual([step['tool'] for step in patched.data['steps']], ['country', 'formular'])
        self.assertEqual(patched.data['steps'][0]['selection']['country_isos'], ['RU', 'BY'])
        self.assertEqual(patched.data['steps'][1]['selection']['target_ids'], ['33'])

    def test_continuous_flag_is_stored_explicitly(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[
                build_step(
                    title='События',
                    tool='events',
                    animation={'effect': 'blink', 'continuous': False, 'duration_ms': 900},
                ),
                build_step(
                    title='Затопление',
                    tool='inundation',
                    animation={'effect': 'directional_wipe', 'continuous': True},
                ),
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        steps = response.data['steps']
        self.assertFalse(steps[0]['animation']['continuous'])
        self.assertTrue(steps[1]['animation']['continuous'])

    def test_only_one_default_scenario_remains(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        first = self.create_scenario(headers)
        second = self.create_scenario(headers, title='Второй сценарий')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)

        self.assertFalse(DemoScenario.objects.get(pk=first.data['id']).is_default)
        self.assertTrue(DemoScenario.objects.get(pk=second.data['id']).is_default)

    def test_invalid_effect_is_replaced_by_default(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[build_step(animation={'effect': 'explode', 'duration_ms': -5})],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        animation = response.data['steps'][0]['animation']
        self.assertEqual(animation['effect'], 'none')
        self.assertEqual(animation['duration_ms'], 0)

    def test_step_duration_out_of_range_is_rejected(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(headers, steps=[build_step(duration_ms=10)])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_requires_write_delete(self):
        admin_headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        created = self.create_scenario(admin_headers)
        scenario_id = created.data['id']

        self.viewer_group.demo_scenarios = ModuleLevel.WRITE
        self.viewer_group.save(update_fields=['demo_scenarios'])
        writer_headers = auth_header(self.client, 'demo_viewer', TEST_PASSWORD)
        denied = self.client.delete(f'/api/v1/demo-scenarios/{scenario_id}/', **writer_headers)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        allowed = self.client.delete(f'/api/v1/demo-scenarios/{scenario_id}/', **admin_headers)
        self.assertEqual(allowed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DemoScenario.objects.filter(pk=scenario_id).exists())

    def test_read_only_user_cannot_write(self):
        admin_headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        self.create_scenario(admin_headers)

        viewer_headers = auth_header(self.client, 'demo_viewer', TEST_PASSWORD)
        list_resp = self.client.get('/api/v1/demo-scenarios/', **viewer_headers)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)

        write_resp = self.client.post(
            '/api/v1/demo-scenarios/',
            {'title': 'Нельзя'},
            format='json',
            **viewer_headers,
        )
        self.assertEqual(write_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_module_permission_required_for_read(self):
        headers = auth_header(self.client, 'demo_outsider', TEST_PASSWORD)
        response = self.client.get('/api/v1/demo-scenarios/', **headers)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
