"""Import sessions are private; country checks precede local snapshots."""

import uuid

from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.services.permissions import (
    can_manage_reference, can_write_module, get_allowed_country_ids, is_active_user,
    is_super_access,
)
from formular import models


GLOBAL_ENTITIES = frozenset({
    'marker_color_palettes', 'markers', 'event_markers', 'action_types',
    'event_types', 'country_sections', 'formular_sections', 'person_sections',
    'relation_types', 'equipment_categories', 'units_of_measure',
    'equipment_parameter_definitions', 'target_types', 'equipment',
    'equipment_images', 'equipment_parameter_values', 'countries',
})


def ensure_session_access(session, user):
    if not is_active_user(user) or (not is_super_access(user) and session.created_by_id != user.pk):
        raise NotFound('Сессия не найдена.')


def ensure_import_permission(user):
    if not is_active_user(user) or not can_write_module(user, 'data_exchange'):
        raise PermissionDenied('Недостаточно прав для импорта.')


def validate_bundle_scope(data, user):
    ensure_import_permission(user)
    allowed = get_allowed_country_ids(user)
    if allowed is None:
        return

    def check(queryset, country_field):
        if queryset.exclude(**{f'{country_field}__in': allowed}).exists():
            raise PermissionDenied('Бандл содержит данные недоступной страны.')

    def uuid_ids(values):
        try:
            return {uuid.UUID(str(value)) for value in values if value}
        except (ValueError, TypeError, AttributeError) as exc:
            raise ValueError('Некорректный идентификатор в бандле') from exc

    records = [rec for rows in data.values() for rec in rows]
    country_keys = {rec['country_key'] for rec in records if rec.get('country_key')}
    country_keys.update(rec['title'] for rec in data.get('countries', []))
    countries = dict(models.Country.objects.filter(title__in=country_keys).values_list('title', 'id'))
    if any(countries.get(key) not in allowed for key in country_keys):
        raise PermissionDenied('Бандл содержит данные недоступной страны.')

    # Inspect both proposed relations and current ownership of overwritten UUIDs.
    target_ids = uuid_ids(
        [rec.get('id') or rec['natural_key'] for rec in data.get('targets', [])]
        + [rec.get('target_id') for rec in records]
        + [rec.get('parent_id') for rec in data.get('targets', [])]
    )
    check(models.Target.objects.filter(pk__in=target_ids), 'country_id')
    person_ids = uuid_ids(
        [rec.get('id') or rec['natural_key'] for rec in data.get('persons', [])]
        + [rec.get(field) for rec in records for field in ('person_id', 'person_from_id', 'person_to_id')]
    )
    check(models.Person.objects.filter(pk__in=person_ids), 'target__country_id')
    scoped_models = {
        'country_attachments': (models.CountryAttachment, 'country_id'),
        'targets': (models.Target, 'country_id'),
        'events': (models.Event, 'country_id'),
        'formulars': (models.Formular, 'target__country_id'),
        'formular_attachments': (models.FormularAttachment, 'target__country_id'),
        'target_vulnerabilities': (models.TargetVulnerability, 'target__country_id'),
        'persons': (models.Person, 'target__country_id'),
        'person_infos': (models.PersonInfo, 'person__target__country_id'),
        'person_attachments': (models.PersonAttachment, 'person__target__country_id'),
        'person_photos': (models.PersonPhoto, 'person__target__country_id'),
    }
    for entity_type, (model, country_field) in scoped_models.items():
        ids = uuid_ids([rec.get('id') or rec['natural_key'] for rec in data.get(entity_type, [])])
        check(model.objects.filter(pk__in=ids), country_field)
    targets_in_bundle = {rec.get('id') or rec['natural_key'] for rec in data.get('targets', [])}
    persons_in_bundle = {rec.get('id') or rec['natural_key'] for rec in data.get('persons', [])}
    existing_targets = {str(pk) for pk in models.Target.objects.filter(pk__in=target_ids).values_list('pk', flat=True)}
    existing_persons = {str(pk) for pk in models.Person.objects.filter(pk__in=person_ids).values_list('pk', flat=True)}
    for rec in records:
        if rec.get('target_id') and rec['target_id'] not in targets_in_bundle | existing_targets:
            raise ValueError('Не найден объект для импортируемой записи')
        for field in ('person_id', 'person_from_id', 'person_to_id'):
            if rec.get(field) and rec[field] not in persons_in_bundle | existing_persons:
                raise ValueError('Не найдена персоналия для импортируемой записи')


def validate_reference_changes(items, user, apply_mode):
    if can_manage_reference(user):
        return
    equipment_modes = {
        item.natural_key: apply_mode(item) for item in items if item.entity_type == 'equipment'
    }
    def changes_global(item):
        if item.entity_type in ('equipment_images', 'equipment_parameter_values'):
            return equipment_modes.get(item.imported_snapshot.get('equipment_key')) is not None
        return item.entity_type in GLOBAL_ENTITIES and apply_mode(item) is not None
    if any(changes_global(item) for item in items):
        raise PermissionDenied('Для изменения общих справочников требуется право управления справочниками.')
