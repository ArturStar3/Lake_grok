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

    _normalize_text_style,

)

from .demo_scenario_common import (

    DEFAULT_TABLEAU_ARROW,

    DEFAULT_TABLEAU_BLOCK_BORDER,

    DEFAULT_TABLEAU_BLOCK_FILL,

    DEFAULT_TABLEAU_BORDER_RADIUS,

    DEFAULT_TABLEAU_CAPTION,

    DEFAULT_TABLEAU_GALLERY,

    DEFAULT_TABLEAU_OVERLAY,

    DEFAULT_TABLEAU_TILT,

    DEFAULT_TABLEAU_TILT_MS,

    DEFAULT_TABLEAU_UNTILT_MS,

    TABLEAU_ARROW_HEADS,

    TABLEAU_ARROW_LINES,

    TABLEAU_CELL_ALIGNS,

    TABLEAU_CELL_ROLES,

    TABLEAU_EDGES,

    TABLEAU_GALLERY_ENTER,

    TABLEAU_GALLERY_EXIT,

    TABLEAU_GALLERY_MAX_IMAGES,

    TABLEAU_GALLERY_SETTLE,

    TABLEAU_VARIANTS,

    TEXT_FONT_FAMILIES,

    TEXT_FONT_WEIGHTS,

    _as_bool,

    _choice,

    _clamp,

    _clamp_float,

    _color,

    _new_preset_id,

    _optional_id,

    normalize_cue,

    normalize_tableau_camera,

    normalize_tableau_map_reveal,

)


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
        'content_align_y': _choice(data.get('content_align_y'), TABLEAU_CELL_ALIGNS, 'center'),
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


def normalize_tableau_video(raw):
    data = raw if isinstance(raw, dict) else {}
    video_url = data.get('video_url') if isinstance(data.get('video_url'), str) else ''
    return {
        'video_url': video_url.strip()[:2000] or None,
        'video_media_id': _optional_id(data.get('video_media_id')),
        'object_fit': _choice(data.get('object_fit'), ('contain', 'cover'), 'cover'),
        'loop': _as_bool(data.get('loop'), True),
    }


def normalize_tableau_network(raw):
    data = raw if isinstance(raw, dict) else {}
    source_logos = data.get('logos') if isinstance(data.get('logos'), list) else []
    logos = []
    for index in range(3):
        item = source_logos[index] if index < len(source_logos) and isinstance(source_logos[index], dict) else {}
        src = item.get('src') if isinstance(item.get('src'), str) else ''
        title = item.get('title') if isinstance(item.get('title'), str) else ''
        logos.append({'src': src.strip()[:2000], 'title': title.strip()[:120]})
    return {'logos': logos}


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
        'cue': normalize_cue(data.get('cue')),
        'stage_id': stage_id,
        'variant': _choice(data.get('variant'), TABLEAU_VARIANTS, 'tablet'),
        'gallery': normalize_tableau_gallery(data.get('gallery')),
        'video': normalize_tableau_video(data.get('video')),
        'network': normalize_tableau_network(data.get('network')),
        'scanner': normalize_scanner(data.get('scanner')),
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


