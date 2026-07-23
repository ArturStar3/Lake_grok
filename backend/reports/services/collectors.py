"""Сборщики данных для разделов PDF-отчёта."""

from __future__ import annotations

from datetime import datetime

from django.db.models import Q, Prefetch

from accounts.services.permissions import can_read_module, get_allowed_country_ids
from equipment.models import Equipment
from formular.models import (
    Country,
    CountryInfo,
    Event,
    Formular,
    OperationalSituation,
    Target,
    TargetAction,
    TargetVulnerability,
)

ACCESS_DENIED = {'access_denied': True, 'rows': []}
EMPTY = {'access_denied': False, 'rows': []}


def _as_int_list(value):
    if not value:
        return []
    result = []
    for item in value:
        try:
            result.append(int(item))
        except (TypeError, ValueError):
            continue
    return result


def _as_str_list(value):
    if not value:
        return []
    return [str(item) for item in value if item is not None and str(item).strip()]


def _parse_date(value):
    if not value:
        return None
    if hasattr(value, 'isoformat'):
        return value
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def _scope_country_ids(user, requested_ids):
    allowed = get_allowed_country_ids(user)
    requested = _as_int_list(requested_ids)
    if allowed is None:
        return requested
    if not allowed:
        return []
    if not requested:
        return list(allowed)
    return [cid for cid in requested if cid in allowed]


def _deny_if_no_module(user, module):
    if not can_read_module(user, module):
        return ACCESS_DENIED
    return None


def collect_countries(user, filters):
    denied = _deny_if_no_module(user, 'country_dossier')
    if denied:
        return denied
    country_ids = _scope_country_ids(user, (filters or {}).get('country_ids'))
    qs = Country.objects.all().order_by('title')
    if country_ids:
        qs = qs.filter(id__in=country_ids)
    else:
        allowed = get_allowed_country_ids(user)
        if allowed is not None:
            qs = qs.filter(id__in=allowed) if allowed else qs.none()
    rows = [
        {
            'title': c.title,
            'title_short': c.title_short or '',
            'iso_code': c.iso_code or '',
        }
        for c in qs
    ]
    return {'access_denied': False, 'rows': rows}


def collect_targets(user, filters):
    denied = _deny_if_no_module(user, 'targets')
    if denied:
        return denied
    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    type_ids = _as_int_list(filters.get('type_ids'))
    title = (filters.get('title') or '').strip()

    qs = Target.objects.select_related('country', 'type').order_by('country__title', 'title')
    allowed = get_allowed_country_ids(user)
    if allowed is not None:
        qs = qs.filter(country_id__in=allowed) if allowed else qs.none()
    if country_ids:
        qs = qs.filter(country_id__in=country_ids)
    if type_ids:
        qs = qs.filter(type_id__in=type_ids)
    if title:
        qs = qs.filter(Q(title__icontains=title) | Q(label__icontains=title))

    rows = [
        {
            'title': t.title,
            'label': t.label or '',
            'country': t.country.title if t.country_id else '',
            'type': t.type.title if t.type_id else '',
            'lat': t.lat,
            'lng': t.lng,
        }
        for t in qs
    ]
    return {'access_denied': False, 'rows': rows}


def collect_equipment(user, filters):
    denied = _deny_if_no_module(user, 'equipment')
    if denied:
        return denied
    filters = filters or {}
    category_ids = _as_int_list(filters.get('category_ids'))
    origin_country_ids = _scope_country_ids(user, filters.get('origin_country_ids'))
    title = (filters.get('title') or '').strip()

    qs = Equipment.objects.select_related('category', 'origin_country').order_by('title')
    if category_ids:
        qs = qs.filter(category_id__in=category_ids)
    if origin_country_ids:
        qs = qs.filter(origin_country_id__in=origin_country_ids)
    if title:
        qs = qs.filter(Q(title__icontains=title) | Q(designation__icontains=title))

    rows = [
        {
            'title': e.title,
            'designation': e.designation or '',
            'category': e.category.title if e.category_id else '',
            'origin_country': e.origin_country.title if e.origin_country_id else '',
            'description': e.description or '',
        }
        for e in qs
    ]
    return {'access_denied': False, 'rows': rows}


def collect_events(user, filters):
    denied = _deny_if_no_module(user, 'events')
    if denied:
        return denied
    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    event_type_ids = _as_int_list(filters.get('event_type_ids'))
    title = (filters.get('title') or '').strip()
    date_from = _parse_date(filters.get('date_from'))
    date_to = _parse_date(filters.get('date_to'))

    qs = Event.objects.select_related('country', 'event_type').order_by('-date_start', 'title')
    allowed = get_allowed_country_ids(user)
    if allowed is not None:
        qs = qs.filter(Q(country_id__in=allowed) | Q(country_id__isnull=True)) if allowed else qs.filter(country_id__isnull=True)
    if country_ids:
        qs = qs.filter(country_id__in=country_ids)
    if event_type_ids:
        qs = qs.filter(event_type_id__in=event_type_ids)
    if title:
        qs = qs.filter(Q(title__icontains=title) | Q(object_name__icontains=title))
    if date_from:
        qs = qs.filter(Q(date_start__gte=date_from) | Q(date_start__isnull=True, date_end__gte=date_from))
    if date_to:
        qs = qs.filter(Q(date_start__lte=date_to) | Q(date_end__lte=date_to) | Q(date_start__isnull=True))

    rows = [
        {
            'title': e.title,
            'object_name': e.object_name or '',
            'event_type': e.event_type.title if e.event_type_id else '',
            'country': e.country.title if e.country_id else '',
            'date_start': e.date_start.isoformat() if e.date_start else '',
            'date_end': e.date_end.isoformat() if e.date_end else '',
            'time_start': e.time_start.strftime('%H:%M') if e.time_start else '',
            'description': e.description or '',
        }
        for e in qs
    ]
    return {'access_denied': False, 'rows': rows}


def collect_situations(user, filters):
    denied = _deny_if_no_module(user, 'operational_situations')
    if denied:
        return denied
    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    title = (filters.get('title') or '').strip()
    date_from = _parse_date(filters.get('date_from'))
    date_to = _parse_date(filters.get('date_to'))

    qs = OperationalSituation.objects.select_related('current_revision').prefetch_related(
        Prefetch(
            'current_revision__countries',
            queryset=Country.objects.only('id', 'title'),
        ),
    ).order_by('-created_at')

    allowed = get_allowed_country_ids(user)
    if allowed is not None and allowed:
        qs = qs.filter(
            Q(current_revision__countries__id__in=allowed)
            | Q(current_revision__isnull=True)
        ).distinct()
    elif allowed is not None and not allowed:
        qs = qs.none()

    if country_ids:
        qs = qs.filter(current_revision__countries__id__in=country_ids).distinct()
    if title:
        qs = qs.filter(current_revision__title__icontains=title)
    if date_from:
        qs = qs.filter(current_revision__situation_date__gte=date_from)
    if date_to:
        qs = qs.filter(current_revision__situation_date__lte=date_to)

    rows = []
    for situation in qs:
        rev = situation.current_revision
        if not rev:
            continue
        countries = ', '.join(c.title for c in rev.countries.all())
        rows.append({
            'title': rev.title,
            'version': rev.version,
            'situation_date': rev.situation_date.isoformat() if rev.situation_date else '',
            'situation_time': rev.situation_time.strftime('%H:%M') if rev.situation_time else '',
            'countries': countries,
            'color': rev.color or '',
            'description': rev.description or '',
        })
    return {'access_denied': False, 'rows': rows}


def collect_zones(user, filters):
    denied = _deny_if_no_module(user, 'targets')
    if denied:
        return denied
    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    action_type_ids = _as_int_list(filters.get('action_type_ids'))
    target_ids = _as_str_list(filters.get('target_ids'))

    qs = TargetAction.objects.select_related(
        'target', 'target__country', 'action_type',
    ).order_by('target__title', 'action_type__title')

    allowed = get_allowed_country_ids(user)
    if allowed is not None:
        qs = qs.filter(target__country_id__in=allowed) if allowed else qs.none()
    if country_ids:
        qs = qs.filter(target__country_id__in=country_ids)
    if action_type_ids:
        qs = qs.filter(action_type_id__in=action_type_ids)
    if target_ids:
        qs = qs.filter(target_id__in=target_ids)

    rows = [
        {
            'target': a.target.title if a.target_id else '',
            'country': a.target.country.title if a.target_id and a.target.country_id else '',
            'action_type': a.action_type.title if a.action_type_id else '',
            'radius_km': a.radius if a.radius is not None else '',
            'has_geometry': bool(a.zone_geometry),
        }
        for a in qs
    ]
    return {'access_denied': False, 'rows': rows}


def collect_vulnerabilities(user, filters):
    denied = _deny_if_no_module(user, 'targets')
    if denied:
        return denied
    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    target_ids = _as_str_list(filters.get('target_ids'))

    qs = TargetVulnerability.objects.select_related(
        'target', 'target__country',
    ).order_by('target__title', 'order', 'title')

    allowed = get_allowed_country_ids(user)
    if allowed is not None:
        qs = qs.filter(target__country_id__in=allowed) if allowed else qs.none()
    if country_ids:
        qs = qs.filter(target__country_id__in=country_ids)
    if target_ids:
        qs = qs.filter(target_id__in=target_ids)

    rows = [
        {
            'title': v.title,
            'target': v.target.title if v.target_id else '',
            'country': v.target.country.title if v.target_id and v.target.country_id else '',
            'description': v.description or '',
            'lat': v.lat,
            'lng': v.lng,
        }
        for v in qs
    ]
    return {'access_denied': False, 'rows': rows}


def _markdown_to_html(text):
    if not text or not str(text).strip():
        return ''
    import markdown as md

    return md.markdown(
        str(text),
        extensions=['extra', 'sane_lists', 'tables'],
        output_format='html5',
    )


def _order_value(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 9999


def _parent_title(parent_value, sorted_items):
    if not parent_value:
        return None
    if isinstance(parent_value, dict):
        return parent_value.get('title')
    if hasattr(parent_value, 'title'):
        return parent_value.title
    found = next((item for item in sorted_items if item.get('section_id') == parent_value), None)
    if found:
        return found.get('section_title')
    return str(parent_value)


def _parent_key(parent_value, parent_title):
    if isinstance(parent_value, dict) and parent_value.get('id') is not None:
        return parent_value.get('id')
    if hasattr(parent_value, 'id'):
        return parent_value.id
    if isinstance(parent_value, int):
        return parent_value
    return parent_title


def _is_child_of(child_section, parent_section):
    parent_ref = child_section.get('parent')
    if not parent_ref or not parent_section:
        return False
    parent_id = parent_section.get('id')
    parent_title = parent_section.get('title')
    if isinstance(parent_ref, dict):
        return parent_ref.get('id') == parent_id
    if isinstance(parent_ref, int):
        return parent_ref == parent_id
    if hasattr(parent_ref, 'id'):
        return parent_ref.id == parent_id
    return parent_ref == parent_title


def _organize_dossier_items(raw_items):
    """Organize flat section/content items into standalone + groups (like frontend)."""
    if not raw_items:
        return {'standalone': [], 'groups': []}

    prepared = []
    for item in raw_items:
        section = item.get('section') or {}
        content = (item.get('content') or '').strip()
        if section.get('is_hidden') and not content:
            continue
        prepared.append({
            'section_id': section.get('id'),
            'section_title': section.get('title') or 'Раздел',
            'section_order': _order_value(section.get('order')),
            'is_hidden': bool(section.get('is_hidden')),
            'parent': section.get('parent'),
            'content': content,
            'content_html': _markdown_to_html(content) if content else '',
            'section': section,
        })

    sorted_items = sorted(prepared, key=lambda x: x['section_order'])
    standalone = []
    groups_map = {}

    for item in sorted_items:
        section = item['section']
        parent = section.get('parent')
        if parent:
            p_title = _parent_title(parent, sorted_items)
            p_key = _parent_key(parent, p_title)
            if p_key not in groups_map:
                if isinstance(parent, dict):
                    parent_obj = parent
                elif hasattr(parent, 'title'):
                    parent_obj = {
                        'id': getattr(parent, 'id', p_key),
                        'title': parent.title,
                        'is_hidden': bool(getattr(parent, 'is_hidden', False)),
                    }
                else:
                    parent_obj = {'id': p_key, 'title': p_title, 'is_hidden': False}
                groups_map[p_key] = {'parent': parent_obj, 'children': []}
            if item['content']:
                groups_map[p_key]['children'].append(item)
            continue

        has_children = any(_is_child_of(entry['section'], section) for entry in sorted_items)
        if section.get('is_hidden') and not has_children and not item['content']:
            continue
        if item['content'] or has_children:
            standalone.append(item)

    groups = []
    for group in groups_map.values():
        if group['children']:
            groups.append(group)

    return {'standalone': standalone, 'groups': groups}


def _section_payload_from_model(section):
    parent = None
    if section.parent_id:
        parent = {
            'id': section.parent_id,
            'title': section.parent.title if section.parent_id else '',
            'order': section.parent.order if section.parent_id else 0,
            'is_hidden': bool(section.parent.is_hidden) if section.parent_id else False,
        }
    return {
        'id': section.id,
        'title': section.title,
        'order': section.order,
        'parent': parent,
        'is_hidden': bool(section.is_hidden),
    }


def _build_country_dossier(country):
    infos = (
        CountryInfo.objects.filter(country=country)
        .select_related('section', 'section__parent')
        .order_by('section__order')
    )
    raw = [
        {
            'section': _section_payload_from_model(info.section),
            'content': info.content or '',
        }
        for info in infos
        if info.section_id
    ]
    return _organize_dossier_items(raw)


def _build_target_formular(target, user):
    if not can_read_module(user, 'formular'):
        return {'access_denied': True, 'standalone': [], 'groups': []}
    rows = (
        Formular.objects.filter(target=target)
        .select_related('section', 'section__parent')
        .order_by('section__order')
    )
    raw = [
        {
            'section': _section_payload_from_model(row.section),
            'content': row.content or '',
        }
        for row in rows
        if row.section_id
    ]
    organized = _organize_dossier_items(raw)
    organized['access_denied'] = False
    return organized


def _target_detail_block(target, user):
    can_targets = can_read_module(user, 'targets')
    block = {
        'id': str(target.id),
        'title': target.title,
        'label': target.label or '',
        'country': target.country.title if target.country_id else '',
        'type': target.type.title if target.type_id else '',
        'lat': target.lat,
        'lng': target.lng,
        'formular': {'access_denied': True, 'standalone': [], 'groups': []},
        'zones': [],
        'equipment': [],
        'vulnerabilities': [],
        'formular_note': '',
    }
    if not can_targets:
        block['formular_note'] = 'Нет доступа к данным объектов'
        return block

    block['formular'] = _build_target_formular(target, user)
    if block['formular'].get('access_denied'):
        block['formular_note'] = 'Нет доступа к формуляру'

    actions = target.actions.select_related('action_type').all()
    block['zones'] = [
        {
            'action_type': a.action_type.title if a.action_type_id else '',
            'radius_km': a.radius if a.radius is not None else '',
            'has_geometry': bool(a.zone_geometry),
        }
        for a in actions
    ]

    equipment_links = target.equipment_links.select_related('equipment', 'equipment__category').all()
    block['equipment'] = [
        {
            'title': link.equipment.title if link.equipment_id else '',
            'designation': link.equipment.designation if link.equipment_id else '',
            'category': (
                link.equipment.category.title
                if link.equipment_id and link.equipment.category_id
                else ''
            ),
            'quantity': link.quantity,
        }
        for link in equipment_links
    ]

    vulns = target.vulnerabilities.all().order_by('order', 'title')
    block['vulnerabilities'] = [
        {
            'title': v.title,
            'description': v.description or '',
            'lat': v.lat,
            'lng': v.lng,
        }
        for v in vulns
    ]
    return block


def _scoped_targets_qs(user, *, country_ids=None, target_ids=None):
    qs = Target.objects.select_related('country', 'type').prefetch_related(
        'actions__action_type',
        'equipment_links__equipment__category',
        'vulnerabilities',
    ).order_by('country__title', 'title')

    allowed = get_allowed_country_ids(user)
    if allowed is not None:
        qs = qs.filter(country_id__in=allowed) if allowed else qs.none()
    if country_ids:
        qs = qs.filter(country_id__in=country_ids)
    if target_ids:
        qs = qs.filter(id__in=target_ids)
    return qs


def collect_country_full(user, filters):
    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    if filters.get('country_ids') and not country_ids:
        return {'access_denied': False, 'countries': []}

    qs = Country.objects.all().order_by('title')
    if country_ids:
        qs = qs.filter(id__in=country_ids)
    else:
        allowed = get_allowed_country_ids(user)
        if allowed is not None:
            qs = qs.filter(id__in=allowed) if allowed else qs.none()

    can_dossier = can_read_module(user, 'country_dossier')
    can_targets = can_read_module(user, 'targets')
    countries = []
    for country in qs:
        entry = {
            'id': country.id,
            'title': country.title,
            'title_short': country.title_short or '',
            'iso_code': country.iso_code or '',
            'dossier_access_denied': not can_dossier,
            'dossier': {'standalone': [], 'groups': []},
            'targets_access_denied': not can_targets,
            'targets': [],
        }
        if can_dossier:
            entry['dossier'] = _build_country_dossier(country)
        if can_targets:
            targets = _scoped_targets_qs(user, country_ids=[country.id])
            entry['targets'] = [_target_detail_block(t, user) for t in targets]
        countries.append(entry)

    return {'access_denied': False, 'countries': countries}


def collect_objects_full(user, filters):
    denied = _deny_if_no_module(user, 'targets')
    if denied:
        return {'access_denied': True, 'targets': []}

    filters = filters or {}
    country_ids = _scope_country_ids(user, filters.get('country_ids'))
    target_ids = _as_str_list(filters.get('target_ids'))

    # If user asked for specific countries but none are allowed — empty
    if filters.get('country_ids') and not country_ids and not target_ids:
        return {'access_denied': False, 'targets': []}

    qs = _scoped_targets_qs(
        user,
        country_ids=country_ids or None,
        target_ids=target_ids or None,
    )
    targets = [_target_detail_block(t, user) for t in qs]
    return {'access_denied': False, 'targets': targets}


COLLECTORS = {
    'countries': collect_countries,
    'targets': collect_targets,
    'equipment': collect_equipment,
    'events': collect_events,
    'situations': collect_situations,
    'zones': collect_zones,
    'vulnerabilities': collect_vulnerabilities,
    'country_full': collect_country_full,
    'objects_full': collect_objects_full,
}


def collect_section_data(section_type, user, filters):
    collector = COLLECTORS.get(section_type)
    if not collector:
        return EMPTY
    return collector(user, filters or {})
