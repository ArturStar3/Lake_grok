"""Утилиты для сценариев демонстрации возможностей карты."""

from django.db import transaction

from formular.models import (
    DEFAULT_DEMO_STEP_DURATION_MS,
    DemoScenarioStep,
    DemoStepDirection,
    DemoStepEffect,
)

MIN_STEP_DURATION_MS = 500
MAX_STEP_DURATION_MS = 600_000

CAMERA_MODES = ('none', 'fly_to', 'fit_selection')
EASINGS = ('linear', 'ease_out', 'ease_in_out')
STATE_CYCLE_ORDERS = ('old_to_new', 'new_to_old')

DEFAULT_CAMERA = {
    'mode': 'none',
    'lat': None,
    'lng': None,
    'zoom': 8,
    'duration_ms': 1500,
    'ease_linearity': 0.3,
    'padding': 72,
}

DEFAULT_ANIMATION = {
    'effect': DemoStepEffect.NONE,
    'direction': DemoStepDirection.LEFT,
    'duration_ms': 1200,
    'delay_ms': 0,
    'easing': 'ease_out',
    'repeat': 0,
    'continuous': False,
    'state_cycle': {
        'per_state_ms': 1800,
        'cross_fade_ms': 600,
        'order': 'old_to_new',
    },
}

CONTINUOUS_BY_DEFAULT = frozenset((DemoStepEffect.BLINK, DemoStepEffect.STATE_CYCLE))

DEFAULT_SELECTION = {
    'target_ids': [],
    'event_ids': [],
    'situation_ids': [],
    'zone_leaves': [],
    'overlay_layer_ids': [],
    'country_isos': [],
    'card_ids': [],
}


def _clamp(value, low, high, fallback):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return int(max(low, min(high, number)))


def _choice(value, allowed, fallback):
    return value if value in allowed else fallback


def _as_bool(value, fallback=False):
    if isinstance(value, bool):
        return value
    if value is None:
        return fallback
    if isinstance(value, str):
        return value.strip().lower() in ('1', 'true', 'yes', 'on')
    if isinstance(value, (int, float)):
        return bool(value)
    return fallback


def default_continuous_for_effect(effect):
    return effect in CONTINUOUS_BY_DEFAULT


def normalize_camera(raw):
    """Приводит блок камеры шага к предсказуемой форме."""
    data = raw if isinstance(raw, dict) else {}
    mode = _choice(data.get('mode'), CAMERA_MODES, DEFAULT_CAMERA['mode'])
    lat = data.get('lat')
    lng = data.get('lng')
    try:
        lat = None if lat is None else float(lat)
        lng = None if lng is None else float(lng)
    except (TypeError, ValueError):
        lat, lng = None, None
    if lat is not None and not -90 <= lat <= 90:
        lat = None
    if lng is not None and not -180 <= lng <= 180:
        lng = None
    return {
        'mode': mode,
        'lat': lat,
        'lng': lng,
        'zoom': _clamp(data.get('zoom', DEFAULT_CAMERA['zoom']), 1, 20, DEFAULT_CAMERA['zoom']),
        'duration_ms': _clamp(
            data.get('duration_ms', DEFAULT_CAMERA['duration_ms']),
            0, 60_000, DEFAULT_CAMERA['duration_ms'],
        ),
        'ease_linearity': max(0.05, min(1.0, float(
            data.get('ease_linearity') or DEFAULT_CAMERA['ease_linearity']
        ))),
        'padding': _clamp(data.get('padding', DEFAULT_CAMERA['padding']), 0, 400, DEFAULT_CAMERA['padding']),
    }


def _normalize_id_list(raw):
    if not isinstance(raw, (list, tuple)):
        return []
    seen = []
    for item in raw:
        if item is None:
            continue
        key = str(item)
        if key and key not in seen:
            seen.append(key)
    return seen


def _normalize_country_isos(raw):
    if not isinstance(raw, (list, tuple)):
        return []
    seen = []
    for item in raw:
        if item is None:
            continue
        key = str(item).strip().upper()
        if not key or len(key) > 3 or key in seen:
            continue
        seen.append(key)
    return seen


def _normalize_zone_leaves(raw):
    if not isinstance(raw, (list, tuple)):
        return []
    result = []
    seen = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        country = item.get('country')
        action_type_id = item.get('action_type_id')
        leaf = item.get('leaf') or 'manual'
        if country is None or action_type_id is None:
            continue
        entry = {
            'country': str(country),
            'action_type_id': str(action_type_id),
            'leaf': str(leaf),
        }
        key = (entry['country'], entry['action_type_id'], entry['leaf'])
        if key in seen:
            continue
        seen.add(key)
        result.append(entry)
    return result


def normalize_selection(raw):
    """Приводит блок выбранных элементов шага к предсказуемой форме."""
    data = raw if isinstance(raw, dict) else {}
    return {
        'target_ids': _normalize_id_list(data.get('target_ids')),
        'event_ids': _normalize_id_list(data.get('event_ids')),
        'situation_ids': _normalize_id_list(data.get('situation_ids')),
        'zone_leaves': _normalize_zone_leaves(data.get('zone_leaves')),
        'overlay_layer_ids': _normalize_id_list(data.get('overlay_layer_ids')),
        'country_isos': _normalize_country_isos(data.get('country_isos')),
        'card_ids': _normalize_id_list(data.get('card_ids')),
    }


def normalize_animation(raw):
    """Приводит блок анимации шага к предсказуемой форме."""
    data = raw if isinstance(raw, dict) else {}
    cycle_raw = data.get('state_cycle') if isinstance(data.get('state_cycle'), dict) else {}
    defaults_cycle = DEFAULT_ANIMATION['state_cycle']
    effect = _choice(
        data.get('effect'),
        {choice for choice, _ in DemoStepEffect.choices},
        DEFAULT_ANIMATION['effect'],
    )
    continuous_default = default_continuous_for_effect(effect)
    return {
        'effect': effect,
        'direction': _choice(
            data.get('direction'),
            {choice for choice, _ in DemoStepDirection.choices},
            DEFAULT_ANIMATION['direction'],
        ),
        'duration_ms': _clamp(
            data.get('duration_ms', DEFAULT_ANIMATION['duration_ms']),
            0, 60_000, DEFAULT_ANIMATION['duration_ms'],
        ),
        'delay_ms': _clamp(
            data.get('delay_ms', DEFAULT_ANIMATION['delay_ms']),
            0, 60_000, DEFAULT_ANIMATION['delay_ms'],
        ),
        'easing': _choice(data.get('easing'), EASINGS, DEFAULT_ANIMATION['easing']),
        'repeat': _clamp(data.get('repeat', DEFAULT_ANIMATION['repeat']), 0, 100, DEFAULT_ANIMATION['repeat']),
        'continuous': (
            _as_bool(data.get('continuous'), continuous_default)
            if 'continuous' in data
            else continuous_default
        ),
        'state_cycle': {
            'per_state_ms': _clamp(
                cycle_raw.get('per_state_ms', defaults_cycle['per_state_ms']),
                200, 60_000, defaults_cycle['per_state_ms'],
            ),
            'cross_fade_ms': _clamp(
                cycle_raw.get('cross_fade_ms', defaults_cycle['cross_fade_ms']),
                0, 20_000, defaults_cycle['cross_fade_ms'],
            ),
            'order': _choice(cycle_raw.get('order'), STATE_CYCLE_ORDERS, defaults_cycle['order']),
        },
    }


def normalize_step_duration(value):
    return _clamp(value, MIN_STEP_DURATION_MS, MAX_STEP_DURATION_MS, DEFAULT_DEMO_STEP_DURATION_MS)


@transaction.atomic
def replace_demo_scenario_steps(scenario, steps_data):
    """
    Атомарная замена шагов сценария с переиндексацией порядка 0..N-1.
    steps_data: список валидированных словарей или None — не менять.
    """
    if steps_data is None:
        return
    scenario.steps.all().delete()
    if not steps_data:
        return
    to_create = [
        DemoScenarioStep(
            scenario=scenario,
            order=index,
            title=row.get('title') or '',
            tool=row['tool'],
            duration_ms=normalize_step_duration(row.get('duration_ms')),
            start_mode=row['start_mode'],
            hold_previous=bool(row.get('hold_previous')),
            camera=normalize_camera(row.get('camera')),
            selection=normalize_selection(row.get('selection')),
            animation=normalize_animation(row.get('animation')),
        )
        for index, row in enumerate(steps_data)
    ]
    DemoScenarioStep.objects.bulk_create(to_create)
    if hasattr(scenario, '_prefetched_objects_cache'):
        scenario._prefetched_objects_cache.pop('steps', None)


def clear_other_default_scenarios(scenario):
    """Только один сценарий может быть помечен как «по умолчанию»."""
    if not scenario.is_default:
        return
    scenario.__class__.objects.exclude(pk=scenario.pk).filter(is_default=True).update(is_default=False)
