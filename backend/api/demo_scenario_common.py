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

MOSAIC_LAYOUTS = ('1x2', '1x3', '2x1', '1+2', '2x2', '2x3', '2+3')
MOSAIC_SLOT_IDS_BY_LAYOUT = {
    '1x2': ('a', 'b'),
    '1x3': ('a', 'b', 'c'),
    '2x1': ('a', 'b'),
    '1+2': ('a', 'b', 'c'),
    '2x2': ('a', 'b', 'c', 'd'),
    '2x3': ('a', 'b', 'c', 'd', 'e', 'f'),
    '2+3': ('a', 'b', 'c', 'd', 'e'),
}
MOSAIC_REVEALS = ('all', 'stagger')
MOSAIC_EXPAND_ANIMATIONS = ('stretch', 'center_then_stretch', 'cover')
MOSAIC_ACTIONS = ('show_grid', 'show_slot', 'focus_slot', 'collapse', 'exit')
SEQUENCE_MOSAIC_ACTIONS = ('show_grid', 'expand', 'collapse')
SEQUENCE_TYPES = ('stage', 'mosaic', 'tableau')
SEQUENCE_TRANSITION_EFFECTS = ('none', 'fade', 'blackout', 'stagger')
MOSAIC_SLOT_IDS = ('a', 'b', 'c', 'd', 'e', 'f')
CUE_MIN = 1
CUE_MAX = 99
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
TABLEAU_VARIANTS = ('tablet', 'gallery', 'video', 'scanner', 'network')
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
DEFAULT_TABLEAU_VIDEO = {
    'video_url': None,
    'video_media_id': None,
    'object_fit': 'cover',
    'loop': True,
}
MOSAIC_CONTENT_TYPES = ('stage', 'video', 'image')
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
    if number != number:  # NaN
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


def _color(value, fallback):
    """Пропускает только безопасные CSS-цвета: #hex, rgb/rgba/hsl/hsla, ключевое слово."""
    if not isinstance(value, str):
        return fallback
    cleaned = value.strip()
    if not cleaned or len(cleaned) > 32 or not COLOR_RE.fullmatch(cleaned):
        return fallback
    return cleaned


def normalize_step_duration(value):
    return _clamp(value, MIN_STEP_DURATION_MS, MAX_STEP_DURATION_MS, DEFAULT_DEMO_STEP_DURATION_MS)


def _new_preset_id():
    return f'preset-{uuid.uuid4().hex[:12]}'


def _optional_id(value):
    if value in (None, ''):
        return None
    text = str(value).strip()
    return text[:80] if text else None


def normalize_cue(value):
    if value in (None, ''):
        return None
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    if number < CUE_MIN or number > CUE_MAX:
        return None
    return number


