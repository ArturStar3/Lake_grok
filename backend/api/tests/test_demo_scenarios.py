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
                    build_step(title='Наложение обстановки', tool='situations', animation={
                        'effect': 'state_overlay',
                        'continuous': False,
                        'state_cycle': {
                            'per_state_ms': 1500,
                            'cross_fade_ms': 500,
                            'order': 'new_to_old',
                        },
                    }),
                ],
            },
            format='json',
            **headers,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        steps = response.data['steps']
        self.assertEqual([step['order'] for step in steps], [0, 1, 2, 3])
        self.assertEqual([step['tool'] for step in steps], ['events', 'inundation', 'situations', 'situations'])
        self.assertEqual(steps[1]['animation']['direction'], 'bottom')
        self.assertEqual(steps[2]['animation']['state_cycle']['per_state_ms'], 1200)
        self.assertTrue(steps[0]['animation']['continuous'])
        self.assertFalse(steps[1]['animation']['continuous'])
        self.assertTrue(steps[2]['animation']['continuous'])
        self.assertEqual(steps[3]['animation']['effect'], 'state_overlay')
        self.assertFalse(steps[3]['animation']['continuous'])
        self.assertEqual(steps[3]['animation']['state_cycle'], {
            'per_state_ms': 1500,
            'cross_fade_ms': 500,
            'order': 'new_to_old',
        })

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

    def test_animation_playback_mode_and_repeat_are_stored_explicitly(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        response = self.create_scenario(
            headers,
            steps=[
                build_step(
                    title='События',
                    tool='events',
                    animation={'effect': 'blink', 'continuous': False, 'repeat': 3, 'duration_ms': 900},
                ),
                build_step(
                    title='Затопление',
                    tool='inundation',
                    animation={'effect': 'directional_wipe', 'continuous': True},
                ),
                build_step(
                    title='Объекты',
                    tool='objects',
                    animation={'effect': 'glow', 'continuous': False, 'repeat': 4},
                ),
                build_step(
                    title='Зоны действия',
                    tool='zones',
                    animation={'effect': 'reveal_from_center', 'continuous': False, 'repeat': 2},
                ),
                build_step(
                    title='Оперативная обстановка',
                    tool='situations',
                    animation={'effect': 'state_cycle', 'continuous': False, 'repeat': 5},
                ),
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        steps = response.data['steps']
        self.assertFalse(steps[0]['animation']['continuous'])
        self.assertEqual(steps[0]['animation']['repeat'], 3)
        self.assertTrue(steps[1]['animation']['continuous'])
        self.assertFalse(steps[2]['animation']['continuous'])
        self.assertEqual(steps[2]['animation']['repeat'], 4)
        self.assertEqual(steps[3]['animation']['repeat'], 2)
        self.assertEqual(steps[4]['animation']['repeat'], 5)

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

    def test_mosaic_expand_animation_round_trip(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = '22222222-2222-2222-2222-222222222222'
        preset_id = 'preset-center-stretch'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Титул',
                'steps': [build_step(title='Камера')],
            }],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '2x2',
                    'transition_ms': 800,
                    'expand_animation': 'center_then_stretch',
                    'expand_ms': 1200,
                    'collapse_ms': 900,
                    'expand_easing': 'ease_in_out',
                    'collapse_easing': 'linear',
                    'expandable_slots': ['a'],
                    'screens': [
                        {'id': 'a', 'label': 'A', 'stage_id': stage_id},
                    ],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[
                {
                    'type': 'mosaic',
                    'preset_id': preset_id,
                    'mosaic_action': 'expand',
                    'slot': 'a',
                    'expand_animation': 'stretch',
                    'expand_ms': 500,
                    'expand_easing': 'linear',
                },
                {
                    'type': 'mosaic',
                    'preset_id': preset_id,
                    'mosaic_action': 'collapse',
                    'collapse_ms': 400,
                    'collapse_easing': 'ease_out',
                },
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        preset = response.data['mosaic']['presets'][0]
        self.assertEqual(preset['expand_animation'], 'center_then_stretch')
        self.assertEqual(preset['expand_ms'], 1200)
        self.assertEqual(preset['collapse_ms'], 900)
        self.assertEqual(preset['expand_easing'], 'ease_in_out')
        self.assertEqual(preset['collapse_easing'], 'linear')
        expand_item = response.data['sequence'][0]
        collapse_item = response.data['sequence'][1]
        self.assertEqual(expand_item['expand_animation'], 'stretch')
        self.assertEqual(expand_item['expand_ms'], 500)
        self.assertEqual(expand_item['expand_easing'], 'linear')
        self.assertIsNone(expand_item.get('collapse_ms'))
        self.assertIsNone(expand_item.get('collapse_easing'))
        self.assertEqual(collapse_item['collapse_ms'], 400)
        self.assertEqual(collapse_item['collapse_easing'], 'ease_out')
        self.assertIsNone(collapse_item.get('expand_animation'))
        self.assertIsNone(collapse_item.get('expand_ms'))
        self.assertIsNone(collapse_item.get('expand_easing'))

    def test_mosaic_expand_stage_id_round_trip(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        grid_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        expand_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        preset_id = 'preset-expand-stage'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[
                {'id': grid_id, 'title': 'Сетка', 'steps': [build_step(title='Камера')]},
                {'id': expand_id, 'title': 'Разворот', 'steps': [build_step(title='Зоны', tool='zones')]},
            ],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '2x2',
                    'expandable_slots': ['a'],
                    'screens': [{
                        'id': 'a',
                        'label': 'A',
                        'stage_id': grid_id,
                        'expand_stage_id': expand_id,
                    }],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[
                {'type': 'mosaic', 'preset_id': preset_id, 'mosaic_action': 'show_grid'},
                {
                    'type': 'mosaic',
                    'preset_id': preset_id,
                    'mosaic_action': 'expand',
                    'slot': 'a',
                },
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        screen = response.data['mosaic']['presets'][0]['screens'][0]
        self.assertEqual(screen['stage_id'], grid_id)
        self.assertEqual(screen['expand_stage_id'], expand_id)

    def test_mosaic_expand_stage_id_unknown_dropped(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        grid_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
        preset_id = 'preset-expand-unknown'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': grid_id,
                'title': 'Сетка',
                'steps': [build_step(title='Камера')],
            }],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '2x2',
                    'screens': [{
                        'id': 'a',
                        'label': 'A',
                        'stage_id': grid_id,
                        'expand_stage_id': '99999999-9999-9999-9999-999999999999',
                    }],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'mosaic', 'preset_id': preset_id}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        screen = response.data['mosaic']['presets'][0]['screens'][0]
        self.assertEqual(screen['stage_id'], grid_id)
        self.assertIsNone(screen['expand_stage_id'])

    def test_mosaic_expand_stage_id_same_as_grid_is_null(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
        preset_id = 'preset-expand-same'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Один этап',
                'steps': [build_step(title='Камера')],
            }],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '2x2',
                    'screens': [{
                        'id': 'a',
                        'label': 'A',
                        'stage_id': stage_id,
                        'expand_stage_id': stage_id,
                    }],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'mosaic', 'preset_id': preset_id}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        screen = response.data['mosaic']['presets'][0]['screens'][0]
        self.assertEqual(screen['stage_id'], stage_id)
        self.assertIsNone(screen['expand_stage_id'])

    def test_mosaic_expand_stage_id_remaps_local_ids(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        preset_id = 'preset-expand-remap'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[
                {'id': 'local-grid', 'title': 'Сетка', 'steps': [build_step(title='Камера')]},
                {'id': 'local-expand', 'title': 'Разворот', 'steps': [build_step(title='Зоны', tool='zones')]},
            ],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '2x2',
                    'screens': [{
                        'id': 'a',
                        'label': 'A',
                        'stage_id': 'local-grid',
                        'expand_stage_id': 'local-expand',
                    }],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'mosaic', 'preset_id': preset_id}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        titles = {stage['title']: str(stage['id']) for stage in response.data['stages']}
        screen = response.data['mosaic']['presets'][0]['screens'][0]
        self.assertEqual(screen['stage_id'], titles['Сетка'])
        self.assertEqual(screen['expand_stage_id'], titles['Разворот'])
        self.assertNotEqual(screen['stage_id'], 'local-grid')
        self.assertNotEqual(screen['expand_stage_id'], 'local-expand')

    def test_stage_and_mosaic_cue_round_trip(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
        preset_id = 'preset-cue'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Брифинг',
                'cue': 7,
                'steps': [build_step(title='Камера')],
            }],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '1x3',
                    'screens': [
                        {'id': 'a', 'label': 'A', 'stage_id': stage_id, 'cue': 1},
                        {'id': 'b', 'label': 'B', 'cue': 2},
                        {'id': 'c', 'label': 'C'},
                    ],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'stage', 'stage_id': stage_id}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['stages'][0]['cue'], 7)
        screens = {item['id']: item for item in response.data['mosaic']['presets'][0]['screens']}
        self.assertEqual(screens['a']['cue'], 1)
        self.assertEqual(screens['b']['cue'], 2)
        self.assertIsNone(screens['c']['cue'])

        patched = self.client.patch(
            f'/api/v1/demo-scenarios/{response.data["id"]}/',
            {
                'mosaic': {
                    'presets': [{
                        'id': preset_id,
                        'title': 'Сетка',
                        'layout': '1x3',
                        'screens': [
                            {'id': 'a', 'label': 'A', 'stage_id': stage_id, 'cue': 3},
                            {'id': 'b', 'label': 'B', 'cue': 4},
                            {'id': 'c', 'label': 'C'},
                        ],
                    }],
                    'active_preset_id': preset_id,
                },
            },
            format='json',
            **headers,
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data['stages'][0]['cue'], 7)
        patched_screens = {item['id']: item for item in patched.data['mosaic']['presets'][0]['screens']}
        self.assertEqual(patched_screens['a']['cue'], 3)
        self.assertEqual(patched_screens['b']['cue'], 4)

    def test_invalid_cue_is_dropped(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
        preset_id = 'preset-bad-cue'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Брифинг',
                'cue': 0,
                'steps': [build_step(title='Камера')],
            }],
            mosaic={
                'presets': [{
                    'id': preset_id,
                    'title': 'Сетка',
                    'layout': '1x2',
                    'screens': [
                        {'id': 'a', 'label': 'A', 'cue': 100},
                        {'id': 'b', 'label': 'B', 'cue': 'x'},
                    ],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'stage', 'stage_id': stage_id}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data['stages'][0]['cue'])
        screens = {item['id']: item for item in response.data['mosaic']['presets'][0]['screens']}
        self.assertIsNone(screens['a']['cue'])
        self.assertIsNone(screens['b']['cue'])

    def test_tableau_preset_round_trip(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = '33333333-3333-3333-3333-333333333333'
        preset_id = 'preset-tableau-1'
        block_id = 'block-sources-1'
        bridge_block_id = 'block-bridge-1'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Карта региона',
                'steps': [build_step(title='Камера')],
            }],
            tableau={
                'blocks': [{
                    'id': block_id,
                    'title': 'Источники',
                    'width': 24,
                    'height': 30,
                    'border_radius_px': 12,
                    'fill': {'color': 'rgba(15,23,42,0.55)', 'opacity': 1},
                    'border': {'color': 'rgba(255,255,255,0.28)', 'width': 1, 'opacity': 1},
                    'elements': [{
                        'type': 'text',
                        'id': 'el-text-1',
                        'content': 'Источники информации\n• Официальные сайты\n• Минсвязи',
                        'x': 8,
                        'y': 8,
                        'w': 84,
                        'h': 80,
                        'style': {'font_size': 14, 'color': '#f8fafc'},
                    }, {
                        'type': 'image',
                        'id': 'el-img-1',
                        'src': '/media/demo_tableau/sample.webp',
                        'x': 10,
                        'y': 70,
                        'w': 40,
                        'h': 25,
                    }],
                }, {
                    'id': bridge_block_id,
                    'title': 'Сводка источников',
                    'width': 80,
                    'height': 16,
                    'border_radius_px': 12,
                    'fill': {'color': 'rgba(15,23,42,0.55)', 'opacity': 1},
                    'border': {'color': 'rgba(255,255,255,0.28)', 'width': 1, 'opacity': 1},
                    'elements': [{
                        'type': 'text',
                        'id': 'el-bridge-text',
                        'content': 'Сводка источников\n• Астана\n• Алматы',
                        'x': 8,
                        'y': 8,
                        'w': 84,
                        'h': 84,
                        'style': {'font_size': 13, 'color': '#f8fafc'},
                    }],
                }],
                'presets': [{
                    'id': preset_id,
                    'title': 'Источники',
                    'cue': 9,
                    'stage_id': stage_id,
                    'tilt': {
                        'perspective': 1400,
                        'rotate_x': 55,
                        'rotate_z': -10,
                        'scale': 0.9,
                    },
                    'card_stagger_ms': 400,
                    'arrow_draw_ms': 800,
                    'border_radius_px': 18,
                    'tilt_ms': 800,
                    'untilt_ms': 650,
                    'caption': {
                        'content': 'Источники информации',
                        'x': 50,
                        'y': 6,
                    },
                    'overlay': {
                        'cols': 4,
                        'rows': 2,
                        'x': 4,
                        'y': 6,
                        'width': 92,
                        'height': 34,
                        'column_gap': 1.2,
                        'row_gap': 0.8,
                        'row_heights': [1.4, 0.8],
                        'cells': [
                            {
                                'id': 'cell-card-a',
                                'row': 0,
                                'col': 0,
                                'col_span': 1,
                                'role': 'card',
                                'block_id': block_id,
                                'content_width': 90,
                                'content_height': 100,
                                'align_x': 'center',
                                'align_y': 'center',
                                'offset_top': 0,
                            },
                            {
                                'id': 'cell-bridge-a',
                                'row': 1,
                                'col': 1,
                                'col_span': 2,
                                'role': 'bridge',
                                'block_id': bridge_block_id,
                                'content_width': 100,
                                'content_height': 70,
                                'align_x': 'center',
                                'align_y': 'center',
                                'offset_top': 8,
                            },
                        ],
                        'map_arrow': {
                            'inset': 14,
                            'line': 'dashed',
                            'width': 1.5,
                            'color': 'rgba(248,250,252,0.88)',
                            'head': 'end',
                        },
                    },
                }],
                'active_preset_id': preset_id,
            },
            sequence=[
                {'type': 'tableau', 'preset_id': preset_id, 'duration_ms': 12000},
            ],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('tableau', response.data)
        self.assertEqual(len(response.data['tableau']['blocks']), 2)
        block = response.data['tableau']['blocks'][0]
        self.assertEqual(block['id'], block_id)
        self.assertEqual(len(block['elements']), 2)
        self.assertEqual(block['elements'][1]['src'], '/media/demo_tableau/sample.webp')
        preset = response.data['tableau']['presets'][0]
        self.assertEqual(preset['id'], preset_id)
        self.assertEqual(preset['cue'], 9)
        self.assertEqual(preset['stage_id'], stage_id)
        self.assertEqual(preset['tilt']['perspective'], 1400)
        self.assertEqual(preset['tilt']['rotate_x'], 55)
        self.assertEqual(preset['tilt']['rotate_z'], -10)
        self.assertEqual(preset['tilt']['scale'], 0.9)
        self.assertEqual(preset['card_stagger_ms'], 400)
        self.assertEqual(preset['arrow_draw_ms'], 800)
        self.assertEqual(preset['border_radius_px'], 18)
        self.assertEqual(preset['tilt_ms'], 800)
        self.assertEqual(preset['untilt_ms'], 650)
        self.assertEqual(preset['caption']['content'], 'Источники информации')
        self.assertEqual(preset['caption']['x'], 50)
        self.assertEqual(preset['caption']['y'], 6)
        self.assertIn('overlay', preset)
        overlay = preset['overlay']
        self.assertEqual(overlay['cols'], 4)
        self.assertEqual(overlay['rows'], 2)
        self.assertEqual(overlay['y'], 6)
        self.assertEqual(overlay['height'], 34)
        self.assertEqual(overlay['column_gap'], 1.2)
        self.assertEqual(overlay['row_gap'], 0.8)
        self.assertEqual(overlay['row_heights'], [1.4, 0.8])
        self.assertNotIn('gap', overlay)
        self.assertEqual(len(overlay['cells']), 2)
        self.assertEqual(overlay['cells'][0]['role'], 'card')
        self.assertEqual(overlay['cells'][0]['block_id'], block_id)
        self.assertEqual(overlay['cells'][0]['content_width'], 90)
        self.assertEqual(overlay['cells'][0]['content_height'], 100)
        self.assertEqual(overlay['cells'][0]['align_x'], 'center')
        self.assertEqual(overlay['cells'][0]['align_y'], 'center')
        self.assertEqual(overlay['cells'][0]['offset_top'], 0)
        self.assertEqual(overlay['cells'][1]['role'], 'bridge')
        self.assertEqual(overlay['cells'][1]['block_id'], bridge_block_id)
        self.assertEqual(overlay['cells'][1]['col'], 1)
        self.assertEqual(overlay['cells'][1]['col_span'], 2)
        self.assertEqual(overlay['cells'][1]['content_width'], 100)
        self.assertEqual(overlay['cells'][1]['content_height'], 70)
        self.assertEqual(overlay['cells'][1]['align_x'], 'center')
        self.assertEqual(overlay['cells'][1]['align_y'], 'center')
        self.assertEqual(overlay['cells'][1]['offset_top'], 8)
        self.assertEqual(overlay['map_arrow']['line'], 'dashed')
        self.assertEqual(overlay['map_arrow']['inset'], 14)
        self.assertEqual(overlay['map_arrow']['width'], 1.5)
        self.assertNotIn('cards', preset)
        self.assertEqual(response.data['sequence'][0]['type'], 'tableau')
        self.assertEqual(response.data['sequence'][0]['preset_id'], preset_id)

    def test_invalid_tableau_cue_is_dropped(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
        preset_id = 'preset-tableau-bad-cue'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Карта',
                'steps': [build_step(title='Камера')],
            }],
            tableau={
                'presets': [{
                    'id': preset_id,
                    'title': 'Планшет',
                    'cue': 100,
                    'stage_id': stage_id,
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'tableau', 'preset_id': preset_id}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data['tableau']['presets'][0]['cue'])

    def test_tableau_legacy_cards_migrate(self):
        headers = auth_header(self.client, 'demo_admin', ADMIN_PASSWORD)
        stage_id = '44444444-4444-4444-4444-444444444444'
        preset_id = 'preset-legacy-cards'
        response = self.create_scenario(
            headers,
            steps=[],
            stages=[{
                'id': stage_id,
                'title': 'Legacy',
                'steps': [build_step(title='Камера')],
            }],
            tableau={
                'presets': [{
                    'id': preset_id,
                    'title': 'Legacy cards',
                    'stage_id': stage_id,
                    'cards': [{
                        'id': 'card-a',
                        'title': 'Источники информации',
                        'items': ['Официальные сайты', 'Минсвязи'],
                        'x': 18,
                        'y': 14,
                    }],
                }],
                'active_preset_id': preset_id,
            },
            sequence=[{'type': 'tableau', 'preset_id': preset_id, 'duration_ms': 5000}],
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        tableau = response.data['tableau']
        self.assertGreaterEqual(len(tableau['blocks']), 1)
        preset = tableau['presets'][0]
        self.assertEqual(len(preset['placements']), 1)
        self.assertTrue(preset['placements'][0]['block_id'])
        self.assertGreaterEqual(len(preset['map_anchors']), 1)
        self.assertGreaterEqual(len(preset['arrows']), 1)
        self.assertEqual(preset['arrows'][0]['placement_id'], preset['placements'][0]['id'])
        self.assertEqual(preset['arrows'][0]['map_anchor_id'], preset['map_anchors'][0]['id'])
        self.assertIn('overlay', preset)
        overlay_cells = preset['overlay'].get('cells') or []
        self.assertTrue(any(cell.get('block_id') for cell in overlay_cells))
