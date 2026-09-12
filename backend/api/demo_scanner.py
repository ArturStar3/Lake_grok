"""Offline DOCX import and bounded, HTML-free scanner scene data."""

import re
from zipfile import BadZipFile, ZipFile

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from lxml.etree import XMLSyntaxError
from rest_framework.exceptions import ValidationError

MAX_CHARS = 60000
MAX_BLOCKS = 600
STYLE_ENUMS = {
    'fontWeight': ('normal', 'bold'), 'fontStyle': ('normal', 'italic'),
    'textDecoration': ('none', 'underline', 'line-through'),
    'textAlign': ('left', 'center', 'right', 'justify'),
    'verticalAlign': ('baseline', 'super', 'sub'),
}


def _items(raw, limit):
    return raw[:limit] if isinstance(raw, list) else []


def clean_style(raw):
    raw = raw if isinstance(raw, dict) else {}
    result = {k: v for k, v in raw.items() if k in STYLE_ENUMS and isinstance(v, str) and v in STYLE_ENUMS[k]}
    for key in ('color', 'backgroundColor'):
        if isinstance(raw.get(key), str) and re.fullmatch(r'#[0-9a-fA-F]{6}', raw[key]):
            result[key] = raw[key]
    if isinstance(raw.get('fontFamily'), str) and re.fullmatch(r'[\w ,\-]{1,80}', raw['fontFamily']):
        result['fontFamily'] = raw['fontFamily']
    for key in ('fontSize', 'marginTop', 'marginBottom', 'marginLeft', 'textIndent', 'lineHeight'):
        value = raw.get(key)
        if isinstance(value, str) and re.fullmatch(r'-?\d{1,3}(\.\d{1,2})?(pt|px|%)?', value):
            result[key] = value
    return result


def normalize_document(raw):
    raw = raw if isinstance(raw, dict) else {}
    remaining = MAX_CHARS
    count = 0

    def paragraph(item):
        nonlocal remaining, count
        count += 1
        if count > MAX_BLOCKS or not isinstance(item, dict):
            return {'type': 'paragraph', 'runs': [], 'style': {}}
        runs = []
        for run in _items(item.get('runs'), 1000):
            if not isinstance(run, dict) or remaining <= 0:
                continue
            value = str(run.get('text') or '')[:remaining]
            remaining -= len(value)
            runs.append({'text': value, 'style': clean_style(run.get('style'))})
        return {'type': 'paragraph', 'style': clean_style(item.get('style')), 'runs': runs}

    blocks = []
    for block in _items(raw.get('blocks'), MAX_BLOCKS):
        if not isinstance(block, dict) or count >= MAX_BLOCKS:
            continue
        if block.get('type') == 'table':
            rows = []
            for row in _items(block.get('rows'), 100):
                if not isinstance(row, list):
                    continue
                if count >= MAX_BLOCKS:
                    break
                rows.append([[paragraph(p) for p in _items(cell, min(30, max(0, MAX_BLOCKS - count)))] for cell in row[:20]])
            blocks.append({'type': 'table', 'rows': rows})
        else:
            blocks.append(paragraph(block))
    return {'name': str(raw.get('name') or '')[:200], 'blocks': blocks}


def normalize_scanner(raw):
    raw = raw if isinstance(raw, dict) else {}

    def number(key, default, low, high):
        try:
            return max(low, min(high, int(raw.get(key, default))))
        except (ValueError, TypeError, OverflowError):
            return default

    images = []
    for index, item in enumerate(_items(raw.get('images'), 40)):
        if not isinstance(item, dict):
            continue
        src = str(item.get('src') or '')
        # Store local media paths, never external runtime dependencies.
        if not re.fullmatch(r'/media/[\w./%\-]+', src) or '..' in src:
            continue
        images.append({'id': f'scan-{index}', 'src': src, 'title': str(item.get('title') or '')[:120]})
    minimum = number('scan_min_ms', 2200, 500, 15000)
    return {
        'images': images, 'document': normalize_document(raw.get('document')),
        'effect': raw.get('effect') if raw.get('effect') in ('letters', 'scramble', 'typewriter') else 'letters',
        'scan_min_ms': minimum, 'scan_max_ms': max(minimum, number('scan_max_ms', 4800, 500, 15000)),
        'characters_per_second': number('characters_per_second', 80, 10, 500),
        'header_left': (raw.get('header_left') if isinstance(raw.get('header_left'), str) else 'INFOLAKE / ДОКУМЕНТЫ')[:120],
        'header_right': (raw.get('header_right') if isinstance(raw.get('header_right'), str) else '{status}')[:120],
        'paper_meta': (raw.get('paper_meta') if isinstance(raw.get('paper_meta'), str) else 'INFOLAKE / {document}')[:200],
    }


def import_docx(upload):
    if not upload or not upload.name.lower().endswith('.docx'):
        raise ValidationError({'file': 'Выберите документ DOCX.'})
    if upload.size > 10 * 1024 * 1024:
        raise ValidationError({'file': 'Размер DOCX не должен превышать 10 МБ.'})
    try:
        with ZipFile(upload) as archive:
            entries = archive.infolist()
            if len(entries) > 2000 or sum(i.file_size for i in entries) > 40 * 1024 * 1024:
                raise ValidationError({'file': 'Слишком большой распакованный документ.'})
            if 'word/document.xml' not in archive.namelist():
                raise ValueError('Missing document')
        upload.seek(0)
        doc = Document(upload)
    except (BadZipFile, ValueError, KeyError, OSError, XMLSyntaxError) as exc:
        raise ValidationError({'file': 'Не удалось прочитать DOCX.'}) from exc

    def chain(style):
        seen = set()
        while style is not None and style.style_id not in seen:
            seen.add(style.style_id)
            yield style
            style = style.base_style

    def first(objects, attr):
        return next((getattr(obj, attr) for obj in objects if getattr(obj, attr) is not None), None)

    counters = {}

    def paragraph(p):
        formats = [p.paragraph_format] + [s.paragraph_format for s in chain(p.style)]
        style = {}
        align = first(formats, 'alignment')
        style['textAlign'] = {0: 'left', 1: 'center', 2: 'right', 3: 'justify'}.get(align, 'left')
        for attr, css in [('space_before', 'marginTop'), ('space_after', 'marginBottom'), ('left_indent', 'marginLeft'), ('first_line_indent', 'textIndent')]:
            value = first(formats, attr)
            if value is not None:
                style[css] = f'{value.pt:g}pt'
        spacing = first(formats, 'line_spacing')
        if spacing is not None:
            style['lineHeight'] = f'{spacing.pt:g}pt' if hasattr(spacing, 'pt') else f'{spacing:g}'
        runs = []
        num = p._p.find('.//' + qn('w:numPr'))
        if num is None:
            num = next((s.element.find('.//' + qn('w:numPr')) for s in chain(p.style) if s.element.find('.//' + qn('w:numPr')) is not None), None)
        if num is not None:
            num_id = num.find(qn('w:numId'))
            key = num_id.get(qn('w:val')) if num_id is not None else '0'
            counters[key] = counters.get(key, 0) + 1
            bullet = 'bullet' in (p.style.name or '').lower()
            runs.append({'text': '• ' if bullet else f'{counters[key]}. ', 'style': {}})
        # iter_inner_content retains text in hyperlinks without activating links.
        for part in p.iter_inner_content():
            for run in ([part] if hasattr(part, 'font') else part.runs):
                fonts = [run.font] + [s.font for s in chain(run.style)] + [s.font for s in chain(p.style)]
                rs = {}
                for attr, css, yes, no in [('bold', 'fontWeight', 'bold', 'normal'), ('italic', 'fontStyle', 'italic', 'normal'), ('underline', 'textDecoration', 'underline', 'none')]:
                    value = first(fonts, attr)
                    if value is not None:
                        rs[css] = yes if value else no
                for attr, css in [('name', 'fontFamily'), ('size', 'fontSize')]:
                    value = first(fonts, attr)
                    if value is not None:
                        rs[css] = f'{value.pt:g}pt' if attr == 'size' else value
                color = next((f.color.rgb for f in fonts if f.color.rgb is not None), None)
                if color is not None:
                    rs['color'] = f'#{color}'
                if first(fonts, 'strike'):
                    rs['textDecoration'] = 'line-through'
                if first(fonts, 'superscript'):
                    rs['verticalAlign'] = 'super'
                elif first(fonts, 'subscript'):
                    rs['verticalAlign'] = 'sub'
                runs.append({'text': run.text, 'style': rs})
        return {'type': 'paragraph', 'style': style, 'runs': runs}

    blocks = []
    for child in doc.element.body:
        if child.tag == qn('w:p'):
            blocks.append(paragraph(Paragraph(child, doc)))
        elif child.tag == qn('w:tbl'):
            table = Table(child, doc)
            blocks.append({'type': 'table', 'rows': [[[paragraph(p) for p in cell.paragraphs] for cell in row.cells] for row in table.rows]})
    raw = {'name': upload.name, 'blocks': blocks}
    if len(str(raw)) > 1500000:
        raise ValidationError({'file': 'Документ слишком сложный для демонстрации.'})
    result = normalize_document(raw)
    # Do not silently truncate a document selected by the presenter.
    def texts(blocks):
        for block in blocks:
            if block['type'] == 'table':
                for row in block['rows']:
                    for cell in row:
                        yield from texts(cell)
            else:
                yield ''.join(r['text'] for r in block['runs'])
    if list(texts(blocks)) != list(texts(result['blocks'])):
        raise ValidationError({'file': 'Документ превышает лимит: 60 000 символов или 600 абзацев. Загрузите его фрагмент.'})
    if not any(t.strip() for t in texts(result['blocks'])):
        raise ValidationError({'file': 'В документе нет текста для демонстрации.'})
    return result
