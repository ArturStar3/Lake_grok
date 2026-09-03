"""Утилиты для сценариев демонстрации возможностей карты."""

import re

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

TEXT_ANCHORS = ('geo', 'screen')
TEXT_ALIGNS = ('left', 'center', 'right')
TEXT_ENTER_EFFECTS = ('none', 'fade', 'slide', 'zoom', 'blur', 'typewriter')
TEXT_EXIT_EFFECTS = ('none', 'fade', 'slide', 'zoom', 'blur')
TEXT_DIRECTIONS = ('left', 'right', 'top', 'bottom')
TEXT_FONT_WEIGHTS = (300, 400, 500, 600, 700, 800, 900)
# Оффлайн-развёртывание: в сборку входит только Roboto, остальные семейства
# резолвятся из шрифтов операционной системы.
TEXT_FONT_FAMILIES = (
    'Roboto',
    'Arial',
    'Tahoma',
    'Verdana',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'sans-serif',
    'serif',
    'monospace',
)
TEXT_MAX_LENGTH = 4000

COLOR_RE = re.compile(
    r'#[0-9a-fA-F]{3,8}'
    r'|(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg]+\s*\)'
    r'|[a-zA-Z]{3,20}'
)

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

DEFAULT_TEXT_STYLE = {
    'font_family': 'Roboto',
    'font_size': 32,
    'font_weight': 700,
    'italic': False,
    'underline': False,
    'line_height': 1.2,
    'letter_spacing': 0.0,
    'text_align': 'center',
    'rotation': 0.0,
    'opacity': 1.0,
    'color': '#ffffff',
    'gradient': {'enabled': False, 'from': '#ffffff', 'to': '#4da3ff', 'angle': 90},
    'stroke': {'enabled': False, 'color': '#0b1a2b', 'width': 2},
    'background': {'enabled': False, 'color': '#0b1a2b', 'opacity': 0.6, 'radius': 8, 'padding': 12},
    'shadow': {'enabled': False, 'color': 'rgba(0,0,0,0.55)', 'blur': 12, 'x': 0, 'y': 2},
    'scale_with_map': False,
}

DEFAULT_TEXT_ENTER = {
    'effect': 'fade',
    'direction': 'bottom',
    'duration_ms': 600,
    'delay_ms': 0,
    'easing': 'ease_out',
}

DEFAULT_TEXT_EXIT = {
    'effect': 'fade',
    'direction': 'top',
    'duration_ms': 400,
    'easing': 'ease_out',
}

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


def _clamp_float(value, low, high, fallback):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if number != number:  # NaN
        return fallback
    return max(low, min(high, number))


def _color(value, fallback):
    """Пропускает только безопасные CSS-цвета: #hex, rgb/rgba/hsl/hsla, ключевое слово."""
    if not isinstance(value, str):
        return fallback
    cleaned = value.strip()
    if not cleaned or len(cleaned) > 32 or not COLOR_RE.fullmatch(cleaned):
        return fallback
    return cleaned


def _normalize_text_style(raw):
    data = raw if isinstance(raw, dict) else {}
    defaults = DEFAULT_TEXT_STYLE
    gradient_raw = data.get('gradient') if isinstance(data.get('gradient'), dict) else {}
    stroke_raw = data.get('stroke') if isinstance(data.get('stroke'), dict) else {}
    background_raw = data.get('background') if isinstance(data.get('background'), dict) else {}
    shadow_raw = data.get('shadow') if isinstance(data.get('shadow'), dict) else {}

    weight = _clamp(data.get('font_weight', defaults['font_weight']), 100, 900, defaults['font_weight'])
    weight = min(TEXT_FONT_WEIGHTS, key=lambda item: abs(item - weight))

    return {
        'font_family': _choice(data.get('font_family'), TEXT_FONT_FAMILIES, defaults['font_family']),
        'font_size': _clamp(data.get('font_size', defaults['font_size']), 8, 200, defaults['font_size']),
        'font_weight': weight,
        'italic': _as_bool(data.get('italic'), defaults['italic']),
        'underline': _as_bool(data.get('underline'), defaults['underline']),
        'line_height': _clamp_float(data.get('line_height'), 0.6, 4.0, defaults['line_height']),
        'letter_spacing': _clamp_float(data.get('letter_spacing'), -10.0, 40.0, defaults['letter_spacing']),
        'text_align': _choice(data.get('text_align'), TEXT_ALIGNS, defaults['text_align']),
        'rotation': _clamp_float(data.get('rotation'), -180.0, 180.0, defaults['rotation']),
        'opacity': _clamp_float(data.get('opacity'), 0.0, 1.0, defaults['opacity']),
        'color': _color(data.get('color'), defaults['color']),
        'gradient': {
            'enabled': _as_bool(gradient_raw.get('enabled'), defaults['gradient']['enabled']),
            'from': _color(gradient_raw.get('from'), defaults['gradient']['from']),
            'to': _color(gradient_raw.get('to'), defaults['gradient']['to']),
            'angle': _clamp(gradient_raw.get('angle', defaults['gradient']['angle']), 0, 360, defaults['gradient']['angle']),
        },
        'stroke': {
            'enabled': _as_bool(stroke_raw.get('enabled'), defaults['stroke']['enabled']),
            'color': _color(stroke_raw.get('color'), defaults['stroke']['color']),
            'width': _clamp_float(stroke_raw.get('width'), 0.0, 20.0, defaults['stroke']['width']),
        },
        'background': {
            'enabled': _as_bool(background_raw.get('enabled'), defaults['background']['enabled']),
            'color': _color(background_raw.get('color'), defaults['background']['color']),
            'opacity': _clamp_float(background_raw.get('opacity'), 0.0, 1.0, defaults['background']['opacity']),
            'radius': _clamp(background_raw.get('radius', defaults['background']['radius']), 0, 80, defaults['background']['radius']),
            'padding': _clamp(background_raw.get('padding', defaults['background']['padding']), 0, 120, defaults['background']['padding']),
        },
        'shadow': {
            'enabled': _as_bool(shadow_raw.get('enabled'), defaults['shadow']['enabled']),
            'color': _color(shadow_raw.get('color'), defaults['shadow']['color']),
            'blur': _clamp(shadow_raw.get('blur', defaults['shadow']['blur']), 0, 80, defaults['shadow']['blur']),
            'x': _clamp(shadow_raw.get('x', defaults['shadow']['x']), -40, 40, defaults['shadow']['x']),
            'y': _clamp(shadow_raw.get('y', defaults['shadow']['y']), -40, 40, defaults['shadow']['y']),
        },
        'scale_with_map': _as_bool(data.get('scale_with_map'), defaults['scale_with_map']),
    }


def _normalize_text_transition(raw, defaults, effects):
    data = raw if isinstance(raw, dict) else {}
    return {
        'effect': _choice(data.get('effect'), effects, defaults['effect']),
        'direction': _choice(data.get('direction'), TEXT_DIRECTIONS, defaults['direction']),
        'duration_ms': _clamp(data.get('duration_ms', defaults['duration_ms']), 0, 20_000, defaults['duration_ms']),
        'delay_ms': _clamp(data.get('delay_ms', defaults.get('delay_ms', 0)), 0, 20_000, defaults.get('delay_ms', 0)),
        'easing': _choice(data.get('easing'), EASINGS, defaults['easing']),
    }


def normalize_text(raw):
    """Приводит блок текстового оверлея шага к предсказуемой форме."""
    data = raw if isinstance(raw, dict) else {}
    content = data.get('content')
    content = content[:TEXT_MAX_LENGTH] if isinstance(content, str) else ''

    anchor = _choice(data.get('anchor'), TEXT_ANCHORS, 'screen')
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
    if anchor == 'geo' and (lat is None or lng is None):
        anchor = 'screen'

    screen_raw = data.get('screen') if isinstance(data.get('screen'), dict) else {}
    offset_raw = data.get('offset') if isinstance(data.get('offset'), dict) else {}
    width = data.get('width')
    width = None if width in (None, '') else _clamp(width, 40, 2000, 400)

    return {
        'content': content,
        'anchor': anchor,
        'lat': lat,
        'lng': lng,
        'screen': {
            'x': _clamp_float(screen_raw.get('x'), 0.0, 1.0, 0.5),
            'y': _clamp_float(screen_raw.get('y'), 0.0, 1.0, 0.15),
        },
        'offset': {
            'x': _clamp(offset_raw.get('x', 0), -2000, 2000, 0),
            'y': _clamp(offset_raw.get('y', 0), -2000, 2000, 0),
        },
        'width': width,
        'style': _normalize_text_style(data.get('style')),
        'enter': _normalize_text_transition(data.get('enter'), DEFAULT_TEXT_ENTER, TEXT_ENTER_EFFECTS),
        'exit': _normalize_text_transition(data.get('exit'), DEFAULT_TEXT_EXIT, TEXT_EXIT_EFFECTS),
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
            text=normalize_text(row.get('text')),
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
