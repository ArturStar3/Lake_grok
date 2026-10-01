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

from .demo_scenario_common import (

    DEFAULT_TEXT_ENTER,

    DEFAULT_TEXT_EXIT,

    DEFAULT_TEXT_STYLE,

    EASINGS,

    TEXT_ALIGNS,

    TEXT_ANCHORS,

    TEXT_DIRECTIONS,

    TEXT_ENTER_EFFECTS,

    TEXT_EXIT_EFFECTS,

    TEXT_FONT_FAMILIES,

    TEXT_FONT_WEIGHTS,

    TEXT_MAX_LENGTH,

    _as_bool,

    _choice,

    _clamp,

    _clamp_float,

    _color,

)


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
        'persist_until_click': _as_bool(data.get('persist_until_click'), False),
        'hide_when_expanded': _as_bool(data.get('hide_when_expanded'), False),
        'style': _normalize_text_style(data.get('style')),
        'enter': _normalize_text_transition(data.get('enter'), DEFAULT_TEXT_ENTER, TEXT_ENTER_EFFECTS),
        'exit': _normalize_text_transition(data.get('exit'), DEFAULT_TEXT_EXIT, TEXT_EXIT_EFFECTS),
    }


