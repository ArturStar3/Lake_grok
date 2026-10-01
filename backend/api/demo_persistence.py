import re
import uuid

from django.db import transaction
from .demo_scanner import normalize_scanner

from formular.models import (
    DEFAULT_DEMO_STEP_DURATION_MS,
    DemoScenarioStage,
    DemoScenarioStep,
    DemoStepDirection,
    DemoStepEffect,
    DemoStepTool,
)

from .demo_normalize_mosaic import (

    _optional_mosaic_easing,

    _optional_mosaic_expand_animation,

    _optional_mosaic_ms,

    normalize_mosaic_slot_id,

    normalize_scenario_mosaic,

    normalize_sequence_mosaic_action,

    normalize_sequence_transition,

    normalize_step_mosaic,

)

from .demo_normalize_tableau import (

    normalize_scenario_tableau,

)

from .demo_normalize_text import (

    normalize_text,

)

from .demo_scenario_common import (

    MAX_STEP_DURATION_MS,

    SEQUENCE_TYPES,

    STAGE_TOOLS,

    _as_bool,

    _choice,

    _clamp,

    _optional_id,

    normalize_animation,

    normalize_camera,

    normalize_cue,

    normalize_selection,

    normalize_step_duration,

)


def normalize_sequence_item(
    raw,
    index=0,
    allowed_stage_ids=None,
    allowed_preset_ids=None,
    allowed_tableau_preset_ids=None,
):
    data = raw if isinstance(raw, dict) else {}
    item_type = _choice(data.get('type'), SEQUENCE_TYPES, 'stage')
    stage_id = _optional_id(data.get('stage_id'))
    preset_id = _optional_id(data.get('preset_id'))
    if allowed_stage_ids is not None and stage_id and stage_id not in allowed_stage_ids:
        stage_id = None
    if item_type == 'mosaic':
        if allowed_preset_ids is not None and preset_id and preset_id not in allowed_preset_ids:
            preset_id = None
    elif item_type == 'tableau':
        if (
            allowed_tableau_preset_ids is not None
            and preset_id
            and preset_id not in allowed_tableau_preset_ids
        ):
            preset_id = None
    key = data.get('key')
    if not key or not str(key).strip():
        key = f'seq-{index}-{uuid.uuid4().hex[:8]}'
    else:
        key = str(key).strip()[:80]
    duration_raw = data.get('duration_ms', 0)
    duration_ms = _clamp(duration_raw, 0, MAX_STEP_DURATION_MS, 0)
    mosaic_action = 'show_grid'
    slot = None
    expand_animation = None
    expand_ms = None
    collapse_ms = None
    expand_easing = None
    collapse_easing = None
    if item_type == 'mosaic':
        mosaic_action = normalize_sequence_mosaic_action(data.get('mosaic_action'))
        slot = normalize_mosaic_slot_id(data.get('slot'))
        if mosaic_action == 'show_grid':
            slot = None
        expand_animation = _optional_mosaic_expand_animation(data.get('expand_animation'))
        expand_ms = _optional_mosaic_ms(data.get('expand_ms'))
        collapse_ms = _optional_mosaic_ms(data.get('collapse_ms'))
        expand_easing = _optional_mosaic_easing(data.get('expand_easing'))
        collapse_easing = _optional_mosaic_easing(data.get('collapse_easing'))
    return {
        'key': key,
        'type': item_type,
        'stage_id': stage_id if item_type == 'stage' else None,
        'preset_id': preset_id if item_type in ('mosaic', 'tableau') else None,
        'mosaic_action': mosaic_action if item_type == 'mosaic' else 'show_grid',
        'slot': slot if item_type == 'mosaic' else None,
        'duration_ms': duration_ms,
        'wait_for_presenter': _as_bool(data.get('wait_for_presenter'), False),
        'enter': normalize_sequence_transition(data.get('enter')),
        'exit': normalize_sequence_transition(data.get('exit')),
        'expand_animation': expand_animation,
        'expand_ms': expand_ms,
        'collapse_ms': collapse_ms,
        'expand_easing': expand_easing,
        'collapse_easing': collapse_easing,
    }


def normalize_scenario_sequence(
    raw,
    allowed_stage_ids=None,
    allowed_preset_ids=None,
    allowed_tableau_preset_ids=None,
):
    items = raw if isinstance(raw, list) else []
    return [
        normalize_sequence_item(
            item,
            index,
            allowed_stage_ids=allowed_stage_ids,
            allowed_preset_ids=allowed_preset_ids,
            allowed_tableau_preset_ids=allowed_tableau_preset_ids,
        )
        for index, item in enumerate(items)
        if isinstance(item, dict)
    ]


def _step_kwargs(scenario, stage, index, row):
    tool = row.get('tool') or DemoStepTool.CAMERA
    if tool == DemoStepTool.MOSAIC:
        tool = DemoStepTool.CAMERA
    if tool not in STAGE_TOOLS:
        tool = DemoStepTool.CAMERA
    return {
        'scenario': scenario,
        'stage': stage,
        'order': index,
        'title': row.get('title') or '',
        'tool': tool,
        'duration_ms': normalize_step_duration(row.get('duration_ms')),
        'start_mode': row.get('start_mode') or 'after_previous',
        'hold_previous': bool(row.get('hold_previous')),
        'wait_for_click': bool(row.get('wait_for_click')),
        'camera': normalize_camera(row.get('camera')),
        'selection': normalize_selection(row.get('selection')),
        'animation': normalize_animation(row.get('animation')),
        'text': normalize_text(row.get('text')),
        'mosaic': normalize_step_mosaic(row.get('mosaic')),
    }


def _remap_stage_id(value, id_map):
    if value is None:
        return None
    key = str(value).strip()
    if not key:
        return None
    return id_map.get(key)


def _remap_mosaic_stage_ids(raw, id_map):
    data = raw if isinstance(raw, dict) else {}
    presets = data.get('presets') if isinstance(data.get('presets'), list) else []
    next_presets = []
    for preset in presets:
        if not isinstance(preset, dict):
            continue
        screens = preset.get('screens') if isinstance(preset.get('screens'), list) else []
        next_screens = []
        for screen in screens:
            if not isinstance(screen, dict):
                continue
            mapped = dict(screen)
            mapped['stage_id'] = _remap_stage_id(screen.get('stage_id'), id_map)
            mapped['expand_stage_id'] = _remap_stage_id(screen.get('expand_stage_id'), id_map)
            next_screens.append(mapped)
        next_presets.append({**preset, 'screens': next_screens})
    return {**data, 'presets': next_presets}


def _remap_tableau_stage_ids(raw, id_map):
    data = raw if isinstance(raw, dict) else {}
    presets = data.get('presets') if isinstance(data.get('presets'), list) else []
    next_presets = []
    for preset in presets:
        if not isinstance(preset, dict):
            continue
        mapped = dict(preset)
        mapped['stage_id'] = _remap_stage_id(preset.get('stage_id'), id_map)
        next_presets.append(mapped)
    return {**data, 'presets': next_presets}


def _remap_sequence_stage_ids(raw, id_map):
    items = raw if isinstance(raw, list) else []
    remapped = []
    for item in items:
        if not isinstance(item, dict):
            continue
        next_item = dict(item)
        next_item['stage_id'] = _remap_stage_id(item.get('stage_id'), id_map)
        remapped.append(next_item)
    return remapped


@transaction.atomic
def replace_demo_scenario_library(
    scenario,
    stages_data,
    sequence_data=None,
    mosaic_data=None,
    tableau_data=None,
):
    """
    Атомарная замена библиотеки этапов, шагов и программы показа.
    stages_data: список {id?, title, steps: [...]}.
    Локальные id с клиента (не UUID) переписываются на новые и проставляются
    в sequence, слоты мультиэкрана и художественные пресеты.
    """
    scenario.steps.all().delete()
    scenario.stages.all().delete()

    created_stages = []
    to_create_steps = []
    id_map = {}
    for index, row in enumerate(stages_data or []):
        if not isinstance(row, dict):
            continue
        title = row.get('title') if isinstance(row.get('title'), str) else ''
        stage_id = row.get('id') or row.get('key')
        create_kwargs = {
            'scenario': scenario,
            'order': index,
            'title': (title or f'Этап {index + 1}')[:255],
            'cue': normalize_cue(row.get('cue')),
            'duration_ms': _clamp(row.get('duration_ms', 0), 0, MAX_STEP_DURATION_MS, 0),
        }
        if stage_id:
            try:
                create_kwargs['id'] = uuid.UUID(str(stage_id))
            except (TypeError, ValueError, AttributeError):
                pass
        stage = DemoScenarioStage.objects.create(**create_kwargs)
        created_stages.append(stage)
        id_map[str(stage.id)] = str(stage.id)
        if stage_id:
            id_map[str(stage_id)] = str(stage.id)
        if row.get('key'):
            id_map[str(row['key'])] = str(stage.id)
        steps = row.get('steps') if isinstance(row.get('steps'), list) else []
        for step_index, step_row in enumerate(steps):
            if not isinstance(step_row, dict):
                continue
            to_create_steps.append(DemoScenarioStep(
                **_step_kwargs(scenario, stage, step_index, step_row),
            ))

    if to_create_steps:
        DemoScenarioStep.objects.bulk_create(to_create_steps)

    stage_ids = {str(stage.id) for stage in created_stages}
    mosaic_raw = mosaic_data if mosaic_data is not None else scenario.mosaic
    tableau_raw = tableau_data if tableau_data is not None else getattr(scenario, 'tableau', None)
    sequence_raw = sequence_data if sequence_data is not None else scenario.sequence
    mosaic = normalize_scenario_mosaic(
        _remap_mosaic_stage_ids(mosaic_raw, id_map),
        allowed_stage_ids=stage_ids,
    )
    tableau = normalize_scenario_tableau(
        _remap_tableau_stage_ids(tableau_raw, id_map),
        allowed_stage_ids=stage_ids,
    )
    mosaic_preset_ids = {preset['id'] for preset in mosaic.get('presets') or []}
    tableau_preset_ids = {preset['id'] for preset in tableau.get('presets') or []}
    sequence = normalize_scenario_sequence(
        _remap_sequence_stage_ids(sequence_raw, id_map),
        allowed_stage_ids=stage_ids,
        allowed_preset_ids=mosaic_preset_ids,
        allowed_tableau_preset_ids=tableau_preset_ids,
    )
    scenario.mosaic = mosaic
    scenario.tableau = tableau
    scenario.sequence = sequence
    scenario.save(update_fields=['mosaic', 'tableau', 'sequence'])

    if hasattr(scenario, '_prefetched_objects_cache'):
        scenario._prefetched_objects_cache.pop('steps', None)
        scenario._prefetched_objects_cache.pop('stages', None)
    return created_stages


@transaction.atomic
def replace_demo_scenario_steps(scenario, steps_data):
    """Совместимость: плоский список шагов сворачивается в один этап."""
    if steps_data is None:
        return
    stages = [{
        'title': 'Этап 1',
        'steps': list(steps_data),
    }] if steps_data else []
    sequence = []
    if stages:
        sequence = [{'type': 'stage', 'stage_id': None, 'duration_ms': 0}]
    replace_demo_scenario_library(scenario, stages, sequence_data=sequence, mosaic_data=scenario.mosaic)
    if scenario.stages.exists() and scenario.sequence:
        first = scenario.stages.order_by('order').first()
        sequence = list(scenario.sequence)
        if sequence and sequence[0].get('type') == 'stage':
            sequence[0]['stage_id'] = str(first.id)
            scenario.sequence = sequence
            scenario.save(update_fields=['sequence'])


def clear_other_default_scenarios(scenario):
    """Только один сценарий может быть помечен как «по умолчанию»."""
    if not scenario.is_default:
        return
    scenario.__class__.objects.exclude(pk=scenario.pk).filter(is_default=True).update(is_default=False)

