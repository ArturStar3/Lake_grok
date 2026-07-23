"""Анализ и применение ZIP-бандла импорта."""

from __future__ import annotations

import json
import shutil
import uuid
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime, parse_time

from data_exchange.models import ImportItem, ImportSession
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


def _staging_root(session_id) -> Path:
    return Path(settings.MEDIA_ROOT) / 'import_sessions' / str(session_id)


def _extract_zip(uploaded_file, session_id) -> Path:
    import zipfile

    root = _staging_root(session_id)
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(uploaded_file) as zf:
        zf.extractall(root)
    return root


def _load_json(path: Path):
    with path.open('r', encoding='utf-8') as fh:
        return json.load(fh)


def _find_by_title(model, title: str):
    qs = model.objects.filter(title=title)
    count = qs.count()
    if count == 0:
        return None, 'new'
    if count > 1:
        return list(qs[:5]), 'ambiguous'
    return qs.first(), 'found'


def _compare_payload(local_payload: dict | None, imported_payload: dict) -> str:
    if local_payload is None:
        return ImportItem.Status.NEW
    # Ignore natural_key field for hash if needed — keep full compare
    if schema.snapshot_hash(local_payload) == schema.snapshot_hash(imported_payload):
        return ImportItem.Status.UNCHANGED
    return ImportItem.Status.CONFLICT


def _label_for(entity_type: str, record: dict) -> str:
    for key in ('title', 'full_name', 'designation', 'code', 'symbol', 'natural_key'):
        if record.get(key):
            return str(record[key])[:200]
    return record.get('natural_key', '')[:200]


def analyze_bundle(uploaded_file, user) -> ImportSession:
    session = ImportSession.objects.create(
        status=ImportSession.Status.ANALYZING,
        created_by=user if getattr(user, 'is_authenticated', False) else None,
    )
    try:
        root = _extract_zip(uploaded_file, session.id)
        manifest_path = root / 'manifest.json'
        data_path = root / 'data.json'
        if not manifest_path.exists() or not data_path.exists():
            raise ValueError('В архиве нет manifest.json или data.json')

        manifest = _load_json(manifest_path)
        data = _load_json(data_path)
        version = manifest.get('format_version')
        if version != schema.BUNDLE_FORMAT_VERSION:
            raise ValueError(
                f'Несовместимая версия бандла: {version}, ожидается {schema.BUNDLE_FORMAT_VERSION}'
            )

        session.manifest = manifest
        session.bundle_path = f'import_sessions/{session.id}'
        session.save(update_fields=['manifest', 'bundle_path', 'updated_at'])

        items = []
        summary = {'new': 0, 'unchanged': 0, 'conflict': 0, 'ambiguous': 0, 'by_type': {}}

        for entity_type in schema.ENTITY_ORDER:
            records = data.get(entity_type) or []
            type_counts = {'new': 0, 'unchanged': 0, 'conflict': 0, 'ambiguous': 0}
            for record in records:
                if entity_type in schema.CHILD_ENTITY_TYPES:
                    # Children follow parent — store as new/unchanged only for apply, skip conflict UI
                    local, status = _lookup_child(entity_type, record)
                    item_status = status
                    decision = ImportItem.Decision.USE_IMPORTED if item_status == ImportItem.Status.NEW else ImportItem.Decision.PENDING
                    if item_status == ImportItem.Status.UNCHANGED:
                        decision = ImportItem.Decision.KEEP_LOCAL
                else:
                    local_payload, match_kind = _lookup_entity(entity_type, record)
                    if match_kind == 'ambiguous':
                        item_status = ImportItem.Status.AMBIGUOUS
                        decision = ImportItem.Decision.PENDING
                        local_payload = {'matches': [str(x) for x in (local_payload or [])]}
                    else:
                        item_status = _compare_payload(local_payload, record)
                        if item_status == ImportItem.Status.NEW:
                            decision = ImportItem.Decision.USE_IMPORTED
                        elif item_status == ImportItem.Status.UNCHANGED:
                            decision = ImportItem.Decision.KEEP_LOCAL
                        else:
                            decision = ImportItem.Decision.PENDING  # conflict: default keep until user chooses

                items.append(ImportItem(
                    session=session,
                    entity_type=entity_type,
                    natural_key=str(record.get('natural_key', ''))[:500],
                    status=item_status,
                    decision=decision,
                    local_snapshot=local_payload or {},
                    imported_snapshot=record,
                    label=_label_for(entity_type, record),
                ))
                type_counts[item_status] = type_counts.get(item_status, 0) + 1
                summary[item_status] = summary.get(item_status, 0) + 1

            summary['by_type'][entity_type] = type_counts

        ImportItem.objects.bulk_create(items, batch_size=500)
        session.summary = summary
        session.status = ImportSession.Status.READY
        session.save(update_fields=['summary', 'status', 'updated_at'])
        return session
    except Exception as exc:
        session.status = ImportSession.Status.FAILED
        session.error_message = str(exc)
        session.save(update_fields=['status', 'error_message', 'updated_at'])
        raise


def _lookup_entity(entity_type: str, record: dict):
    """Возвращает (local_snapshot_or_None_or_list, kind: new|found|ambiguous)."""
    nk = record.get('natural_key')

    if entity_type == 'marker_color_palettes':
        obj, kind = _find_by_title(MarkerColorPalette, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_palette(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'markers':
        obj, kind = _find_by_title(Marker, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_marker(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'event_markers':
        obj, kind = _find_by_title(EventMarker, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_event_marker(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'action_types':
        obj, kind = _find_by_title(ActionType, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_action_type(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'event_types':
        obj, kind = _find_by_title(EventType, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_simple_title(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'target_types':
        obj, kind = _find_by_title(TargetType, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_target_type(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'country_sections':
        obj, kind = _find_by_title(CountrySections, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_section(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'formular_sections':
        obj, kind = _find_by_title(FormularSections, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_section(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'person_sections':
        obj, kind = _find_by_title(PersonSections, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_section(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'relation_types':
        obj, kind = _find_by_title(RelationType, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_relation_type(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'equipment_categories':
        obj, kind = _find_by_title(EquipmentCategory, record['title'])
        if kind == 'ambiguous':
            return obj, 'ambiguous'
        return (schema.serialize_equipment_category(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'units_of_measure':
        obj = UnitOfMeasure.objects.filter(symbol=record['symbol']).first()
        return (schema.serialize_uom(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'equipment_parameter_definitions':
        obj = EquipmentParameterDefinition.objects.filter(code=record['code']).first()
        return (schema.serialize_param_def(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'countries':
        obj = Country.objects.filter(title=record['title']).first()
        return (schema.serialize_country(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'equipment':
        obj = _find_equipment(record)
        return (schema.serialize_equipment(obj) if obj else None), ('found' if obj else 'new')

    if entity_type == 'country_infos':
        country = Country.objects.filter(title=record['country_key']).first()
        section = CountrySections.objects.filter(title=record['section_key']).first()
        obj = None
        if country and section:
            obj = CountryInfo.objects.filter(country=country, section=section).first()
        return (schema.serialize_country_info(obj) if obj else None), ('found' if obj else 'new')

    # UUID entities
    if entity_type in {
        'country_attachments', 'targets', 'formulars', 'formular_attachments',
        'target_vulnerabilities', 'events', 'persons', 'person_infos',
        'person_attachments', 'person_photos',
    }:
        pk = record.get('id') or record.get('natural_key')
        model = {
            'country_attachments': CountryAttachment,
            'targets': Target,
            'formulars': Formular,
            'formular_attachments': FormularAttachment,
            'target_vulnerabilities': TargetVulnerability,
            'events': Event,
            'persons': Person,
            'person_infos': PersonInfo,
            'person_attachments': PersonAttachment,
            'person_photos': PersonPhoto,
        }[entity_type]
        obj = model.objects.filter(pk=pk).first()
        if not obj:
            return None, 'new'
        serializer = {
            'country_attachments': schema.serialize_country_attachment,
            'targets': schema.serialize_target,
            'formulars': schema.serialize_formular,
            'formular_attachments': schema.serialize_formular_attachment,
            'target_vulnerabilities': schema.serialize_vulnerability,
            'events': schema.serialize_event,
            'persons': schema.serialize_person,
            'person_infos': schema.serialize_person_info,
            'person_attachments': schema.serialize_person_attachment,
            'person_photos': schema.serialize_person_photo,
        }[entity_type]
        payload = serializer(obj)
        if entity_type == 'events':
            payload['color'] = obj.color
            payload['shape'] = obj.shape
        return payload, 'found'

    if entity_type == 'person_relations':
        obj = PersonRelation.objects.filter(
            person_from_id=record['person_from_id'],
            person_to_id=record['person_to_id'],
            relation_type__title=record['relation_type_key'],
        ).select_related('relation_type').first()
        return (schema.serialize_person_relation(obj) if obj else None), ('found' if obj else 'new')

    return None, 'new'


def _find_equipment(record):
    if record.get('designation'):
        obj = Equipment.objects.filter(designation=record['designation']).first()
        if obj:
            return obj
    return Equipment.objects.filter(title=record['title'], designation='').first()


def _lookup_child(entity_type, record):
    """Для дочерних коллекций — new если нет точного совпадения ключа."""
    if entity_type == 'target_actions':
        exists = TargetAction.objects.filter(
            target_id=record['target_id'],
            action_type__title=record.get('action_type_key') or None,
        ).exists() if record.get('action_type_key') else False
        # Always treat as replaceable — mark conflict-less new/unchanged loosely
        return None, ImportItem.Status.NEW

    if entity_type == 'target_equipment':
        eq = _find_equipment({'designation': record['equipment_key'], 'title': record['equipment_key']})
        if eq and TargetEquipment.objects.filter(target_id=record['target_id'], equipment=eq).exists():
            return {}, ImportItem.Status.UNCHANGED
        return None, ImportItem.Status.NEW

    if entity_type == 'equipment_parameter_values':
        eq = _find_equipment({'designation': record['equipment_key'], 'title': record['equipment_key']})
        if eq and EquipmentParameterValue.objects.filter(
            equipment=eq, parameter__code=record['parameter_key']
        ).exists():
            return {}, ImportItem.Status.UNCHANGED
        return None, ImportItem.Status.NEW

    if entity_type == 'equipment_images':
        return None, ImportItem.Status.NEW

    return None, ImportItem.Status.NEW


def _attach_media(instance, field_name: str, rel_path: str | None, staging: Path):
    if not rel_path:
        return
    src = staging / 'media' / rel_path
    if not src.exists():
        # try flat
        src = staging / rel_path
    if not src.exists():
        return
    field = getattr(instance, field_name)
    with src.open('rb') as fh:
        field.save(Path(rel_path).name, File(fh), save=False)


def _is_empty(value) -> bool:
    return value is None or value == ''


def _merge_scalar(local, imported):
    """Непустые локальные значения сохраняются; пустые заполняются из импорта."""
    if _is_empty(local):
        return imported
    return local


def _merge_text(local, imported) -> str:
    """Пустое → из импорта; оба непустые и разные → склейка с разделителем."""
    local_s = '' if local is None else str(local)
    imported_s = '' if imported is None else str(imported)
    if not local_s:
        return imported_s
    if not imported_s:
        return local_s
    if local_s == imported_s:
        return local_s
    return f'{local_s}\n\n---\n\n{imported_s}'


def _file_empty(instance, field_name: str) -> bool:
    field = getattr(instance, field_name, None)
    return not field or not getattr(field, 'name', None)


def _merge_file(instance, field_name: str, rel_path: str | None, staging: Path):
    """Взять файл из бандла только если локального нет."""
    if _file_empty(instance, field_name):
        _attach_media(instance, field_name, rel_path, staging)


def cancel_import_session(session: ImportSession):
    root = _staging_root(session.id)
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    session.status = ImportSession.Status.CANCELLED
    session.save(update_fields=['status', 'updated_at'])


def _item_apply_mode(item: ImportItem) -> str | None:
    """
    Режим применения: create | replace | merge, либо None (пропуск).
    """
    if item.status == ImportItem.Status.NEW:
        return 'create'
    if item.status == ImportItem.Status.UNCHANGED:
        return None
    if item.decision == ImportItem.Decision.USE_IMPORTED:
        return 'replace'
    if item.decision == ImportItem.Decision.MERGE:
        return 'merge'
    return None  # keep_local / pending


@transaction.atomic
def apply_import_session(session: ImportSession, decisions: dict | None = None) -> dict:
    """
    decisions: {item_id: 'keep_local'|'use_imported'|'merge'}
    """
    if session.status not in (ImportSession.Status.READY, ImportSession.Status.APPLYING):
        raise ValueError(f'Сессия в статусе {session.status}, применение невозможно')

    session.status = ImportSession.Status.APPLYING
    session.save(update_fields=['status', 'updated_at'])

    decisions = decisions or {}
    items = list(session.items.all())
    decision_by_id = {str(k): v for k, v in decisions.items()}

    for item in items:
        if str(item.id) in decision_by_id:
            item.decision = decision_by_id[str(item.id)]
            item.save(update_fields=['decision'])

    def should_apply(item: ImportItem) -> bool:
        return _item_apply_mode(item) is not None

    staging = _staging_root(session.id)
    maps = {etype: {} for etype in schema.ENTITY_ORDER}  # natural_key -> local pk/obj id

    applied = 0
    skipped = 0

    # Preload items by type
    by_type = {}
    for item in items:
        by_type.setdefault(item.entity_type, []).append(item)

    for entity_type in schema.ENTITY_ORDER:
        for item in by_type.get(entity_type, []):
            if entity_type in schema.CHILD_ENTITY_TYPES:
                continue  # handled with parents
            mode = _item_apply_mode(item)
            if mode is None:
                skipped += 1
                # still register existing mapping for FK resolution
                _register_existing(entity_type, item, maps)
                continue
            _apply_entity(entity_type, item.imported_snapshot, maps, staging, mode=mode)
            applied += 1

    # Children: replace or union depending on parent decision
    _apply_children(by_type, maps, staging, should_apply_fn=should_apply)

    session.status = ImportSession.Status.APPLIED
    summary = dict(session.summary or {})
    summary['applied'] = applied
    summary['skipped'] = skipped
    session.summary = summary
    session.save(update_fields=['status', 'summary', 'updated_at'])

    if staging.exists():
        shutil.rmtree(staging, ignore_errors=True)

    return summary


def _register_existing(entity_type, item, maps):
    """Зарегистрировать локальный id для FK, если запись уже есть."""
    rec = item.imported_snapshot
    nk = rec.get('natural_key')
    local = item.local_snapshot or {}
    if entity_type in {
        'targets', 'events', 'persons', 'formulars', 'formular_attachments',
        'country_attachments', 'target_vulnerabilities', 'person_infos',
        'person_attachments', 'person_photos',
    }:
        maps[entity_type][nk] = local.get('id') or nk
        return
    # title-based: find again
    obj = None
    try:
        payload, kind = _lookup_entity(entity_type, rec)
        if kind == 'found' and payload:
            if entity_type == 'countries':
                obj = Country.objects.filter(title=rec['title']).first()
                if obj:
                    maps[entity_type][nk] = obj.id
            elif entity_type == 'equipment':
                obj = _find_equipment(rec)
                if obj:
                    maps[entity_type][nk] = obj.id
            elif entity_type == 'units_of_measure':
                obj = UnitOfMeasure.objects.filter(symbol=rec['symbol']).first()
                if obj:
                    maps[entity_type][nk] = obj.id
            elif entity_type == 'equipment_parameter_definitions':
                obj = EquipmentParameterDefinition.objects.filter(code=rec['code']).first()
                if obj:
                    maps[entity_type][nk] = obj.id
            else:
                # generic title models
                model_map = {
                    'marker_color_palettes': MarkerColorPalette,
                    'markers': Marker,
                    'event_markers': EventMarker,
                    'action_types': ActionType,
                    'event_types': EventType,
                    'target_types': TargetType,
                    'country_sections': CountrySections,
                    'formular_sections': FormularSections,
                    'person_sections': PersonSections,
                    'relation_types': RelationType,
                    'equipment_categories': EquipmentCategory,
                }
                model = model_map.get(entity_type)
                if model and rec.get('title'):
                    obj = model.objects.filter(title=rec['title']).first()
                    if obj:
                        maps[entity_type][nk] = obj.id
    except Exception:
        pass


def _resolve(maps, entity_type, key):
    if not key:
        return None
    return maps.get(entity_type, {}).get(key)


def _apply_entity(entity_type, rec, maps, staging: Path, mode='create'):
    """
    mode: create | replace | merge
    """
    nk = rec['natural_key']
    merge = mode == 'merge'

    if entity_type == 'marker_color_palettes':
        obj = MarkerColorPalette.objects.filter(title=rec['title']).first()
        if not obj:
            obj = MarkerColorPalette(title=rec['title'])
            merge = False
        fields = {
            'color_first': rec['color_first'],
            'color_second': rec['color_second'],
            'color_third': rec['color_third'],
            'color_forth': rec['color_forth'],
        }
        for key, val in fields.items():
            if merge:
                setattr(obj, key, _merge_scalar(getattr(obj, key, None), val))
            else:
                setattr(obj, key, val)
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'markers':
        obj = Marker.objects.filter(title=rec['title']).first()
        if not obj:
            obj = Marker(title=rec['title'])
            merge = False
        if merge:
            obj.top = _merge_scalar(obj.top, rec.get('top', 0))
            obj.width = _merge_scalar(obj.width, rec.get('width', 100))
            obj.height = _merge_scalar(obj.height, rec.get('height', 50))
            if _is_empty(obj.scale):
                obj.scale = Decimal(str(rec.get('scale', '1')))
            obj.order = _merge_scalar(obj.order, rec.get('order', 1))
            if obj.is_flag is None:
                obj.is_flag = rec.get('is_flag', True)
            _merge_file(obj, 'path', rec.get('path'), staging)
        else:
            obj.top = rec.get('top', 0)
            obj.width = rec.get('width', 100)
            obj.height = rec.get('height', 50)
            obj.scale = Decimal(str(rec.get('scale', '1')))
            obj.order = rec.get('order', 1)
            obj.is_flag = rec.get('is_flag', True)
            _attach_media(obj, 'path', rec.get('path'), staging)
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'event_markers':
        obj = EventMarker.objects.filter(title=rec['title']).first()
        if not obj:
            obj = EventMarker(title=rec['title'])
            merge = False
        if merge:
            _merge_file(obj, 'path', rec.get('path'), staging)
        else:
            _attach_media(obj, 'path', rec.get('path'), staging)
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'action_types':
        obj = ActionType.objects.filter(title=rec['title']).first()
        if not obj:
            obj = ActionType(title=rec['title'])
            merge = False
        fields = {
            'color': rec.get('color', '#3388ff'),
            'line_type': rec.get('line_type', 'solid'),
            'zone_mode': rec.get('zone_mode', 'flat'),
            'is_inundation_zone': rec.get('is_inundation_zone', False),
            'min_elevation_deg': rec.get('min_elevation_deg'),
        }
        for key, val in fields.items():
            if merge:
                setattr(obj, key, _merge_scalar(getattr(obj, key, None), val))
            else:
                setattr(obj, key, val)
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'event_types':
        obj, _ = EventType.objects.get_or_create(title=rec['title'])
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'target_types':
        parent_id = _resolve(maps, 'target_types', rec.get('parent_key'))
        obj = TargetType.objects.filter(title=rec['title']).first()
        if not obj:
            obj = TargetType(title=rec['title'])
            merge = False
        if merge:
            if obj.parent_id is None and parent_id:
                obj.parent_id = parent_id
        else:
            obj.parent_id = parent_id
        obj.save()
        country_ids = []
        for ck in rec.get('country_keys') or []:
            cid = _resolve(maps, 'countries', ck)
            if cid:
                country_ids.append(cid)
        if country_ids:
            if merge:
                existing = set(obj.countries.values_list('id', flat=True))
                obj.countries.set(existing | set(country_ids))
            else:
                obj.countries.set(country_ids)
        maps[entity_type][nk] = obj.id
        return

    if entity_type in ('country_sections', 'formular_sections', 'person_sections'):
        model = {
            'country_sections': CountrySections,
            'formular_sections': FormularSections,
            'person_sections': PersonSections,
        }[entity_type]
        parent_id = _resolve(maps, entity_type, rec.get('parent_key'))
        obj = model.objects.filter(title=rec['title']).first()
        if not obj:
            obj = model(title=rec['title'])
            merge = False
        if merge:
            obj.order = _merge_scalar(obj.order, rec.get('order', 1))
            if obj.parent_id is None and parent_id:
                obj.parent_id = parent_id
        else:
            obj.order = rec.get('order', 1)
            obj.is_hidden = rec.get('is_hidden', False)
            obj.parent_id = parent_id
        if not merge:
            obj.is_hidden = rec.get('is_hidden', False)
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'relation_types':
        obj = RelationType.objects.filter(title=rec['title']).first()
        if not obj:
            obj = RelationType(title=rec['title'])
            merge = False
        if merge:
            obj.reverse_title = _merge_text(obj.reverse_title, rec.get('reverse_title') or '')
        else:
            obj.reverse_title = rec.get('reverse_title') or ''
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'equipment_categories':
        parent_id = _resolve(maps, 'equipment_categories', rec.get('parent_key'))
        obj = EquipmentCategory.objects.filter(title=rec['title']).first()
        if not obj:
            obj = EquipmentCategory(title=rec['title'])
            merge = False
        if merge:
            obj.order = _merge_scalar(obj.order, rec.get('order', 1))
            if obj.parent_id is None and parent_id:
                obj.parent_id = parent_id
        else:
            obj.order = rec.get('order', 1)
            obj.parent_id = parent_id
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'units_of_measure':
        obj = UnitOfMeasure.objects.filter(symbol=rec['symbol']).first()
        if not obj:
            obj = UnitOfMeasure(symbol=rec['symbol'])
            merge = False
        if merge:
            obj.title = _merge_scalar(obj.title, rec['title'])
        else:
            obj.title = rec['title']
        obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'equipment_parameter_definitions':
        unit_id = _resolve(maps, 'units_of_measure', rec.get('unit_key'))
        action_type_id = _resolve(maps, 'action_types', rec.get('action_type_key'))
        obj = EquipmentParameterDefinition.objects.filter(code=rec['code']).first()
        if not obj:
            obj = EquipmentParameterDefinition(code=rec['code'])
            merge = False
        if merge:
            obj.title = _merge_scalar(obj.title, rec['title'])
            if obj.unit_id is None and unit_id:
                obj.unit_id = unit_id
            if obj.action_type_id is None and action_type_id:
                obj.action_type_id = action_type_id
            obj.help_text = _merge_text(obj.help_text, rec.get('help_text') or '')
            obj.zone_color = _merge_scalar(obj.zone_color, rec.get('zone_color'))
            obj.zone_line_type = _merge_scalar(obj.zone_line_type, rec.get('zone_line_type'))
        else:
            obj.title = rec['title']
            obj.unit_id = unit_id
            obj.action_type_id = action_type_id
            obj.help_text = rec.get('help_text') or ''
            obj.zone_color = rec.get('zone_color')
            obj.zone_line_type = rec.get('zone_line_type')
        obj.save()
        cat_ids = [_resolve(maps, 'equipment_categories', ck) for ck in (rec.get('category_keys') or [])]
        cat_ids = [c for c in cat_ids if c]
        if cat_ids:
            if merge:
                existing = set(obj.categories.values_list('id', flat=True))
                obj.categories.set(existing | set(cat_ids))
            else:
                obj.categories.set(cat_ids)
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'countries':
        palette_id = _resolve(maps, 'marker_color_palettes', rec.get('marker_palette_key'))
        obj = Country.objects.filter(title=rec['title']).first()
        if not obj:
            defaults = {
                'title_short': rec.get('title_short') or '',
                'iso_code': rec.get('iso_code') or '',
            }
            if not palette_id:
                palette = MarkerColorPalette.objects.first()
                if not palette:
                    raise ValueError('Нет палитры маркеров для создания страны')
                palette_id = palette.id
            defaults['marker_palette_id'] = palette_id
            obj = Country.objects.create(title=rec['title'], **defaults)
        elif merge:
            obj.title_short = _merge_scalar(obj.title_short, rec.get('title_short') or '')
            obj.iso_code = _merge_scalar(obj.iso_code, rec.get('iso_code') or '')
            if obj.marker_palette_id is None and palette_id:
                obj.marker_palette_id = palette_id
            obj.save()
        else:
            obj.title_short = rec.get('title_short') or ''
            obj.iso_code = rec.get('iso_code') or ''
            if palette_id:
                obj.marker_palette_id = palette_id
            obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'equipment':
        category_id = _resolve(maps, 'equipment_categories', rec.get('category_key'))
        origin_id = _resolve(maps, 'countries', rec.get('origin_country_key'))
        obj = _find_equipment(rec)
        if not obj:
            obj = Equipment.objects.create(
                title=rec['title'],
                designation=rec.get('designation') or '',
                description=rec.get('description') or '',
                category_id=category_id,
                origin_country_id=origin_id,
            )
        elif merge:
            obj.title = _merge_scalar(obj.title, rec['title'])
            obj.designation = _merge_scalar(obj.designation, rec.get('designation') or '')
            obj.description = _merge_text(obj.description, rec.get('description') or '')
            if obj.category_id is None and category_id:
                obj.category_id = category_id
            if obj.origin_country_id is None and origin_id:
                obj.origin_country_id = origin_id
            obj.save()
        else:
            obj.title = rec['title']
            obj.designation = rec.get('designation') or ''
            obj.description = rec.get('description') or ''
            obj.category_id = category_id
            obj.origin_country_id = origin_id
            obj.save()
        maps[entity_type][nk] = obj.id
        return

    if entity_type == 'country_infos':
        country_id = _resolve(maps, 'countries', rec['country_key'])
        section_id = _resolve(maps, 'country_sections', rec['section_key'])
        if not country_id or not section_id:
            return
        obj = CountryInfo.objects.filter(country_id=country_id, section_id=section_id).first()
        if not obj:
            CountryInfo.objects.create(
                country_id=country_id,
                section_id=section_id,
                content=rec.get('content') or '',
            )
        elif merge:
            obj.content = _merge_text(obj.content, rec.get('content') or '')
            obj.save(update_fields=['content'])
        else:
            obj.content = rec.get('content') or ''
            obj.save(update_fields=['content'])
        return

    if entity_type == 'country_attachments':
        country_id = _resolve(maps, 'countries', rec['country_key'])
        section_id = _resolve(maps, 'country_sections', rec['section_key'])
        if not country_id or not section_id:
            return
        pk = uuid.UUID(rec['id'])
        obj = CountryAttachment.objects.filter(pk=pk).first()
        if not obj:
            obj = CountryAttachment(id=pk)
            merge = False
        obj.country_id = country_id
        obj.section_id = section_id
        if merge:
            obj.title = _merge_scalar(obj.title, rec.get('title') or '')
            obj.description = _merge_text(obj.description, rec.get('description') or '')
            _merge_file(obj, 'image', rec.get('image'), staging)
        else:
            obj.title = rec.get('title') or ''
            obj.description = rec.get('description') or ''
            _attach_media(obj, 'image', rec.get('image'), staging)
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'targets':
        pk = uuid.UUID(rec['id'])
        country_id = _resolve(maps, 'countries', rec['country_key'])
        if not country_id:
            return
        obj = Target.objects.filter(pk=pk).first()
        if not obj:
            obj = Target(id=pk)
            merge = False
        marker_id = _resolve(maps, 'markers', rec.get('marker_key'))
        type_id = _resolve(maps, 'target_types', rec.get('type_key'))
        parent_id = rec.get('parent_id')
        parent_uuid = uuid.UUID(parent_id) if parent_id else None
        if merge:
            obj.country_id = obj.country_id or country_id
            obj.title = _merge_scalar(obj.title, rec['title'])
            obj.label = _merge_scalar(obj.label, rec.get('label') or '')
            if obj.marker_id is None and marker_id:
                obj.marker_id = marker_id
            if obj.type_id is None and type_id:
                obj.type_id = type_id
            if obj.parent_id is None and parent_uuid:
                obj.parent_id = parent_uuid
            obj.lat = _merge_scalar(obj.lat, rec['lat'])
            obj.lng = _merge_scalar(obj.lng, rec['lng'])
            obj.action_radius = _merge_scalar(obj.action_radius, rec.get('action_radius'))
            obj.antenna_height_m = _merge_scalar(obj.antenna_height_m, rec.get('antenna_height_m') or 10.0)
            obj.crest_elevation_m = _merge_scalar(obj.crest_elevation_m, rec.get('crest_elevation_m'))
            obj.normal_pool_level_m = _merge_scalar(obj.normal_pool_level_m, rec.get('normal_pool_level_m'))
            obj.max_pool_level_m = _merge_scalar(obj.max_pool_level_m, rec.get('max_pool_level_m'))
        else:
            obj.country_id = country_id
            obj.title = rec['title']
            obj.label = rec.get('label') or ''
            obj.marker_id = marker_id
            obj.type_id = type_id
            obj.parent_id = parent_uuid
            obj.lat = rec['lat']
            obj.lng = rec['lng']
            obj.action_radius = rec.get('action_radius')
            obj.antenna_height_m = rec.get('antenna_height_m') or 10.0
            obj.crest_elevation_m = rec.get('crest_elevation_m')
            obj.normal_pool_level_m = rec.get('normal_pool_level_m')
            obj.max_pool_level_m = rec.get('max_pool_level_m')
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'formulars':
        pk = uuid.UUID(rec['id'])
        section_id = _resolve(maps, 'formular_sections', rec['section_key'])
        if not section_id:
            return
        obj = Formular.objects.filter(pk=pk).first()
        if not obj:
            obj = Formular(id=pk)
            merge = False
        obj.target_id = uuid.UUID(rec['target_id'])
        if merge:
            if obj.section_id is None:
                obj.section_id = section_id
            obj.content = _merge_text(obj.content, rec.get('content') or '')
        else:
            obj.section_id = section_id
            obj.content = rec.get('content') or ''
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'formular_attachments':
        pk = uuid.UUID(rec['id'])
        section_id = _resolve(maps, 'formular_sections', rec['section_key'])
        obj = FormularAttachment.objects.filter(pk=pk).first()
        if not obj:
            obj = FormularAttachment(id=pk)
            merge = False
        obj.target_id = uuid.UUID(rec['target_id'])
        if merge:
            if obj.section_id is None and section_id:
                obj.section_id = section_id
            obj.title = _merge_scalar(obj.title, rec.get('title') or '')
            obj.description = _merge_text(obj.description, rec.get('description') or '')
            _merge_file(obj, 'image', rec.get('image'), staging)
        else:
            obj.section_id = section_id
            obj.title = rec.get('title') or ''
            obj.description = rec.get('description') or ''
            _attach_media(obj, 'image', rec.get('image'), staging)
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'target_vulnerabilities':
        pk = uuid.UUID(rec['id'])
        obj = TargetVulnerability.objects.filter(pk=pk).first()
        if not obj:
            obj = TargetVulnerability(id=pk)
            merge = False
        obj.target_id = uuid.UUID(rec['target_id'])
        if merge:
            obj.title = _merge_scalar(obj.title, rec['title'])
            obj.description = _merge_text(obj.description, rec.get('description') or '')
            obj.lat = _merge_scalar(obj.lat, rec['lat'])
            obj.lng = _merge_scalar(obj.lng, rec['lng'])
            obj.order = _merge_scalar(obj.order, rec.get('order', 0))
            _merge_file(obj, 'image', rec.get('image'), staging)
        else:
            obj.title = rec['title']
            obj.description = rec.get('description') or ''
            obj.lat = rec['lat']
            obj.lng = rec['lng']
            obj.order = rec.get('order', 0)
            _attach_media(obj, 'image', rec.get('image'), staging)
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'events':
        pk = uuid.UUID(rec['id'])
        obj = Event.objects.filter(pk=pk).first()
        if not obj:
            obj = Event(id=pk)
            merge = False
        event_type_id = _resolve(maps, 'event_types', rec.get('event_type_key'))
        country_id = _resolve(maps, 'countries', rec.get('country_key'))
        marker_id = _resolve(maps, 'event_markers', rec.get('marker_key'))
        if merge:
            obj.title = _merge_scalar(obj.title, rec['title'])
            obj.object_name = _merge_scalar(obj.object_name, rec.get('object_name') or '')
            obj.description = _merge_text(obj.description, rec.get('description') or '')
            if obj.event_type_id is None and event_type_id:
                obj.event_type_id = event_type_id
            if obj.country_id is None and country_id:
                obj.country_id = country_id
            if obj.marker_id is None and marker_id:
                obj.marker_id = marker_id
            if obj.date_start is None and rec.get('date_start'):
                obj.date_start = parse_date(rec['date_start'])
            if obj.date_end is None and rec.get('date_end'):
                obj.date_end = parse_date(rec['date_end'])
            if obj.time_start is None and rec.get('time_start'):
                obj.time_start = parse_time(rec['time_start'])
            if obj.time_end is None and rec.get('time_end'):
                obj.time_end = parse_time(rec['time_end'])
            obj.color = _merge_scalar(obj.color, rec.get('color') or '#2f80ed')
            if not obj.shape and rec.get('shape'):
                obj.shape = rec.get('shape') or {}
        else:
            obj.title = rec['title']
            obj.object_name = rec.get('object_name') or ''
            obj.description = rec.get('description') or ''
            obj.event_type_id = event_type_id
            obj.country_id = country_id
            obj.marker_id = marker_id
            obj.date_start = parse_date(rec['date_start']) if rec.get('date_start') else None
            obj.date_end = parse_date(rec['date_end']) if rec.get('date_end') else None
            obj.time_start = parse_time(rec['time_start']) if rec.get('time_start') else None
            obj.time_end = parse_time(rec['time_end']) if rec.get('time_end') else None
            obj.color = rec.get('color') or '#2f80ed'
            obj.shape = rec.get('shape') or {}
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'persons':
        pk = uuid.UUID(rec['id'])
        obj = Person.objects.filter(pk=pk).first()
        if not obj:
            obj = Person(id=pk)
            merge = False
        obj.target_id = uuid.UUID(rec['target_id'])
        if merge:
            obj.full_name = _merge_scalar(obj.full_name, rec['full_name'])
            obj.position = _merge_scalar(obj.position, rec.get('position') or '')
            obj.order = _merge_scalar(obj.order, rec.get('order', 0))
        else:
            obj.full_name = rec['full_name']
            obj.position = rec.get('position') or ''
            obj.order = rec.get('order', 0)
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'person_infos':
        pk = uuid.UUID(rec['id'])
        section_id = _resolve(maps, 'person_sections', rec.get('section_key'))
        obj = PersonInfo.objects.filter(pk=pk).first()
        if not obj:
            obj = PersonInfo(id=pk)
            merge = False
        obj.person_id = uuid.UUID(rec['person_id'])
        if merge:
            if obj.section_id is None and section_id:
                obj.section_id = section_id
            obj.content = _merge_text(obj.content, rec.get('content') or '')
        else:
            obj.section_id = section_id
            obj.content = rec.get('content') or ''
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'person_attachments':
        pk = uuid.UUID(rec['id'])
        section_id = _resolve(maps, 'person_sections', rec.get('section_key'))
        obj = PersonAttachment.objects.filter(pk=pk).first()
        if not obj:
            obj = PersonAttachment(id=pk)
            merge = False
        obj.person_id = uuid.UUID(rec['person_id'])
        if merge:
            if obj.section_id is None and section_id:
                obj.section_id = section_id
            obj.title = _merge_scalar(obj.title, rec.get('title') or '')
            obj.description = _merge_text(obj.description, rec.get('description') or '')
            _merge_file(obj, 'image', rec.get('image'), staging)
        else:
            obj.section_id = section_id
            obj.title = rec.get('title') or ''
            obj.description = rec.get('description') or ''
            _attach_media(obj, 'image', rec.get('image'), staging)
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'person_photos':
        pk = uuid.UUID(rec['id'])
        obj = PersonPhoto.objects.filter(pk=pk).first()
        if not obj:
            obj = PersonPhoto(id=pk)
            merge = False
        obj.person_id = uuid.UUID(rec['person_id'])
        if merge:
            obj.title = _merge_scalar(obj.title, rec.get('title') or '')
            obj.order = _merge_scalar(obj.order, rec.get('order', 1))
            _merge_file(obj, 'image', rec.get('image'), staging)
        else:
            obj.title = rec.get('title') or ''
            obj.order = rec.get('order', 1)
            _attach_media(obj, 'image', rec.get('image'), staging)
        obj.save()
        maps[entity_type][nk] = str(obj.id)
        return

    if entity_type == 'person_relations':
        rt_id = _resolve(maps, 'relation_types', rec['relation_type_key'])
        if not rt_id:
            return
        obj = PersonRelation.objects.filter(
            person_from_id=uuid.UUID(rec['person_from_id']),
            person_to_id=uuid.UUID(rec['person_to_id']),
            relation_type_id=rt_id,
        ).first()
        if not obj:
            PersonRelation.objects.create(
                person_from_id=uuid.UUID(rec['person_from_id']),
                person_to_id=uuid.UUID(rec['person_to_id']),
                relation_type_id=rt_id,
                notes=rec.get('notes') or '',
            )
        elif merge:
            obj.notes = _merge_text(obj.notes, rec.get('notes') or '')
            obj.save(update_fields=['notes'])
        else:
            obj.notes = rec.get('notes') or ''
            obj.save(update_fields=['notes'])
        return


def _parent_child_mode(parent_item: ImportItem | None) -> str | None:
    """Режим обработки дочерних коллекций по решению родителя."""
    if parent_item is None:
        return None
    mode = _item_apply_mode(parent_item)
    if mode is None:
        return None
    if mode == 'merge':
        return 'merge'
    return 'replace'  # create / replace


def _apply_children(by_type, maps, staging, should_apply_fn):
    actions_by_target = {}
    for item in by_type.get('target_actions', []):
        tid = item.imported_snapshot['target_id']
        actions_by_target.setdefault(tid, []).append(item.imported_snapshot)

    te_by_target = {}
    for item in by_type.get('target_equipment', []):
        tid = item.imported_snapshot['target_id']
        te_by_target.setdefault(tid, []).append(item.imported_snapshot)

    target_items = {i.natural_key: i for i in by_type.get('targets', [])}

    for tid, actions in actions_by_target.items():
        t_item = target_items.get(tid)
        child_mode = _parent_child_mode(t_item)
        if child_mode is None:
            continue
        if not Target.objects.filter(pk=tid).exists():
            continue
        if child_mode == 'replace':
            TargetAction.objects.filter(target_id=tid).delete()
            for rec in actions:
                at_id = _resolve(maps, 'action_types', rec.get('action_type_key'))
                TargetAction.objects.create(
                    target_id=uuid.UUID(tid),
                    action_type_id=at_id,
                    radius=rec.get('radius'),
                    zone_geometry=rec.get('zone_geometry'),
                    zone_geometry_computed_at=(
                        parse_datetime(rec['zone_geometry_computed_at'])
                        if rec.get('zone_geometry_computed_at') else None
                    ),
                    zone_metadata=rec.get('zone_metadata'),
                )
        else:
            # merge: add missing by action_type; keep existing local zones
            existing_at = set(
                TargetAction.objects.filter(target_id=tid).values_list('action_type_id', flat=True)
            )
            for rec in actions:
                at_id = _resolve(maps, 'action_types', rec.get('action_type_key'))
                if not at_id or at_id in existing_at:
                    continue
                TargetAction.objects.create(
                    target_id=uuid.UUID(tid),
                    action_type_id=at_id,
                    radius=rec.get('radius'),
                    zone_geometry=rec.get('zone_geometry'),
                    zone_geometry_computed_at=(
                        parse_datetime(rec['zone_geometry_computed_at'])
                        if rec.get('zone_geometry_computed_at') else None
                    ),
                    zone_metadata=rec.get('zone_metadata'),
                )
                existing_at.add(at_id)

    for tid, links in te_by_target.items():
        t_item = target_items.get(tid)
        child_mode = _parent_child_mode(t_item)
        if child_mode is None:
            continue
        if not Target.objects.filter(pk=tid).exists():
            continue
        if child_mode == 'replace':
            TargetEquipment.objects.filter(target_id=tid).delete()
            for rec in links:
                eq_id = _resolve(maps, 'equipment', rec['equipment_key'])
                if not eq_id:
                    continue
                TargetEquipment.objects.create(
                    target_id=uuid.UUID(tid),
                    equipment_id=eq_id,
                    quantity=rec.get('quantity') or 1,
                )
        else:
            existing_eq = set(
                TargetEquipment.objects.filter(target_id=tid).values_list('equipment_id', flat=True)
            )
            for rec in links:
                eq_id = _resolve(maps, 'equipment', rec['equipment_key'])
                if not eq_id or eq_id in existing_eq:
                    continue
                TargetEquipment.objects.create(
                    target_id=uuid.UUID(tid),
                    equipment_id=eq_id,
                    quantity=rec.get('quantity') or 1,
                )
                existing_eq.add(eq_id)

    eq_items = {i.natural_key: i for i in by_type.get('equipment', [])}
    images_by_eq = {}
    for item in by_type.get('equipment_images', []):
        images_by_eq.setdefault(item.imported_snapshot['equipment_key'], []).append(item.imported_snapshot)
    vals_by_eq = {}
    for item in by_type.get('equipment_parameter_values', []):
        vals_by_eq.setdefault(item.imported_snapshot['equipment_key'], []).append(item.imported_snapshot)

    for eq_key, images in images_by_eq.items():
        e_item = eq_items.get(eq_key)
        child_mode = _parent_child_mode(e_item)
        if child_mode is None:
            continue
        eq_id = _resolve(maps, 'equipment', eq_key)
        if not eq_id:
            continue
        if child_mode == 'replace':
            EquipmentImage.objects.filter(equipment_id=eq_id).delete()
            for rec in images:
                img = EquipmentImage(equipment_id=eq_id, title=rec.get('title') or '', order=rec.get('order', 0))
                _attach_media(img, 'image', rec.get('image'), staging)
                img.save()
        else:
            existing = list(EquipmentImage.objects.filter(equipment_id=eq_id))
            existing_keys = {
                (img.title or '', img.order, schema.file_rel_path(img.image) or '')
                for img in existing
            }
            for rec in images:
                key = (rec.get('title') or '', rec.get('order', 0), rec.get('image') or '')
                # match by title+order or exact image path
                if any(
                    (img.title or '', img.order) == (key[0], key[1])
                    or (schema.file_rel_path(img.image) or '') == key[2]
                    for img in existing
                ):
                    continue
                if key in existing_keys:
                    continue
                img = EquipmentImage(equipment_id=eq_id, title=rec.get('title') or '', order=rec.get('order', 0))
                _attach_media(img, 'image', rec.get('image'), staging)
                img.save()
                existing.append(img)

    for eq_key, vals in vals_by_eq.items():
        e_item = eq_items.get(eq_key)
        child_mode = _parent_child_mode(e_item)
        if child_mode is None:
            continue
        eq_id = _resolve(maps, 'equipment', eq_key)
        if not eq_id:
            continue
        if child_mode == 'replace':
            EquipmentParameterValue.objects.filter(equipment_id=eq_id).delete()
            for rec in vals:
                param_id = _resolve(maps, 'equipment_parameter_definitions', rec['parameter_key'])
                if not param_id:
                    continue
                EquipmentParameterValue.objects.create(
                    equipment_id=eq_id,
                    parameter_id=param_id,
                    value=rec['value'],
                )
        else:
            for rec in vals:
                param_id = _resolve(maps, 'equipment_parameter_definitions', rec['parameter_key'])
                if not param_id:
                    continue
                obj = EquipmentParameterValue.objects.filter(
                    equipment_id=eq_id, parameter_id=param_id,
                ).first()
                if not obj:
                    EquipmentParameterValue.objects.create(
                        equipment_id=eq_id,
                        parameter_id=param_id,
                        value=rec['value'],
                    )
                elif _is_empty(obj.value) and not _is_empty(rec.get('value')):
                    obj.value = rec['value']
                    obj.save(update_fields=['value'])
