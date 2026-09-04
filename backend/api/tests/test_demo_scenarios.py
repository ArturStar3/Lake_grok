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
                    selection={'target_ids': ['11', 11, '22'], 'card_ids': ['section-12', 'equipment', 'section-12']},
                ),
                build_step(
                    title='Страна',
                    tool='country',
                    selection={'country_isos': ['am', 'AM', 'kz'], 'card_ids': ['formular-completion']},
                ),
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        steps = response.data['steps']
        self.assertEqual([step['tool'] for step in steps], ['formular', 'country'])
        self.assertEqual(steps[0]['selection']['target_ids'], ['11', '22'])
        self.assertEqual(steps[0]['selection']['card_ids'], ['section-12', 'equipment'])
        self.assertEqual(steps[1]['selection']['country_isos'], ['AM', 'KZ'])
        self.assertEqual(steps[1]['selection']['card_ids'], ['formular-completion'])
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

    def test_on_click_start_mode_is_accepted_and_is_the_default(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[
                build_step(title='Этап', start_mode='on_click'),
                build_step(title='Такт', start_mode='after_previous'),
                build_step(title='Параллельно', start_mode='with_previous'),
                {'title': 'Без указания режима', 'tool': 'camera', 'duration_ms': 5000},
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            [step['start_mode'] for step in response.data['steps']],
            ['on_click', 'after_previous', 'with_previous', 'on_click'],
        )

    def test_auto_advance_defaults_to_true_and_can_be_disabled(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        created = self.create_scenario(headers)
        self.assertTrue(created.data['auto_advance'])

        patched = self.client.patch(
            f'/api/v1/demo-scenarios/{created.data["id"]}/',
            {'auto_advance': False},
            format='json',
            **headers,
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertFalse(patched.data['auto_advance'])

    def test_text_tool_normalizes_style_and_transitions(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[
                build_step(
                    title='Заголовок',
                    tool='text',
                    text={
                        'content': 'Кавказский регион',
                        'anchor': 'geo',
                        'lat': 40.45,
                        'lng': 46.4,
                        'width': 520,
                        'style': {
                            'font_family': 'Roboto',
                            'font_size': 48,
                            'font_weight': 800,
                            'italic': True,
                            'underline': True,
                            'color': '#ffcc00',
                            'gradient': {'enabled': True, 'from': '#fff', 'to': 'rgba(0, 120, 255, 0.8)', 'angle': 45},
                            'stroke': {'enabled': True, 'color': '#0b1a2b', 'width': 4},
                        },
                        'enter': {'effect': 'slide', 'direction': 'bottom', 'duration_ms': 800},
                        'exit': {'effect': 'zoom', 'duration_ms': 300},
                    },
                ),
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        text = response.data['steps'][0]['text']

        self.assertEqual(text['content'], 'Кавказский регион')
        self.assertEqual(text['anchor'], 'geo')
        self.assertEqual(text['lat'], 40.45)
        self.assertEqual(text['width'], 520)
        self.assertEqual(text['style']['font_size'], 48)
        self.assertEqual(text['style']['font_weight'], 800)
        self.assertTrue(text['style']['italic'])
        self.assertTrue(text['style']['underline'])
        self.assertEqual(text['style']['color'], '#ffcc00')
        self.assertTrue(text['style']['gradient']['enabled'])
        self.assertEqual(text['style']['gradient']['to'], 'rgba(0, 120, 255, 0.8)')
        self.assertEqual(text['style']['stroke']['width'], 4.0)
        self.assertEqual(text['enter']['effect'], 'slide')
        self.assertEqual(text['enter']['direction'], 'bottom')
        self.assertEqual(text['exit']['effect'], 'zoom')
        # Блоки, которые клиент не прислал, заполняются значениями по умолчанию.
        self.assertIn('background', text['style'])
        self.assertIn('shadow', text['style'])

    def test_text_tool_rejects_unsafe_values(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[
                build_step(
                    title='Плохой текст',
                    tool='text',
                    text={
                        'content': 'x' * 5000,
                        'anchor': 'geo',
                        'lat': 500,
                        'lng': 46.4,
                        'style': {
                            'font_family': 'Comic Sans MS; background: url(javascript:alert(1))',
                            'font_size': 9000,
                            'color': 'red; position: fixed',
                            'opacity': 12,
                        },
                        'enter': {'effect': 'explode'},
                        'exit': {'effect': 'typewriter'},
                    },
                ),
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        text = response.data['steps'][0]['text']

        self.assertEqual(len(text['content']), 4000)
        # Некорректная широта делает геопривязку невозможной — падаем в экранную.
        self.assertEqual(text['anchor'], 'screen')
        self.assertIsNone(text['lat'])
        self.assertEqual(text['style']['font_family'], 'Roboto')
        self.assertEqual(text['style']['font_size'], 200)
        self.assertEqual(text['style']['color'], '#ffffff')
        self.assertEqual(text['style']['opacity'], 1.0)
        self.assertEqual(text['enter']['effect'], 'fade')
        # typewriter допустим только на входе.
        self.assertEqual(text['exit']['effect'], 'fade')

    def test_step_without_text_gets_empty_defaults(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        text = response.data['steps'][0]['text']
        self.assertEqual(text['content'], '')
        self.assertEqual(text['anchor'], 'screen')

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

    def test_sequence_mosaic_expand_and_expandable_slots(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = '11111111-1111-1111-1111-111111111111'
        preset_id = 'preset-test-expand'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Кавказ',
                'steps': [build_step(title='Камера')],
            }],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '2+3',
                    'expandable_slots': ['a', 'c'],
                    'screens': [
                        {'id': 'a', 'label': 'A', 'stage_id': stage_id},
                    ],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[
                {'type': 'mosaic', 'preset_id': preset_id, 'mosaic_action': 'show_grid'},
                {
                    'type': 'mosaic',
                    'preset_id': preset_id,
                    'mosaic_action': 'focus_slot',
                    'slot': 'a',
                },
                {'type': 'mosaic', 'preset_id': preset_id, 'mosaic_action': 'collapse'},
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        preset = response.data['mosaic']['presets'][0]
        self.assertEqual(preset['expandable_slots'], ['a', 'c'])
        self.assertEqual(
            [item['mosaic_action'] for item in response.data['sequence']],
            ['show_grid', 'expand', 'collapse'],
        )
        self.assertEqual(response.data['sequence'][1]['slot'], 'a')
        self.assertIsNone(response.data['sequence'][0]['slot'])
