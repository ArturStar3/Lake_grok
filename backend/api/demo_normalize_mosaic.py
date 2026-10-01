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

from .demo_normalize_text import (

    normalize_text,

)

from .demo_scenario_common import (

    DEFAULT_MOSAIC,

    DEFAULT_SEQUENCE_TRANSITION,

    DEFAULT_STEP_MOSAIC,

    EASINGS,

    MOSAIC_CONTENT_TYPES,

    MOSAIC_EXPAND_ANIMATIONS,

    MOSAIC_LAYOUTS,

    MOSAIC_REVEALS,

    MOSAIC_SLOT_IDS,

    MOSAIC_SLOT_IDS_BY_LAYOUT,

    SEQUENCE_MOSAIC_ACTIONS,

    SEQUENCE_TRANSITION_EFFECTS,

    _as_bool,

    _choice,

    _clamp,

    _new_preset_id,

    _normalize_country_isos,

    _normalize_id_list,

    _normalize_zone_leaves,

    _optional_id,

    normalize_camera,

    normalize_cue,

)


def normalize_mosaic_screen(raw, slot_id, default_label='', allowed_stage_ids=None):
    data = raw if isinstance(raw, dict) else {}
    selection_raw = data.get('selection') if isinstance(data.get('selection'), dict) else {}
    label = data.get('label') if isinstance(data.get('label'), str) else ''
    if not label:
        label = default_label
    stage_id = _optional_id(data.get('stage_id'))
    if allowed_stage_ids is not None and stage_id and stage_id not in allowed_stage_ids:
        stage_id = None
    expand_stage_id = _optional_id(data.get('expand_stage_id'))
    if allowed_stage_ids is not None and expand_stage_id and expand_stage_id not in allowed_stage_ids:
        expand_stage_id = None
    if expand_stage_id and stage_id and expand_stage_id == stage_id:
        expand_stage_id = None
    return {
        'id': slot_id,
        'label': label[:120],
        'cue': normalize_cue(data.get('cue')),
        'loop': _as_bool(data.get('loop'), False),
        'stage_id': stage_id,
        'expand_stage_id': expand_stage_id,
        'content_type': _choice(data.get('content_type'), MOSAIC_CONTENT_TYPES, 'stage'),
        'video_url': (
            str(data.get('video_url')).strip()[:2000]
            if isinstance(data.get('video_url'), str) and data.get('video_url').strip()
            else None
        ),
        'video_media_id': _optional_id(data.get('video_media_id')),
        'image_url': (
            data['image_url'].strip()[:2000]
            if isinstance(data.get('image_url'), str) and data['image_url'].strip()
            else None
        ),
        'image_fit': _choice(data.get('image_fit'), ('contain', 'cover'), 'contain'),
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


def mosaic_screen_grid_stage_id(screen):
    if not isinstance(screen, dict):
        return None
    return _optional_id(screen.get('stage_id'))


def mosaic_screen_expand_stage_id(screen):
    if not isinstance(screen, dict):
        return None
    return _optional_id(screen.get('expand_stage_id')) or mosaic_screen_grid_stage_id(screen)


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


def normalize_step_mosaic(raw, allowed_slot_ids=None):
    """Устаревшее поле park на шаге — всегда пустая заглушка."""
    return dict(DEFAULT_STEP_MOSAIC)


