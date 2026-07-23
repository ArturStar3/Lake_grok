"""Сборка PDF из HTML-шаблонов через WeasyPrint."""

from __future__ import annotations

import logging
import re
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify

from reports.services.collectors import collect_section_data

logger = logging.getLogger(__name__)


def _safe_filename(name: str) -> str:
    base = slugify(name, allow_unicode=True) or 'report'
    base = re.sub(r'[^\w\-]+', '_', base, flags=re.UNICODE).strip('_')
    return (base or 'report')[:80]


def _import_weasyprint():
    try:
        from weasyprint import CSS, HTML
    except ImportError as exc:
        logger.exception('WeasyPrint is not installed')
        raise ImproperlyConfigured(
            'WeasyPrint не установлен в окружении backend. '
            'Пересоберите образ: docker compose build backend && docker compose up -d backend'
        ) from exc
    return HTML, CSS


def build_pdf_bytes(*, template_name, template_description, sections, user, section_overrides=None) -> bytes:
    """
    sections — iterable объектов с атрибутами:
      id, section_type, title, order, filters, page_break_before
    section_overrides — dict[section_id|index] -> filters
    """
    HTML, CSS = _import_weasyprint()

    overrides = section_overrides or {}
    sections_html = []
    ordered = sorted(list(sections), key=lambda s: (getattr(s, 'order', 0), getattr(s, 'id', 0) or 0))

    for index, section in enumerate(ordered):
        key = section.id if getattr(section, 'id', None) is not None else index
        filters = overrides.get(key, section.filters)
        data = collect_section_data(section.section_type, user, filters)
        fragment = render_to_string(
            f'reports/pdf/_section_{section.section_type}.html',
            {
                'section': section,
                'data': data,
                'page_break_before': bool(getattr(section, 'page_break_before', True)),
            },
        )
        sections_html.append(fragment)

    html = render_to_string(
        'reports/pdf/document.html',
        {
            'template_name': template_name,
            'template_description': template_description or '',
            'sections_html': sections_html,
            'generated_at': timezone.localtime(timezone.now()),
            'generated_by': user,
        },
    )

    css_path = Path(settings.BASE_DIR) / 'reports' / 'static' / 'reports' / 'pdf_base.css'
    stylesheets = [CSS(filename=str(css_path))] if css_path.exists() else []
    return HTML(string=html, base_url=str(settings.BASE_DIR)).write_pdf(stylesheets=stylesheets)


def build_pdf_for_template(template, user, section_overrides=None) -> bytes:
    sections = list(template.sections.order_by('order', 'id'))
    return build_pdf_bytes(
        template_name=template.name,
        template_description=template.description,
        sections=sections,
        user=user,
        section_overrides=section_overrides,
    )


def pdf_filename(template_name: str) -> str:
    stamp = timezone.localtime(timezone.now()).strftime('%Y%m%d_%H%M')
    return f'{_safe_filename(template_name)}_{stamp}.pdf'
