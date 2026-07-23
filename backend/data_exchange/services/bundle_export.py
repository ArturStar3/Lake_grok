"""Сборка ZIP-бандла экспорта по выбранным странам."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone

from django.conf import settings
from django.core.files.storage import default_storage

from accounts.services.permissions import get_allowed_country_ids
from data_exchange.services import bundle_schema as schema
from equipment.models import (
    Equipment,
    EquipmentCategory,
    EquipmentImage,
    EquipmentParameterDefinition,
    EquipmentParameterValue,
    UnitOfMeasure,
)
from formular.models import (
    ActionType,
    Country,
    CountryAttachment,
    CountryInfo,
    CountrySections,
    Event,
    EventMarker,
    EventType,
    Formular,
    FormularAttachment,
    FormularSections,
    Marker,
    MarkerColorPalette,
    Person,
    PersonAttachment,
    PersonInfo,
    PersonPhoto,
    PersonRelation,
    PersonSections,
    RelationType,
    Target,
    TargetAction,
    TargetEquipment,
    TargetType,
    TargetVulnerability,
)


def _filter_country_ids(country_ids, user):
    requested = [int(x) for x in country_ids]
    allowed = get_allowed_country_ids(user)
    if allowed is None:
        return requested
    allowed_set = set(allowed)
    return [cid for cid in requested if cid in allowed_set]


def _add_media(zf: zipfile.ZipFile, rel_paths: set[str], written: set[str]):
    for rel in sorted(rel_paths):
        if not rel or rel in written:
            continue
        if not default_storage.exists(rel):
            continue
        zip_name = schema.media_zip_path(rel)
        with default_storage.open(rel, 'rb') as fh:
            zf.writestr(zip_name, fh.read())
        written.add(rel)


def build_export_bundle(*, country_ids, user) -> bytes:
    filtered_ids = _filter_country_ids(country_ids, user)
    if not filtered_ids:
        raise ValueError('Нет доступных стран для экспорта.')

    countries_qs = Country.objects.filter(id__in=filtered_ids).select_related('marker_palette')
    countries = list(countries_qs)
    country_titles = {c.title for c in countries}
    boundary_dropped = []

    targets = list(
        Target.objects.filter(country_id__in=filtered_ids).select_related(
            'country', 'marker', 'type', 'parent',
        )
    )
    target_ids = [t.id for t in targets]
    target_id_set = set(target_ids)

    # Parent outside scope → drop link
    for t in targets:
        if t.parent_id and t.parent_id not in target_id_set:
            boundary_dropped.append({
                'type': 'target.parent',
                'target_id': str(t.id),
                'parent_id': str(t.parent_id),
            })

    events = list(
        Event.objects.filter(country_id__in=filtered_ids).select_related(
            'country', 'event_type', 'marker',
        )
    )
    persons = list(
        Person.objects.filter(target_id__in=target_ids).select_related('target')
    )
    person_ids = [p.id for p in persons]
    person_id_set = set(person_ids)

    target_equipment_links = list(
        TargetEquipment.objects.filter(target_id__in=target_ids).select_related('equipment', 'target')
    )
    equipment_ids = {link.equipment_id for link in target_equipment_links}
    equipment_list = list(
        Equipment.objects.filter(id__in=equipment_ids).select_related('category', 'origin_country')
    )

    # Light dependency countries (origin_country etc.)
    extra_country_ids = set()
    for eq in equipment_list:
        if eq.origin_country_id and eq.origin_country_id not in filtered_ids:
            extra_country_ids.add(eq.origin_country_id)
    if extra_country_ids:
        for c in Country.objects.filter(id__in=extra_country_ids).select_related('marker_palette'):
            if c.title not in country_titles:
                countries.append(c)
                country_titles.add(c.title)

    # Collect referenced catalogs
    palette_ids = {c.marker_palette_id for c in countries if c.marker_palette_id}
    marker_ids = {t.marker_id for t in targets if t.marker_id}
    type_ids = {t.type_id for t in targets if t.type_id}
    # Walk type parents
    type_objs = list(TargetType.objects.filter(id__in=type_ids))
    pending = [t.parent_id for t in type_objs if t.parent_id]
    seen_types = {t.id for t in type_objs}
    while pending:
        pid = pending.pop()
        if not pid or pid in seen_types:
            continue
        parent = TargetType.objects.filter(id=pid).first()
        if parent:
            type_objs.append(parent)
            seen_types.add(parent.id)
            if parent.parent_id:
                pending.append(parent.parent_id)

    event_type_ids = {e.event_type_id for e in events if e.event_type_id}
    event_marker_ids = {e.marker_id for e in events if e.marker_id}

    actions = list(
        TargetAction.objects.filter(target_id__in=target_ids).select_related('action_type', 'target')
    )
    action_type_ids = {a.action_type_id for a in actions if a.action_type_id}

    formulars = list(
        Formular.objects.filter(target_id__in=target_ids).select_related('section', 'target')
    )
    formular_atts = list(
        FormularAttachment.objects.filter(target_id__in=target_ids).select_related('section', 'target')
    )
    formular_section_ids = {f.section_id for f in formulars} | {f.section_id for f in formular_atts}

    vulns = list(TargetVulnerability.objects.filter(target_id__in=target_ids).select_related('target'))

    country_infos = list(
        CountryInfo.objects.filter(country_id__in=filtered_ids).select_related('country', 'section')
    )
    country_atts = list(
        CountryAttachment.objects.filter(country_id__in=filtered_ids).select_related('country', 'section')
    )
    country_section_ids = (
        {i.section_id for i in country_infos} | {a.section_id for a in country_atts}
    )

    person_infos = list(
        PersonInfo.objects.filter(person_id__in=person_ids).select_related('person', 'section')
    )
    person_atts = list(
        PersonAttachment.objects.filter(person_id__in=person_ids).select_related('person', 'section')
    )
    person_photos = list(
        PersonPhoto.objects.filter(person_id__in=person_ids).select_related('person')
    )
    person_section_ids = (
        {i.section_id for i in person_infos} | {a.section_id for a in person_atts}
    )

    relations = []
    for rel in PersonRelation.objects.filter(
        person_from_id__in=person_ids,
    ).select_related('person_from', 'person_to', 'relation_type'):
        if rel.person_to_id not in person_id_set:
            boundary_dropped.append({
                'type': 'person_relation',
                'person_from_id': str(rel.person_from_id),
                'person_to_id': str(rel.person_to_id),
            })
            continue
        relations.append(rel)

    relation_type_ids = {r.relation_type_id for r in relations}

    # Equipment related catalogs
    category_ids = {e.category_id for e in equipment_list if e.category_id}
    categories = list(EquipmentCategory.objects.filter(id__in=category_ids))
    pending_cat = [c.parent_id for c in categories if c.parent_id]
    seen_cat = {c.id for c in categories}
    while pending_cat:
        cid = pending_cat.pop()
        if not cid or cid in seen_cat:
            continue
        parent = EquipmentCategory.objects.filter(id=cid).first()
        if parent:
            categories.append(parent)
            seen_cat.add(parent.id)
            if parent.parent_id:
                pending_cat.append(parent.parent_id)

    param_values = list(
        EquipmentParameterValue.objects.filter(equipment_id__in=equipment_ids).select_related(
            'equipment', 'parameter',
        )
    )
    param_def_ids = {pv.parameter_id for pv in param_values}
    param_defs = list(
        EquipmentParameterDefinition.objects.filter(id__in=param_def_ids).select_related(
            'unit', 'action_type',
        ).prefetch_related('categories')
    )
    for pd in param_defs:
        if pd.action_type_id:
            action_type_ids.add(pd.action_type_id)
    uom_ids = {pd.unit_id for pd in param_defs if pd.unit_id}
    for pd in param_defs:
        for cat in pd.categories.all():
            if cat.id not in seen_cat:
                categories.append(cat)
                seen_cat.add(cat.id)

    eq_images = list(
        EquipmentImage.objects.filter(equipment_id__in=equipment_ids).select_related('equipment')
    )

    # Sections with parents
    def load_sections(model, ids):
        objs = list(model.objects.filter(id__in=ids))
        seen = {o.id for o in objs}
        pending = [o.parent_id for o in objs if o.parent_id]
        while pending:
            pid = pending.pop()
            if not pid or pid in seen:
                continue
            parent = model.objects.filter(id=pid).first()
            if parent:
                objs.append(parent)
                seen.add(parent.id)
                if parent.parent_id:
                    pending.append(parent.parent_id)
        return objs

    data = {
        'marker_color_palettes': [
            schema.serialize_palette(p)
            for p in MarkerColorPalette.objects.filter(id__in=palette_ids)
        ],
        'markers': [schema.serialize_marker(m) for m in Marker.objects.filter(id__in=marker_ids)],
        'event_markers': [
            schema.serialize_event_marker(m) for m in EventMarker.objects.filter(id__in=event_marker_ids)
        ],
        'action_types': [
            schema.serialize_action_type(a) for a in ActionType.objects.filter(id__in=action_type_ids)
        ],
        'event_types': [
            schema.serialize_simple_title(t) for t in EventType.objects.filter(id__in=event_type_ids)
        ],
        'target_types': [schema.serialize_target_type(t) for t in type_objs],
        'country_sections': [
            schema.serialize_section(s) for s in load_sections(CountrySections, country_section_ids)
        ],
        'formular_sections': [
            schema.serialize_section(s) for s in load_sections(FormularSections, formular_section_ids)
        ],
        'person_sections': [
            schema.serialize_section(s) for s in load_sections(PersonSections, person_section_ids)
        ],
        'relation_types': [
            schema.serialize_relation_type(r) for r in RelationType.objects.filter(id__in=relation_type_ids)
        ],
        'equipment_categories': [schema.serialize_equipment_category(c) for c in categories],
        'units_of_measure': [
            schema.serialize_uom(u) for u in UnitOfMeasure.objects.filter(id__in=uom_ids)
        ],
        'equipment_parameter_definitions': [schema.serialize_param_def(p) for p in param_defs],
        'countries': [schema.serialize_country(c) for c in countries],
        'equipment': [schema.serialize_equipment(e) for e in equipment_list],
        'equipment_images': [schema.serialize_equipment_image(i) for i in eq_images],
        'equipment_parameter_values': [schema.serialize_param_value(v) for v in param_values],
        'country_infos': [schema.serialize_country_info(i) for i in country_infos],
        'country_attachments': [schema.serialize_country_attachment(a) for a in country_atts],
        'targets': [
            {
                **schema.serialize_target(t),
                'parent_id': str(t.parent_id) if t.parent_id and t.parent_id in target_id_set else None,
            }
            for t in targets
        ],
        'target_actions': [schema.serialize_target_action(a) for a in actions],
        'target_equipment': [schema.serialize_target_equipment(l) for l in target_equipment_links],
        'formulars': [schema.serialize_formular(f) for f in formulars],
        'formular_attachments': [schema.serialize_formular_attachment(a) for a in formular_atts],
        'target_vulnerabilities': [schema.serialize_vulnerability(v) for v in vulns],
        'events': [
            {
                **schema.serialize_event(e),
                'color': e.color,
                'shape': e.shape,
            }
            for e in events
        ],
        'persons': [schema.serialize_person(p) for p in persons],
        'person_infos': [schema.serialize_person_info(i) for i in person_infos],
        'person_attachments': [schema.serialize_person_attachment(a) for a in person_atts],
        'person_photos': [schema.serialize_person_photo(p) for p in person_photos],
        'person_relations': [schema.serialize_person_relation(r) for r in relations],
    }

    counts = {k: len(v) for k, v in data.items()}
    manifest = {
        'format_version': schema.BUNDLE_FORMAT_VERSION,
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'exported_by': getattr(user, 'username', '') or str(user),
        'countries': [
            {'title': c.title, 'iso_code': c.iso_code, 'title_short': c.title_short}
            for c in countries if c.id in filtered_ids or c.id in [int(x) for x in filtered_ids]
        ],
        'counts': counts,
        'boundary_dropped': boundary_dropped,
    }

    buffer = io.BytesIO()
    written_media: set[str] = set()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        zf.writestr('data.json', json.dumps(data, ensure_ascii=False, indent=2, default=str))
        _add_media(zf, schema.collect_media_paths(data), written_media)

    return buffer.getvalue()


def export_filename() -> str:
    stamp = datetime.now().strftime('%Y%m%d_%H%M')
    return f'infolake_export_{stamp}.zip'
