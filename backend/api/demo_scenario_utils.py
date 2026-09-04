"""Утилиты для сценариев демонстрации возможностей карты."""

import re
import uuid

from django.db import transaction

from formular.models import (
    DEFAULT_DEMO_STEP_DURATION_MS,
    DemoScenarioStage,
    DemoScenarioStep,
    DemoStepDirection,
    DemoStepEffect,
    DemoStepTool,
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

MOSAIC_LAYOUTS = ('1x2', '2x1', '1+2', '2x2', '2x3', '2+3')
MOSAIC_SLOT_IDS_BY_LAYOUT = {
    '1x2': ('a', 'b'),
    '2x1': ('a', 'b'),
    '1+2': ('a', 'b', 'c'),
    '2x2': ('a', 'b', 'c', 'd'),
    '2x3': ('a', 'b', 'c', 'd', 'e', 'f'),
    '2+3': ('a', 'b', 'c', 'd', 'e'),
}
MOSAIC_REVEALS = ('all', 'stagger')
MOSAIC_ACTIONS = ('show_grid', 'show_slot', 'focus_slot', 'collapse', 'exit')
SEQUENCE_MOSAIC_ACTIONS = ('show_grid', 'expand', 'collapse')
SEQUENCE_TYPES = ('stage', 'mosaic')
SEQUENCE_TRANSITION_EFFECTS = ('none', 'fade', 'blackout', 'stagger')
MOSAIC_SLOT_IDS = ('a', 'b', 'c', 'd', 'e', 'f')
STAGE_TOOLS = (
    DemoStepTool.CAMERA,
    DemoStepTool.OBJECTS,
    DemoStepTool.EVENTS,
    DemoStepTool.ZONES,
    DemoStepTool.INUNDATION,
    DemoStepTool.SITUATIONS,
    DemoStepTool.LAYERS,
    DemoStepTool.FORMULAR,
    DemoStepTool.COUNTRY,
    DemoStepTool.TEXT,
)
DEFAULT_MOSAIC = {
    'presets': [],
    'active_preset_id': None,
}
DEFAULT_SEQUENCE_TRANSITION = {
    'effect': 'none',
    'duration_ms': 400,
}
DEFAULT_STEP_MOSAIC = {
    'slot': None,
    'loop': False,
    'label': '',
}

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

CONTINUOUS_BY_DEFAULT = frozenset((
    DemoStepEffect.BLINK,
    DemoStepEffect.FLICKER,
    DemoStepEffect.GLOW,
    DemoStepEffect.COLOR_SHIFT,
    DemoStepEffect.SWAY,
    DemoStepEffect.STATE_CYCLE,
))

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
    action_raw = data.get('mosaic_action')
    mosaic_action = None
    if action_raw is not None and str(action_raw).strip():
        mosaic_action = _choice(str(action_raw).strip(), MOSAIC_ACTIONS, 'show_grid')
    preset_id = data.get('preset_id')
    if preset_id is not None:
        preset_id = str(preset_id).strip()[:80] or None
    slot_raw = data.get('slot')
    slot = None
    if slot_raw is not None and str(slot_raw).strip():
        slot = str(slot_raw).strip().lower()[:8]
        if slot not in ('a', 'b', 'c', 'd', 'e', 'f'):
            slot = None
    return {
        'target_ids': _normalize_id_list(data.get('target_ids')),
        'event_ids': _normalize_id_list(data.get('event_ids')),
        'situation_ids': _normalize_id_list(data.get('situation_ids')),
        'zone_leaves': _normalize_zone_leaves(data.get('zone_leaves')),
        'overlay_layer_ids': _normalize_id_list(data.get('overlay_layer_ids')),
        'country_isos': _normalize_country_isos(data.get('country_isos')),
        'card_ids': _normalize_id_list(data.get('card_ids')),
        'mosaic_action': mosaic_action,
        'preset_id': preset_id,
        'slot': slot,
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


def _new_preset_id():
    return f'preset-{uuid.uuid4().hex[:12]}'


def _optional_id(value):
    if value in (None, ''):
        return None
    text = str(value).strip()
    return text[:80] if text else None


def normalize_mosaic_screen(raw, slot_id, default_label='', allowed_stage_ids=None):
    data = raw if isinstance(raw, dict) else {}
    selection_raw = data.get('selection') if isinstance(data.get('selection'), dict) else {}
    label = data.get('label') if isinstance(data.get('label'), str) else ''
    if not label:
        label = default_label
    stage_id = _optional_id(data.get('stage_id'))
    if allowed_stage_ids is not None and stage_id and stage_id not in allowed_stage_ids:
        stage_id = None
    return {
        'id': slot_id,
        'label': label[:120],
        'loop': _as_bool(data.get('loop'), False),
        'stage_id': stage_id,
        'camera': normalize_camera(data.get('camera')),
        'selection': {
            'target_ids': _normalize_id_list(selection_raw.get('target_ids')),
            'event_ids': _normalize_id_list(selection_raw.get('event_ids')),
            'situation_ids': _normalize_id_list(selection_raw.get('situation_ids')),
            'zone_leaves': _normalize_zone_leaves(selection_raw.get('zone_leaves')),
            'overlay_layer_ids': _normalize_id_list(selection_raw.get('overlay_layer_ids')),
            'country_isos': _normalize_country_isos(selection_raw.get('country_isos')),
            'card_ids': _normalize_id_list(selection_raw.get('card_ids')),
        },
        'text': normalize_text(data.get('text')),
    }


def normalize_mosaic_preset(raw, allowed_stage_ids=None):
    data = raw if isinstance(raw, dict) else {}
    layout = _choice(data.get('layout'), MOSAIC_LAYOUTS, '2x2')
    slot_ids = MOSAIC_SLOT_IDS_BY_LAYOUT[layout]
    incoming = data.get('screens') if isinstance(data.get('screens'), list) else []
    by_id = {}
    for item in incoming:
        if not isinstance(item, dict):
            continue
        sid = str(item.get('id') or '').strip().lower()
        if sid in slot_ids:
            by_id[sid] = item
    if not by_id and isinstance(data.get('slots'), list):
        for item in data['slots']:
            if not isinstance(item, dict):
                continue
            sid = str(item.get('id') or '').strip().lower()
            if sid in slot_ids:
                by_id[sid] = {'id': sid, 'label': item.get('label') or ''}
    preset_id = data.get('id')
    if not preset_id or not str(preset_id).strip():
        preset_id = _new_preset_id()
    else:
        preset_id = str(preset_id).strip()[:80]
    title = data.get('title') if isinstance(data.get('title'), str) else ''
    if not title:
        title = 'Мультиэкран'
    return {
        'id': preset_id,
        'title': title[:120],
        'layout': layout,
        'transition_ms': _clamp(data.get('transition_ms', 700), 200, 5000, 700),
        'reveal': _choice(data.get('reveal'), MOSAIC_REVEALS, 'all'),
        'stagger_ms': _clamp(data.get('stagger_ms', 400), 0, 10_000, 400),
        'expandable_slots': _normalize_expandable_slots(data.get('expandable_slots'), slot_ids),
        'screens': [
            normalize_mosaic_screen(
                by_id.get(sid),
                sid,
                default_label=f'Экран {sid.upper()}',
                allowed_stage_ids=allowed_stage_ids,
            )
            for sid in slot_ids
        ],
    }


def normalize_scenario_mosaic(raw, allowed_stage_ids=None):
    """Библиотека пресетов мультиэкрана на уровне сценария."""
    data = raw if isinstance(raw, dict) else {}

    if isinstance(data.get('presets'), list) or 'active_preset_id' in data:
        presets = []
        seen = set()
        for item in (data.get('presets') or []):
            preset = normalize_mosaic_preset(item, allowed_stage_ids=allowed_stage_ids)
            if preset['id'] in seen:
                preset['id'] = _new_preset_id()
            seen.add(preset['id'])
            presets.append(preset)
        active = data.get('active_preset_id')
        active = str(active).strip()[:80] if active else None
        if active and active not in seen:
            active = presets[0]['id'] if presets else None
        elif not active and presets:
            active = presets[0]['id']
        return {'presets': presets, 'active_preset_id': active}

    if data.get('layout') or data.get('slots') or data.get('enabled'):
        legacy = normalize_mosaic_preset({
            'id': 'legacy-default',
            'title': 'Мультиэкран',
            'layout': data.get('layout') or '2x2',
            'transition_ms': data.get('transition_ms', 700),
            'reveal': 'all',
            'slots': data.get('slots') or [],
        }, allowed_stage_ids=allowed_stage_ids)
        keep = bool(data.get('enabled') or data.get('slots'))
        return {
            'presets': [legacy] if keep else [],
            'active_preset_id': legacy['id'] if data.get('enabled') else (legacy['id'] if keep else None),
        }

    return dict(DEFAULT_MOSAIC)


def _normalize_expandable_slots(raw, slot_ids):
    allowed = tuple(slot_ids)
    if raw is None:
        return list(allowed)
    if not isinstance(raw, list):
        return list(allowed)
    picked = {str(item).strip().lower() for item in raw if item is not None}
    return [sid for sid in allowed if sid in picked]


def normalize_sequence_mosaic_action(raw):
    value = str(raw or '').strip()
    aliases = {
        'focus_slot': 'expand',
        'show_slot': 'expand',
        'exit': 'collapse',
    }
    value = aliases.get(value, value)
    return _choice(value, SEQUENCE_MOSAIC_ACTIONS, 'show_grid')


def normalize_mosaic_slot_id(raw):
    value = str(raw or '').strip().lower()
    return value if value in MOSAIC_SLOT_IDS else None


def normalize_sequence_transition(raw, default_effect='none'):
    data = raw if isinstance(raw, dict) else {}
    return {
        'effect': _choice(data.get('effect'), SEQUENCE_TRANSITION_EFFECTS, default_effect),
        'duration_ms': _clamp(data.get('duration_ms', DEFAULT_SEQUENCE_TRANSITION['duration_ms']), 0, 20_000, 400),
    }


def normalize_sequence_item(raw, index=0, allowed_stage_ids=None, allowed_preset_ids=None):
    data = raw if isinstance(raw, dict) else {}
    item_type = _choice(data.get('type'), SEQUENCE_TYPES, 'stage')
    stage_id = _optional_id(data.get('stage_id'))
    preset_id = _optional_id(data.get('preset_id'))
    if allowed_stage_ids is not None and stage_id and stage_id not in allowed_stage_ids:
        stage_id = None
    if allowed_preset_ids is not None and preset_id and preset_id not in allowed_preset_ids:
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
    if item_type == 'mosaic':
        mosaic_action = normalize_sequence_mosaic_action(data.get('mosaic_action'))
        slot = normalize_mosaic_slot_id(data.get('slot'))
        if mosaic_action == 'show_grid':
            slot = None
    return {
        'key': key,
        'type': item_type,
        'stage_id': stage_id if item_type == 'stage' else None,
        'preset_id': preset_id if item_type == 'mosaic' else None,
        'mosaic_action': mosaic_action,
        'slot': slot,
        'duration_ms': duration_ms,
        'wait_for_presenter': _as_bool(data.get('wait_for_presenter'), False),
        'enter': normalize_sequence_transition(data.get('enter')),
        'exit': normalize_sequence_transition(data.get('exit')),
    }


def normalize_scenario_sequence(raw, allowed_stage_ids=None, allowed_preset_ids=None):
    items = raw if isinstance(raw, list) else []
    return [
        normalize_sequence_item(
            item,
            index,
            allowed_stage_ids=allowed_stage_ids,
            allowed_preset_ids=allowed_preset_ids,
        )
        for index, item in enumerate(items)
        if isinstance(item, dict)
    ]


def normalize_step_mosaic(raw, allowed_slot_ids=None):
    """Устаревшее поле park на шаге — всегда пустая заглушка."""
    return dict(DEFAULT_STEP_MOSAIC)


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
            next_screens.append(mapped)
        next_presets.append({**preset, 'screens': next_screens})
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
def replace_demo_scenario_library(scenario, stages_data, sequence_data=None, mosaic_data=None):
    """
    Атомарная замена библиотеки этапов, шагов и программы показа.
    stages_data: список {id?, title, steps: [...]}.
    Локальные id с клиента (не UUID) переписываются на новые и проставляются
    в sequence и слоты мультиэкрана.
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
    sequence_raw = sequence_data if sequence_data is not None else scenario.sequence
    mosaic = normalize_scenario_mosaic(
        _remap_mosaic_stage_ids(mosaic_raw, id_map),
        allowed_stage_ids=stage_ids,
    )
    preset_ids = {preset['id'] for preset in mosaic.get('presets') or []}
    sequence = normalize_scenario_sequence(
        _remap_sequence_stage_ids(sequence_raw, id_map),
        allowed_stage_ids=stage_ids,
        allowed_preset_ids=preset_ids,
    )
    scenario.mosaic = mosaic
    scenario.sequence = sequence
    scenario.save(update_fields=['mosaic', 'sequence'])

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

