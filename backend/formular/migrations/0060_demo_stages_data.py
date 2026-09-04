import uuid

from django.db import migrations, models
import django.db.models.deletion


def _selection_dict(step):
    return step.selection if isinstance(step.selection, dict) else {}


def _screen_has_snapshot(screen):
    if not isinstance(screen, dict):
        return False
    camera = screen.get('camera') if isinstance(screen.get('camera'), dict) else {}
    selection = screen.get('selection') if isinstance(screen.get('selection'), dict) else {}
    if camera.get('mode') and camera.get('mode') != 'none':
        return True
    for key in ('target_ids', 'event_ids', 'situation_ids', 'zone_leaves', 'overlay_layer_ids', 'country_isos'):
        if selection.get(key):
            return True
    text = screen.get('text') if isinstance(screen.get('text'), dict) else {}
    return bool(text.get('content'))


def _create_step(DemoScenarioStep, scenario, stage, order, **kwargs):
    defaults = {
        'scenario': scenario,
        'stage': stage,
        'order': order,
        'title': '',
        'tool': 'camera',
        'duration_ms': 6000,
        'start_mode': 'after_previous',
        'hold_previous': False,
        'camera': {},
        'selection': {},
        'animation': {},
        'text': {},
        'mosaic': {'slot': None, 'loop': False, 'label': ''},
    }
    defaults.update(kwargs)
    return DemoScenarioStep.objects.create(**defaults)


def forwards(apps, schema_editor):
    DemoScenario = apps.get_model('formular', 'DemoScenario')
    DemoScenarioStage = apps.get_model('formular', 'DemoScenarioStage')
    DemoScenarioStep = apps.get_model('formular', 'DemoScenarioStep')

    for scenario in DemoScenario.objects.all().iterator():
        steps = list(DemoScenarioStep.objects.filter(scenario=scenario).order_by('order', 'id'))
        groups = []
        sequence = []
        current = None
        last_mosaic_preset = object()

        def close_stage():
            nonlocal current
            if not current:
                return
            groups.append(current)
            sequence.append({
                'key': f'seq-stage-{len(sequence)}',
                'type': 'stage',
                'group_index': len(groups) - 1,
                'stage_id': None,
                'preset_id': None,
                'duration_ms': 0,
                'wait_for_presenter': False,
                'enter': {'effect': 'none', 'duration_ms': 400},
                'exit': {'effect': 'none', 'duration_ms': 400},
            })
            current = None

        for step in steps:
            if step.tool == 'mosaic':
                close_stage()
                selection = _selection_dict(step)
                action = selection.get('mosaic_action') or 'show_grid'
                preset_id = selection.get('preset_id') or None
                if action in ('exit', 'collapse'):
                    continue
                if preset_id != last_mosaic_preset or action == 'show_grid':
                    sequence.append({
                        'key': f'seq-mosaic-{len(sequence)}',
                        'type': 'mosaic',
                        'stage_id': None,
                        'preset_id': str(preset_id)[:80] if preset_id else None,
                        'duration_ms': int(step.duration_ms or 0),
                        'wait_for_presenter': False,
                        'enter': {'effect': 'none', 'duration_ms': 400},
                        'exit': {'effect': 'none', 'duration_ms': 400},
                    })
                    last_mosaic_preset = preset_id
                continue

            last_mosaic_preset = object()
            starts_new = current is None or step.start_mode == 'on_click'
            if starts_new:
                close_stage()
                current = {
                    'title': (step.title or f'Этап {len(groups) + 1}')[:255],
                    'steps': [step],
                }
            else:
                current['steps'].append(step)
        close_stage()

        created = []
        for index, group in enumerate(groups):
            stage = DemoScenarioStage.objects.create(
                id=uuid.uuid4(),
                scenario=scenario,
                order=index,
                title=group['title'],
            )
            created.append(stage)
            for step_index, step in enumerate(group['steps']):
                step.stage_id = stage.id
                step.order = step_index
                step.save(update_fields=['stage', 'order'])

        for item in sequence:
            if item['type'] == 'stage':
                group_index = item.pop('group_index', None)
                if group_index is not None and 0 <= group_index < len(created):
                    item['stage_id'] = str(created[group_index].id)

        mosaic = scenario.mosaic if isinstance(scenario.mosaic, dict) else {}
        presets = mosaic.get('presets') if isinstance(mosaic.get('presets'), list) else []
        next_order = len(created)
        for preset in presets:
            if not isinstance(preset, dict):
                continue
            screens = preset.get('screens') if isinstance(preset.get('screens'), list) else []
            for screen in screens:
                if not isinstance(screen, dict):
                    continue
                if screen.get('stage_id') or not _screen_has_snapshot(screen):
                    continue
                label = screen.get('label') or f"Экран {str(screen.get('id') or '').upper()}"
                preset_title = preset.get('title') or 'Мультиэкран'
                stage = DemoScenarioStage.objects.create(
                    id=uuid.uuid4(),
                    scenario=scenario,
                    order=next_order,
                    title=f'{label} ({preset_title})'[:255],
                )
                next_order += 1
                order = 0
                camera = screen.get('camera') if isinstance(screen.get('camera'), dict) else {}
                selection = screen.get('selection') if isinstance(screen.get('selection'), dict) else {}
                if camera.get('mode') and camera.get('mode') != 'none':
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='Камера',
                        tool='camera',
                        camera=camera,
                        start_mode='after_previous',
                    )
                    order += 1
                if selection.get('target_ids'):
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='Объекты',
                        tool='objects',
                        selection={'target_ids': selection.get('target_ids') or []},
                        camera={'mode': 'none'},
                        start_mode='with_previous' if order else 'after_previous',
                    )
                    order += 1
                if selection.get('event_ids'):
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='События',
                        tool='events',
                        selection={'event_ids': selection.get('event_ids') or []},
                        camera={'mode': 'none'},
                        start_mode='with_previous' if order else 'after_previous',
                    )
                    order += 1
                if selection.get('situation_ids'):
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='Обстановка',
                        tool='situations',
                        selection={'situation_ids': (selection.get('situation_ids') or [])[:1]},
                        camera={'mode': 'none'},
                        start_mode='with_previous' if order else 'after_previous',
                    )
                    order += 1
                if selection.get('zone_leaves'):
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='Зоны',
                        tool='zones',
                        selection={'zone_leaves': selection.get('zone_leaves') or []},
                        camera={'mode': 'none'},
                        start_mode='with_previous' if order else 'after_previous',
                    )
                    order += 1
                if selection.get('overlay_layer_ids'):
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='Слои',
                        tool='layers',
                        selection={'overlay_layer_ids': selection.get('overlay_layer_ids') or []},
                        camera={'mode': 'none'},
                        start_mode='with_previous' if order else 'after_previous',
                    )
                    order += 1
                text = screen.get('text') if isinstance(screen.get('text'), dict) else {}
                if text.get('content'):
                    _create_step(
                        DemoScenarioStep, scenario, stage, order,
                        title='Текст',
                        tool='text',
                        text=text,
                        camera={'mode': 'none'},
                        start_mode='with_previous' if order else 'after_previous',
                    )
                screen['stage_id'] = str(stage.id)

        DemoScenarioStep.objects.filter(scenario=scenario, tool='mosaic').delete()
        DemoScenarioStep.objects.filter(scenario=scenario, stage__isnull=True).delete()

        scenario.mosaic = mosaic
        scenario.sequence = sequence
        scenario.save(update_fields=['mosaic', 'sequence'])


def backwards(apps, schema_editor):
    DemoScenario = apps.get_model('formular', 'DemoScenario')
    DemoScenarioStage = apps.get_model('formular', 'DemoScenarioStage')
    DemoScenarioStep = apps.get_model('formular', 'DemoScenarioStep')

    for scenario in DemoScenario.objects.all().iterator():
        order = 0
        sequence = scenario.sequence if isinstance(scenario.sequence, list) else []
        stages = {
            str(stage.id): stage
            for stage in DemoScenarioStage.objects.filter(scenario=scenario).order_by('order')
        }
        for item in sequence:
            if not isinstance(item, dict):
                continue
            if item.get('type') == 'mosaic':
                DemoScenarioStep.objects.create(
                    scenario=scenario,
                    stage=None,
                    order=order,
                    title='Мультиэкран',
                    tool='mosaic',
                    duration_ms=item.get('duration_ms') or 6000,
                    start_mode='on_click',
                    hold_previous=False,
                    camera={'mode': 'none'},
                    selection={
                        'mosaic_action': 'show_grid',
                        'preset_id': item.get('preset_id'),
                        'slot': None,
                    },
                    animation={},
                    text={},
                    mosaic={'slot': None, 'loop': False, 'label': ''},
                )
                order += 1
                continue
            stage = stages.get(str(item.get('stage_id') or ''))
            if not stage:
                continue
            for step in DemoScenarioStep.objects.filter(stage=stage).order_by('order'):
                step.order = order
                if order == 0 or (step.order == 0 and step.start_mode != 'with_previous'):
                    step.start_mode = 'on_click'
                step.save(update_fields=['order', 'start_mode'])
                order += 1
        scenario.sequence = []
        scenario.save(update_fields=['sequence'])


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0059_demo_stages_and_sequence'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
