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
MOSAIC_EXPAND_ANIMATIONS = ('stretch', 'center_then_stretch')
MOSAIC_ACTIONS = ('show_grid', 'show_slot', 'focus_slot', 'collapse', 'exit')
SEQUENCE_MOSAIC_ACTIONS = ('show_grid', 'expand', 'collapse')
SEQUENCE_TYPES = ('stage', 'mosaic', 'tableau')
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
DEFAULT_TABLEAU = {
    'presets': [],
    'active_preset_id': None,
    'blocks': [],
}
DEFAULT_TABLEAU_TILT = {
    'perspective': 1200,
    'rotate_x': 58,
    'rotate_z': -8,
    'scale': 0.92,
    'offset_y': 0.0,
}
DEFAULT_TABLEAU_CAPTION = {
    'content': '',
    'x': 50.0,
    'y': 6.0,
    'font_family': 'Roboto',
    'font_size': 17.0,
    'font_weight': 700,
    'color': '#f8fafc',
    'background': 'rgba(15, 23, 42, 0.55)',
    'border': {
        'color': 'rgba(255, 255, 255, 0.28)',
        'width': 1.0,
    },
}
DEFAULT_TABLEAU_BORDER_RADIUS = 14
DEFAULT_TABLEAU_TILT_MS = 700
DEFAULT_TABLEAU_UNTILT_MS = 700
DEFAULT_TABLEAU_BLOCK_FILL = {'color': 'rgba(15,23,42,0.55)', 'opacity': 1.0}
DEFAULT_TABLEAU_BLOCK_BORDER = {'color': 'rgba(255,255,255,0.28)', 'width': 1.0, 'opacity': 1.0}
TABLEAU_ARROW_LINES = ('solid', 'dashed', 'dotted')
TABLEAU_ARROW_HEADS = ('end', 'none', 'both')
TABLEAU_EDGES = ('top', 'right', 'bottom', 'left')
# Рамка карты при показе (centered 88%×78%).
TABLEAU_MAP_FRAME = {'left': 6.0, 'top': 11.0, 'width': 88.0, 'height': 78.0}
DEFAULT_TABLEAU_ARROW = {
    'line': 'dashed',
    'width': 1.5,
    'color': 'rgba(248,250,252,0.88)',
    'head': 'end',
    'block_edge': 'bottom',
}
TABLEAU_CELL_ROLES = ('card', 'bridge')
TABLEAU_CELL_ALIGNS = ('start', 'center', 'end')
DEFAULT_TABLEAU_OVERLAY = {
    'cols': 5,
    'rows': 2,
    'x': 4.0,
    'y': 2.0,
    'width': 92.0,
    'height': 36.0,
    'column_gap': 1.2,
    'row_gap': 1.2,
    'row_heights': [1.0, 1.0],
    'cells': [
        {'id': 'cell-0-0', 'row': 0, 'col': 0, 'col_span': 1, 'role': 'card', 'block_id': None, 'content_width': 100.0, 'content_height': 100.0, 'align_x': 'center', 'align_y': 'center', 'offset_top': 0.0},
        {'id': 'cell-0-1', 'row': 0, 'col': 1, 'col_span': 1, 'role': 'card', 'block_id': None, 'content_width': 100.0, 'content_height': 100.0, 'align_x': 'center', 'align_y': 'center', 'offset_top': 0.0},
        {'id': 'cell-0-2', 'row': 0, 'col': 2, 'col_span': 1, 'role': 'card', 'block_id': None, 'content_width': 100.0, 'content_height': 100.0, 'align_x': 'center', 'align_y': 'center', 'offset_top': 0.0},
        {'id': 'cell-0-3', 'row': 0, 'col': 3, 'col_span': 1, 'role': 'card', 'block_id': None, 'content_width': 100.0, 'content_height': 100.0, 'align_x': 'center', 'align_y': 'center', 'offset_top': 0.0},
        {'id': 'cell-0-4', 'row': 0, 'col': 4, 'col_span': 1, 'role': 'card', 'block_id': None, 'content_width': 100.0, 'content_height': 100.0, 'align_x': 'center', 'align_y': 'center', 'offset_top': 0.0},
        {'id': 'cell-1-1', 'row': 1, 'col': 1, 'col_span': 3, 'role': 'bridge', 'block_id': None, 'content_width': 100.0, 'content_height': 100.0, 'align_x': 'center', 'align_y': 'center', 'offset_top': 0.0},
    ],
    'map_arrow': {
        'inset': 14.0,
        'line': 'dashed',
        'width': 1.5,
        'color': 'rgba(248,250,252,0.88)',
        'head': 'end',
    },
}
DEFAULT_TABLEAU_MAP_REVEAL = {
    'lifetime_ms': 3500,
    'spawn_gap_min_ms': 0,
    'spawn_gap_max_ms': 1000,
}
DEFAULT_TABLEAU_CAMERA = {
    'mode': 'fly_to',
    'lat': None,
    'lng': None,
    'zoom': 8,
    'duration_ms': 1500,
    'ease_linearity': 0.3,
    'padding': 72,
}
TABLEAU_VARIANTS = ('tablet', 'gallery')
TABLEAU_GALLERY_ENTER = (
    'center_zoom', 'fade_scale', 'slide_up', 'slide_left', 'slide_right', 'blur_in',
    'from_object',
)
TABLEAU_GALLERY_EXIT = ('fade', 'fade_scale', 'slide_out')
TABLEAU_GALLERY_SETTLE = ('row', 'row_fit', 'overlap', 'free')
TABLEAU_GALLERY_MAX_IMAGES = 6
DEFAULT_TABLEAU_GALLERY = {
    'show_map': True,
    'stagger_ms': 160,
    'enter_ms': 600,
    'hold_ms': 800,
    'exit_ms': 420,
    'enter_effect': 'center_zoom',
    'exit_effect': 'fade_scale',
    'settle': 'free',
    'settle_ms': 520,
    'band': {'x': 6, 'y': 8, 'width': 88, 'height': 42},
    'gap_pct': 1.2,
    'overlap_offset_pct': 4,
    'overlap_rotate_deg': 3,
    'images': [],
}
MOSAIC_CONTENT_TYPES = ('stage', 'video')
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


def _clamp_float(value, low, high, fallback):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(low, min(high, number))


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


def normalize_tableau_camera(raw):
    data = raw if isinstance(raw, dict) else {}
    merged = {**DEFAULT_TABLEAU_CAMERA, **data, 'mode': 'fly_to'}
    camera = normalize_camera(merged)
    camera['mode'] = 'fly_to'
    return camera


def normalize_tableau_map_reveal(raw):
    data = raw if isinstance(raw, dict) else {}
    min_gap = _clamp(
        data.get('spawn_gap_min_ms', DEFAULT_TABLEAU_MAP_REVEAL['spawn_gap_min_ms']),
        0, 1000, DEFAULT_TABLEAU_MAP_REVEAL['spawn_gap_min_ms'],
    )
    max_gap = _clamp(
        data.get('spawn_gap_max_ms', DEFAULT_TABLEAU_MAP_REVEAL['spawn_gap_max_ms']),
        0, 1000, DEFAULT_TABLEAU_MAP_REVEAL['spawn_gap_max_ms'],
    )
    return {
        'lifetime_ms': _clamp(
            data.get('lifetime_ms', DEFAULT_TABLEAU_MAP_REVEAL['lifetime_ms']),
            500, 60_000, DEFAULT_TABLEAU_MAP_REVEAL['lifetime_ms'],
        ),
        'spawn_gap_min_ms': min(min_gap, max_gap),
        'spawn_gap_max_ms': max(min_gap, max_gap),
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
        'content_type': _choice(data.get('content_type'), MOSAIC_CONTENT_TYPES, 'stage'),
        'video_url': (
            str(data.get('video_url')).strip()[:2000]
            if isinstance(data.get('video_url'), str) and data.get('video_url').strip()
            else None
        ),
        'video_media_id': _optional_id(data.get('video_media_id')),
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
    transition_ms = _clamp(data.get('transition_ms', 700), 200, 5000, 700)
    return {
        'id': preset_id,
        'title': title[:120],
        'layout': layout,
        'transition_ms': transition_ms,
        'expand_animation': _choice(
            data.get('expand_animation'),
            MOSAIC_EXPAND_ANIMATIONS,
            'stretch',
        ),
        'expand_ms': _clamp(data.get('expand_ms', transition_ms), 200, 5000, transition_ms),
        'collapse_ms': _clamp(data.get('collapse_ms', transition_ms), 200, 5000, transition_ms),
        'expand_easing': _choice(data.get('expand_easing'), EASINGS, 'ease_out'),
        'collapse_easing': _choice(data.get('collapse_easing'), EASINGS, 'ease_out'),
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


def _optional_mosaic_expand_animation(raw):
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None
    value = _choice(raw, MOSAIC_EXPAND_ANIMATIONS, None)
    return value


def _optional_mosaic_ms(raw):
    if raw is None or raw == '' or raw == 0:
        return None
    try:
        number = int(raw)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    return _clamp(number, 200, 5000, None)


def _optional_mosaic_easing(raw):
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return None
    return _choice(raw, EASINGS, None)


def normalize_tableau_tilt(raw):
    data = raw if isinstance(raw, dict) else {}
    return {
        'perspective': _clamp(
            data.get('perspective', DEFAULT_TABLEAU_TILT['perspective']),
            400, 4000, DEFAULT_TABLEAU_TILT['perspective'],
        ),
        'rotate_x': _clamp_float(
            data.get('rotate_x', DEFAULT_TABLEAU_TILT['rotate_x']),
            0, 80, DEFAULT_TABLEAU_TILT['rotate_x'],
        ),
        'rotate_z': _clamp_float(
            data.get('rotate_z', DEFAULT_TABLEAU_TILT['rotate_z']),
            -45, 45, DEFAULT_TABLEAU_TILT['rotate_z'],
        ),
        'scale': _clamp_float(
            data.get('scale', DEFAULT_TABLEAU_TILT['scale']),
            0.4, 1.2, DEFAULT_TABLEAU_TILT['scale'],
        ),
        'offset_y': _clamp_float(
            data.get('offset_y', DEFAULT_TABLEAU_TILT['offset_y']),
            -30, 30, DEFAULT_TABLEAU_TILT['offset_y'],
        ),
    }


def normalize_tableau_caption(raw):
    data = raw if isinstance(raw, dict) else {}
    content = data.get('content') if isinstance(data.get('content'), str) else ''
    content = content.strip()[:500]
    border_raw = data.get('border') if isinstance(data.get('border'), dict) else {}
    weight_raw = data.get('font_weight', DEFAULT_TABLEAU_CAPTION['font_weight'])
    try:
        weight = int(float(weight_raw))
    except (TypeError, ValueError):
        weight = DEFAULT_TABLEAU_CAPTION['font_weight']
    weight = min(TEXT_FONT_WEIGHTS, key=lambda item: abs(item - weight))
    return {
        'content': content,
        'x': _clamp_float(data.get('x', DEFAULT_TABLEAU_CAPTION['x']), 0, 100, DEFAULT_TABLEAU_CAPTION['x']),
        'y': _clamp_float(data.get('y', DEFAULT_TABLEAU_CAPTION['y']), 0, 100, DEFAULT_TABLEAU_CAPTION['y']),
        'font_family': _choice(
            data.get('font_family'),
            TEXT_FONT_FAMILIES,
            DEFAULT_TABLEAU_CAPTION['font_family'],
        ),
        'font_size': _clamp_float(
            data.get('font_size', DEFAULT_TABLEAU_CAPTION['font_size']),
            10, 96, DEFAULT_TABLEAU_CAPTION['font_size'],
        ),
        'font_weight': weight,
        'color': _color(data.get('color'), DEFAULT_TABLEAU_CAPTION['color']),
        'background': _color(data.get('background'), DEFAULT_TABLEAU_CAPTION['background']),
        'border': {
            'color': _color(border_raw.get('color'), DEFAULT_TABLEAU_CAPTION['border']['color']),
            'width': _clamp_float(
                border_raw.get('width', DEFAULT_TABLEAU_CAPTION['border']['width']),
                0, 12, DEFAULT_TABLEAU_CAPTION['border']['width'],
            ),
        },
    }


def _normalize_tableau_fill(raw):
    data = raw if isinstance(raw, dict) else {}
    return {
        'color': _color(data.get('color'), DEFAULT_TABLEAU_BLOCK_FILL['color']),
        'opacity': _clamp_float(
            data.get('opacity', DEFAULT_TABLEAU_BLOCK_FILL['opacity']),
            0, 1, DEFAULT_TABLEAU_BLOCK_FILL['opacity'],
        ),
    }


def _normalize_tableau_border(raw):
    data = raw if isinstance(raw, dict) else {}
    return {
        'color': _color(data.get('color'), DEFAULT_TABLEAU_BLOCK_BORDER['color']),
        'width': _clamp_float(
            data.get('width', DEFAULT_TABLEAU_BLOCK_BORDER['width']),
            0, 12, DEFAULT_TABLEAU_BLOCK_BORDER['width'],
        ),
        'opacity': _clamp_float(
            data.get('opacity', DEFAULT_TABLEAU_BLOCK_BORDER['opacity']),
            0, 1, DEFAULT_TABLEAU_BLOCK_BORDER['opacity'],
        ),
    }


def normalize_tableau_element(raw, index=0):
    data = raw if isinstance(raw, dict) else {}
    el_type = _choice(data.get('type'), ('text', 'image'), 'text')
    el_id = data.get('id')
    if not el_id or not str(el_id).strip():
        el_id = f'el-{index}-{uuid.uuid4().hex[:8]}'
    else:
        el_id = str(el_id).strip()[:80]
    base = {
        'id': el_id,
        'type': el_type,
        'x': _clamp_float(data.get('x', 8), 0, 100, 8.0),
        'y': _clamp_float(data.get('y', 8 + index * 12), 0, 100, 8.0),
        'w': _clamp_float(data.get('w', 84), 4, 100, 84.0),
        'h': _clamp_float(data.get('h', 20), 4, 100, 20.0),
    }
    if el_type == 'image':
        src = data.get('src') if isinstance(data.get('src'), str) else ''
        src = src.strip()[:500]
        return {
            **base,
            'src': src,
            'rotation': _clamp_float(data.get('rotation', 0), -180.0, 180.0, 0.0),
        }
    content = data.get('content') if isinstance(data.get('content'), str) else ''
    content = content[:2000]
    return {
        **base,
        'content': content,
        'style': _normalize_text_style(data.get('style')),
    }


def normalize_tableau_block(raw, index=0):
    data = raw if isinstance(raw, dict) else {}
    block_id = data.get('id')
    if not block_id or not str(block_id).strip():
        block_id = f'block-{index}-{uuid.uuid4().hex[:8]}'
    else:
        block_id = str(block_id).strip()[:80]
    title = data.get('title') if isinstance(data.get('title'), str) else ''
    if not title:
        title = f'Блок {index + 1}'
    elements_raw = data.get('elements') if isinstance(data.get('elements'), list) else []
    elements = []
    seen = set()
    for el_index, item in enumerate(elements_raw[:40]):
        element = normalize_tableau_element(item, el_index)
        if element['id'] in seen:
            element['id'] = f'el-{el_index}-{uuid.uuid4().hex[:8]}'
        seen.add(element['id'])
        elements.append(element)
    return {
        'id': block_id,
        'title': title[:200],
        'width': _clamp_float(data.get('width', 22), 8, 80, 22.0),
        'height': _clamp_float(data.get('height', 28), 8, 70, 28.0),
        'border_radius_px': _clamp(
            data.get('border_radius_px', 12), 0, 48, 12,
        ),
        'fill': _normalize_tableau_fill(data.get('fill')),
        'border': _normalize_tableau_border(data.get('border')),
        'elements': elements,
    }


def normalize_tableau_placement(raw, index=0, allowed_block_ids=None):
    data = raw if isinstance(raw, dict) else {}
    placement_id = data.get('id')
    if not placement_id or not str(placement_id).strip():
        placement_id = f'place-{index}-{uuid.uuid4().hex[:8]}'
    else:
        placement_id = str(placement_id).strip()[:80]
    block_id = _optional_id(data.get('block_id'))
    if allowed_block_ids is not None and block_id and block_id not in allowed_block_ids:
        block_id = None
    width = None
    if data.get('width') is not None:
        width = _clamp_float(data.get('width'), 8, 80, 22.0)
    height = None
    if data.get('height') is not None:
        height = _clamp_float(data.get('height'), 8, 70, 28.0)
    return {
        'id': placement_id,
        'block_id': block_id,
        'x': _clamp_float(data.get('x', 20 + index * 12), 0, 100, 20.0),
        'y': _clamp_float(data.get('y', 12 + (index % 3) * 14), 0, 100, 12.0),
        'width': width,
        'height': height,
    }


def normalize_tableau_arrow(raw, index=0):
    data = raw if isinstance(raw, dict) else {}
    arrow_id = data.get('id')
    if not arrow_id or not str(arrow_id).strip():
        arrow_id = f'arrow-{index}-{uuid.uuid4().hex[:8]}'
    else:
        arrow_id = str(arrow_id).strip()[:80]
    return {
        'id': arrow_id,
        'placement_id': _optional_id(data.get('placement_id')),
        'block_edge': _choice(
            data.get('block_edge'),
            TABLEAU_EDGES,
            DEFAULT_TABLEAU_ARROW['block_edge'],
        ),
        'map_anchor_id': _optional_id(data.get('map_anchor_id')),
        'line': _choice(data.get('line'), TABLEAU_ARROW_LINES, DEFAULT_TABLEAU_ARROW['line']),
        'width': _clamp_float(
            data.get('width', DEFAULT_TABLEAU_ARROW['width']),
            0.5, 8, DEFAULT_TABLEAU_ARROW['width'],
        ),
        'color': _color(data.get('color'), DEFAULT_TABLEAU_ARROW['color']),
        'head': _choice(data.get('head'), TABLEAU_ARROW_HEADS, DEFAULT_TABLEAU_ARROW['head']),
    }


def normalize_tableau_map_anchor(raw, index=0):
    data = raw if isinstance(raw, dict) else {}
    anchor_id = data.get('id')
    if not anchor_id or not str(anchor_id).strip():
        anchor_id = f'anchor-{index}-{uuid.uuid4().hex[:8]}'
    else:
        anchor_id = str(anchor_id).strip()[:80]
    return {
        'id': anchor_id,
        'edge': _choice(data.get('edge'), TABLEAU_EDGES, 'bottom'),
        't': _clamp_float(data.get('t', 0.5), 0, 1, 0.5),
    }


def normalize_tableau_overlay_cell(raw, index=0, cols=5, rows=2, allowed_block_ids=None):
    data = raw if isinstance(raw, dict) else {}
    cell_id = data.get('id')
    if not cell_id or not str(cell_id).strip():
        cell_id = f'cell-{index}-{uuid.uuid4().hex[:8]}'
    else:
        cell_id = str(cell_id).strip()[:80]
    col_max = max(1, cols) - 1
    row_max = max(1, rows) - 1
    col = _clamp(data.get('col', min(index, col_max)), 0, col_max, min(index, col_max))
    row = _clamp(data.get('row', 0), 0, row_max, 0)
    max_span = max(1, cols - col)
    col_span = _clamp(data.get('col_span', 1), 1, max_span, 1)
    block_id = _optional_id(data.get('block_id'))
    if allowed_block_ids is not None and block_id and block_id not in allowed_block_ids:
        block_id = None
    return {
        'id': cell_id,
        'row': row,
        'col': col,
        'col_span': col_span,
        'role': _choice(data.get('role'), TABLEAU_CELL_ROLES, 'card'),
        'block_id': block_id,
        'content_width': _clamp_float(data.get('content_width', 100), 20, 100, 100),
        'content_height': _clamp_float(data.get('content_height', 100), 20, 100, 100),
        'align_x': _choice(data.get('align_x'), TABLEAU_CELL_ALIGNS, 'center'),
        'align_y': _choice(data.get('align_y'), TABLEAU_CELL_ALIGNS, 'center'),
        'offset_top': _clamp_float(data.get('offset_top', 0), 0, 40, 0),
    }


def normalize_tableau_row_heights(raw, rows):
    count = max(1, rows)
    items = raw if isinstance(raw, list) else []
    heights = []
    for index in range(count):
        value = items[index] if index < len(items) else 1
        heights.append(_clamp_float(value, 0.2, 10, 1))
    return heights


def normalize_tableau_overlay_map_arrow(raw):
    data = raw if isinstance(raw, dict) else {}
    defaults = DEFAULT_TABLEAU_OVERLAY['map_arrow']
    return {
        'inset': _clamp_float(data.get('inset', defaults['inset']), 0, 40, defaults['inset']),
        'line': _choice(data.get('line'), TABLEAU_ARROW_LINES, defaults['line']),
        'width': _clamp_float(data.get('width', defaults['width']), 0.5, 8, defaults['width']),
        'color': _color(data.get('color'), defaults['color']),
        'head': _choice(data.get('head'), TABLEAU_ARROW_HEADS, defaults['head']),
    }


def migrate_placements_to_overlay(placements, allowed_block_ids=None):
    items = [p for p in (placements or []) if isinstance(p, dict)]
    if not items:
        return normalize_tableau_overlay(DEFAULT_TABLEAU_OVERLAY, allowed_block_ids)
    cols = _clamp(len(items), 1, 8, min(len(items), 8))
    cells = []
    for index, placement in enumerate(items[:cols]):
        cells.append(normalize_tableau_overlay_cell({
            'id': f'cell-from-{placement.get("id") or index}',
            'row': 0,
            'col': index,
            'col_span': 1,
            'role': 'card',
            'block_id': placement.get('block_id'),
        }, index, cols, 1, allowed_block_ids))
    return normalize_tableau_overlay({
        'cols': cols,
        'rows': 1,
        'x': 4,
        'y': 4,
        'width': 92,
        'height': 28,
        'column_gap': 1.2,
        'row_gap': 1.2,
        'row_heights': [1.0],
        'cells': cells,
        'map_arrow': dict(DEFAULT_TABLEAU_OVERLAY['map_arrow']),
    }, allowed_block_ids)


def normalize_tableau_overlay(raw, allowed_block_ids=None):
    data = raw if isinstance(raw, dict) else {}
    cols = _clamp(data.get('cols', DEFAULT_TABLEAU_OVERLAY['cols']), 1, 8, DEFAULT_TABLEAU_OVERLAY['cols'])
    rows = _clamp(data.get('rows', DEFAULT_TABLEAU_OVERLAY['rows']), 1, 4, DEFAULT_TABLEAU_OVERLAY['rows'])
    legacy_gap = (
        _clamp_float(data.get('gap'), 0, 40, DEFAULT_TABLEAU_OVERLAY['column_gap'])
        if data.get('gap') is not None
        else DEFAULT_TABLEAU_OVERLAY['column_gap']
    )
    column_gap = _clamp_float(
        data.get('column_gap', legacy_gap), 0, 40, DEFAULT_TABLEAU_OVERLAY['column_gap'],
    )
    row_gap = _clamp_float(
        data.get('row_gap', legacy_gap), 0, 40, DEFAULT_TABLEAU_OVERLAY['row_gap'],
    )
    cells_raw = data.get('cells') if isinstance(data.get('cells'), list) else []
    cells = []
    seen = set()
    bridge_count = 0
    for index, item in enumerate(cells_raw[: cols * rows + 8]):
        cell = normalize_tableau_overlay_cell(item, index, cols, rows, allowed_block_ids)
        if cell['col'] + cell['col_span'] > cols:
            cell['col_span'] = max(1, cols - cell['col'])
        if cell['role'] == 'bridge':
            if bridge_count >= 1:
                cell['role'] = 'card'
            else:
                bridge_count += 1
        if cell['id'] in seen:
            cell['id'] = f'cell-{index}-{uuid.uuid4().hex[:8]}'
        seen.add(cell['id'])
        cells.append(cell)
    return {
        'cols': cols,
        'rows': rows,
        'x': _clamp_float(data.get('x', DEFAULT_TABLEAU_OVERLAY['x']), 0, 100, DEFAULT_TABLEAU_OVERLAY['x']),
        'y': _clamp_float(data.get('y', DEFAULT_TABLEAU_OVERLAY['y']), 0, 90, DEFAULT_TABLEAU_OVERLAY['y']),
        'width': _clamp_float(
            data.get('width', DEFAULT_TABLEAU_OVERLAY['width']), 10, 100, DEFAULT_TABLEAU_OVERLAY['width'],
        ),
        'height': _clamp_float(
            data.get('height', DEFAULT_TABLEAU_OVERLAY['height']), 8, 95, DEFAULT_TABLEAU_OVERLAY['height'],
        ),
        'column_gap': column_gap,
        'row_gap': row_gap,
        'row_heights': normalize_tableau_row_heights(data.get('row_heights'), rows),
        'cells': cells,
        'map_arrow': normalize_tableau_overlay_map_arrow(data.get('map_arrow')),
    }


def _legacy_card_to_block_and_placement(card, index):
    """Старый формат cards → шаблон блока + placement."""
    title = card.get('title') or f'Блок {index + 1}'
    items = card.get('items') or []
    lines = [title] + [f'• {item}' for item in items]
    content = '\n'.join(lines)
    block_id = f'legacy-block-{card.get("id") or index}'
    block = normalize_tableau_block({
        'id': block_id,
        'title': title,
        'width': 22,
        'height': 28,
        'border_radius_px': 12,
        'elements': [{
            'type': 'text',
            'id': f'legacy-text-{index}',
            'content': content,
            'x': 8,
            'y': 8,
            'w': 84,
            'h': 84,
            'style': {
                'font_size': 14,
                'font_weight': 600,
                'text_align': 'left',
                'color': '#f8fafc',
            },
        }],
    }, index)
    placement = normalize_tableau_placement({
        'id': f'legacy-place-{card.get("id") or index}',
        'block_id': block_id,
        'x': card.get('x', 20),
        'y': card.get('y', 12),
        'width': 22,
        'height': 28,
    }, index, allowed_block_ids={block_id})
    return block, placement


def normalize_tableau_gallery_band(raw):
    data = raw if isinstance(raw, dict) else {}
    defaults = DEFAULT_TABLEAU_GALLERY['band']
    return {
        'x': _clamp_float(data.get('x', defaults['x']), 0, 92, defaults['x']),
        'y': _clamp_float(data.get('y', defaults['y']), 0, 90, defaults['y']),
        'width': _clamp_float(data.get('width', defaults['width']), 12, 100, defaults['width']),
        'height': _clamp_float(data.get('height', defaults['height']), 10, 90, defaults['height']),
    }


def normalize_tableau_gallery_image(raw, index=0):
    data = raw if isinstance(raw, dict) else {}
    image_id = data.get('id')
    if not image_id or not str(image_id).strip():
        image_id = f'gimg-{index}-{uuid.uuid4().hex[:8]}'
    else:
        image_id = str(image_id).strip()[:80]
    src = data.get('src') if isinstance(data.get('src'), str) else ''
    src = src.strip()[:2000]
    title = data.get('title') if isinstance(data.get('title'), str) else ''
    rest_raw = data.get('rest') if isinstance(data.get('rest'), dict) else {}
    return {
        'id': image_id,
        'src': src,
        'title': title.strip()[:120],
        'target_id': _optional_id(data.get('target_id')),
        'rest': {
            'x': _clamp_float(rest_raw.get('x', 10 + (index % 3) * 24), 0, 100, 10 + (index % 3) * 24),
            'y': _clamp_float(rest_raw.get('y', 10 + (index // 3) * 28), 0, 100, 10 + (index // 3) * 28),
            'w': _clamp_float(rest_raw.get('w', 22), 4, 100, 22),
            'h': _clamp_float(rest_raw.get('h', 28), 4, 100, 28),
        },
    }


def normalize_tableau_gallery(raw):
    data = raw if isinstance(raw, dict) else {}
    images = []
    seen = set()
    incoming = data.get('images') if isinstance(data.get('images'), list) else []
    for index, item in enumerate(incoming[:TABLEAU_GALLERY_MAX_IMAGES]):
        image = normalize_tableau_gallery_image(item, index)
        if not image['src']:
            continue
        if image['id'] in seen:
            image['id'] = f'gimg-{index}-{uuid.uuid4().hex[:8]}'
        seen.add(image['id'])
        images.append(image)
    return {
        'show_map': _as_bool(data.get('show_map'), DEFAULT_TABLEAU_GALLERY['show_map']),
        'stagger_ms': _clamp(
            data.get('stagger_ms', DEFAULT_TABLEAU_GALLERY['stagger_ms']),
            0, 8000, DEFAULT_TABLEAU_GALLERY['stagger_ms'],
        ),
        'enter_ms': _clamp(
            data.get('enter_ms', DEFAULT_TABLEAU_GALLERY['enter_ms']),
            120, 2000, DEFAULT_TABLEAU_GALLERY['enter_ms'],
        ),
        'hold_ms': _clamp(
            data.get('hold_ms', DEFAULT_TABLEAU_GALLERY['hold_ms']),
            0, 8000, DEFAULT_TABLEAU_GALLERY['hold_ms'],
        ),
        'exit_ms': _clamp(
            data.get('exit_ms', DEFAULT_TABLEAU_GALLERY['exit_ms']),
            80, 2000, DEFAULT_TABLEAU_GALLERY['exit_ms'],
        ),
        'enter_effect': _choice(
            data.get('enter_effect'), TABLEAU_GALLERY_ENTER, DEFAULT_TABLEAU_GALLERY['enter_effect'],
        ),
        'exit_effect': _choice(
            data.get('exit_effect'), TABLEAU_GALLERY_EXIT, DEFAULT_TABLEAU_GALLERY['exit_effect'],
        ),
        'settle': _choice(
            data.get('settle'), TABLEAU_GALLERY_SETTLE, DEFAULT_TABLEAU_GALLERY['settle'],
        ),
        'settle_ms': _clamp(
            data.get('settle_ms', DEFAULT_TABLEAU_GALLERY['settle_ms']),
            0, 3000, DEFAULT_TABLEAU_GALLERY['settle_ms'],
        ),
        'band': normalize_tableau_gallery_band(data.get('band')),
        'gap_pct': _clamp_float(
            data.get('gap_pct', DEFAULT_TABLEAU_GALLERY['gap_pct']),
            0, 8, DEFAULT_TABLEAU_GALLERY['gap_pct'],
        ),
        'overlap_offset_pct': _clamp_float(
            data.get('overlap_offset_pct', DEFAULT_TABLEAU_GALLERY['overlap_offset_pct']),
            0.5, 16, DEFAULT_TABLEAU_GALLERY['overlap_offset_pct'],
        ),
        'overlap_rotate_deg': _clamp_float(
            data.get('overlap_rotate_deg', DEFAULT_TABLEAU_GALLERY['overlap_rotate_deg']),
            0, 12, DEFAULT_TABLEAU_GALLERY['overlap_rotate_deg'],
        ),
        'images': images,
    }


def normalize_tableau_preset(raw, allowed_stage_ids=None, allowed_block_ids=None):
    data = raw if isinstance(raw, dict) else {}
    preset_id = data.get('id')
    if not preset_id or not str(preset_id).strip():
        preset_id = _new_preset_id()
    else:
        preset_id = str(preset_id).strip()[:80]
    title = data.get('title') if isinstance(data.get('title'), str) else ''
    if not title:
        title = 'Художественный'
    stage_id = _optional_id(data.get('stage_id'))
    if allowed_stage_ids is not None and stage_id and stage_id not in allowed_stage_ids:
        stage_id = None

    placements_raw = data.get('placements') if isinstance(data.get('placements'), list) else []
    arrows_raw = data.get('arrows') if isinstance(data.get('arrows'), list) else []
    anchors_raw = data.get('map_anchors') if isinstance(data.get('map_anchors'), list) else []
    legacy_cards = data.get('cards') if isinstance(data.get('cards'), list) else []

    migrated_blocks = []
    if not placements_raw and legacy_cards:
        for index, card in enumerate(legacy_cards[:24]):
            if not isinstance(card, dict):
                continue
            block, placement = _legacy_card_to_block_and_placement(card, index)
            migrated_blocks.append(block)
            placements_raw.append(placement)
            anchor_id = f'legacy-anchor-{index}'
            anchors_raw.append({
                'id': anchor_id,
                'edge': 'bottom',
                't': _clamp_float(0.35 + (index % 4) * 0.12, 0, 1, 0.5),
            })
            arrows_raw.append({
                'id': f'legacy-arrow-{index}',
                'placement_id': placement['id'],
                'block_edge': 'bottom',
                'map_anchor_id': anchor_id,
                'line': 'dashed',
                'width': 1.5,
                'color': 'rgba(248,250,252,0.88)',
                'head': 'end',
            })

    block_ids = set(allowed_block_ids or [])
    for block in migrated_blocks:
        block_ids.add(block['id'])

    placements = []
    seen_p = set()
    for index, item in enumerate(placements_raw[:24]):
        placement = normalize_tableau_placement(
            item, index, allowed_block_ids=block_ids if block_ids else None,
        )
        if placement['id'] in seen_p:
            placement['id'] = f'place-{index}-{uuid.uuid4().hex[:8]}'
        seen_p.add(placement['id'])
        placements.append(placement)
    placement_ids = {item['id'] for item in placements}

    map_anchors = []
    seen_anchors = set()
    for index, item in enumerate(anchors_raw[:48]):
        anchor = normalize_tableau_map_anchor(item, index)
        if anchor['id'] in seen_anchors:
            anchor['id'] = f'anchor-{index}-{uuid.uuid4().hex[:8]}'
        seen_anchors.add(anchor['id'])
        map_anchors.append(anchor)
    anchor_ids = {item['id'] for item in map_anchors}

    arrows = []
    seen_a = set()
    for index, item in enumerate(arrows_raw[:40]):
        arrow = normalize_tableau_arrow(item, index)
        if not arrow.get('placement_id') or arrow['placement_id'] not in placement_ids:
            continue
        if not arrow.get('map_anchor_id') or arrow['map_anchor_id'] not in anchor_ids:
            continue
        if arrow['id'] in seen_a:
            arrow['id'] = f'arrow-{index}-{uuid.uuid4().hex[:8]}'
        seen_a.add(arrow['id'])
        arrows.append(arrow)

    return {
        'id': preset_id,
        'title': title[:120],
        'stage_id': stage_id,
        'variant': _choice(data.get('variant'), TABLEAU_VARIANTS, 'tablet'),
        'gallery': normalize_tableau_gallery(data.get('gallery')),
        'tilt': normalize_tableau_tilt(data.get('tilt')),
        'border_radius_px': _clamp(
            data.get('border_radius_px', DEFAULT_TABLEAU_BORDER_RADIUS),
            0, 48, DEFAULT_TABLEAU_BORDER_RADIUS,
        ),
        'tilt_ms': _clamp(
            data.get('tilt_ms', DEFAULT_TABLEAU_TILT_MS),
            200, 5000, DEFAULT_TABLEAU_TILT_MS,
        ),
        'untilt_ms': _clamp(
            data.get('untilt_ms', DEFAULT_TABLEAU_UNTILT_MS),
            200, 5000, DEFAULT_TABLEAU_UNTILT_MS,
        ),
        'caption': normalize_tableau_caption(data.get('caption')),
        'card_stagger_ms': _clamp(data.get('card_stagger_ms', 350), 0, 10_000, 350),
        'arrow_draw_ms': _clamp(data.get('arrow_draw_ms', 900), 100, 10_000, 900),
        'camera': normalize_tableau_camera(data.get('camera')),
        'map_reveal': normalize_tableau_map_reveal(data.get('map_reveal')),
        'overlay': (
            normalize_tableau_overlay(data.get('overlay'), block_ids if block_ids else None)
            if data.get('overlay') is not None
            else migrate_placements_to_overlay(placements, block_ids if block_ids else None)
        ),
        'placements': placements,
        'map_anchors': map_anchors,
        'arrows': arrows,
        '_migrated_blocks': migrated_blocks,
    }


def normalize_scenario_tableau(raw, allowed_stage_ids=None):
    """Библиотека пресетов и шаблонов блоков художественного режима."""
    data = raw if isinstance(raw, dict) else {}
    blocks_raw = data.get('blocks') if isinstance(data.get('blocks'), list) else []
    blocks = []
    seen_blocks = set()
    for index, item in enumerate(blocks_raw[:48]):
        block = normalize_tableau_block(item, index)
        if block['id'] in seen_blocks:
            block['id'] = f'block-{index}-{uuid.uuid4().hex[:8]}'
        seen_blocks.add(block['id'])
        blocks.append(block)

    presets = []
    seen = set()
    for item in (data.get('presets') or []):
        preset = normalize_tableau_preset(
            item,
            allowed_stage_ids=allowed_stage_ids,
            allowed_block_ids=seen_blocks,
        )
        migrated = preset.pop('_migrated_blocks', [])
        for block in migrated:
            if block['id'] not in seen_blocks:
                seen_blocks.add(block['id'])
                blocks.append(block)
        # Перенормализуем placements с полным набором block ids после миграции
        if migrated:
            preset['placements'] = [
                normalize_tableau_placement(p, i, allowed_block_ids=seen_blocks)
                for i, p in enumerate(preset.get('placements') or [])
            ]
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
    return {'presets': presets, 'active_preset_id': active, 'blocks': blocks}


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

