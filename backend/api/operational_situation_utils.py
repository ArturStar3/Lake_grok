"""Создание и версионирование оперативной обстановки."""

from django.db import transaction
from django.db.models import Max

from formular.models import (
    OperationalSituation,
    OperationalSituationRevision,
    OperationalSituationRevisionChangeKind,
)
from formular.zone_geometry_validation import validate_zone_geometry


def validate_situation_geometry(geometry):
    if geometry in (None, ''):
        raise ValueError('Геометрия обязательна')
    return validate_zone_geometry(geometry)


def _apply_revision_fields(revision, data, *, change_kind, user, parent_revision=None):
    revision.title = data['title']
    revision.description = data.get('description', '')
    revision.situation_date = data.get('situation_date')
    revision.situation_time = data.get('situation_time')
    revision.color = data.get('color', '#2f80ed')
    revision.geometry = validate_situation_geometry(data.get('geometry'))
    revision.change_kind = change_kind
    revision.change_note = data.get('change_note', '')
    revision.parent_revision = parent_revision
    revision.created_by = user
    revision.save()

    country_ids = data.get('country_ids')
    if country_ids is not None:
        revision.countries.set(country_ids)


@transaction.atomic
def create_operational_situation(data, user):
    situation = OperationalSituation.objects.create(created_by=user)
    revision = OperationalSituationRevision(
        situation=situation,
        version=1,
    )
    _apply_revision_fields(
        revision,
        data,
        change_kind=OperationalSituationRevisionChangeKind.INITIAL,
        user=user,
    )
    situation.current_revision = revision
    situation.save(update_fields=['current_revision'])
    return situation


@transaction.atomic
def correct_revision(revision, data, user):
    """Исправление конкретной ревизии на месте (без новой версии)."""
    if not revision:
        raise ValueError('Ревизия не указана')
    _apply_revision_fields(
        revision,
        data,
        change_kind=OperationalSituationRevisionChangeKind.CORRECTION,
        user=user,
        parent_revision=revision.parent_revision,
    )
    return revision.situation


@transaction.atomic
def correct_current_revision(situation, data, user):
    revision = situation.current_revision
    if not revision:
        raise ValueError('У обстановки нет текущей ревизии')
    return correct_revision(revision, data, user)


@transaction.atomic
def create_new_revision(situation, data, user):
    current = situation.current_revision
    if not current:
        raise ValueError('У обстановки нет текущей ревизии')
    next_version = (
        situation.revisions.aggregate(max_v=Max('version'))['max_v'] or 0
    ) + 1
    revision = OperationalSituationRevision(
        situation=situation,
        version=next_version,
    )
    _apply_revision_fields(
        revision,
        data,
        change_kind=OperationalSituationRevisionChangeKind.NEW_STATE,
        user=user,
        parent_revision=current,
    )
    situation.current_revision = revision
    situation.save(update_fields=['current_revision'])
    return situation


@transaction.atomic
def fork_operational_situation(source_situation, data, user):
    source_revision = source_situation.current_revision
    if not source_revision:
        raise ValueError('Исходная обстановка не содержит данных')

    payload = {
        'title': data.get('title', source_revision.title),
        'description': data.get('description', source_revision.description),
        'situation_date': data.get('situation_date', source_revision.situation_date),
        'situation_time': data.get('situation_time', source_revision.situation_time),
        'color': data.get('color', source_revision.color),
        'geometry': data.get('geometry', source_revision.geometry),
        'change_note': data.get('change_note', ''),
    }
    if data.get('country_ids') is not None:
        payload['country_ids'] = data['country_ids']
    else:
        payload['country_ids'] = list(source_revision.countries.values_list('id', flat=True))

    situation = OperationalSituation.objects.create(created_by=user)
    revision = OperationalSituationRevision(
        situation=situation,
        version=1,
    )
    _apply_revision_fields(
        revision,
        payload,
        change_kind=OperationalSituationRevisionChangeKind.FORK,
        user=user,
        parent_revision=source_revision,
    )
    situation.current_revision = revision
    situation.save(update_fields=['current_revision'])
    return situation


@transaction.atomic
def delete_operational_situation_revision(revision):
    """Удаление ревизии. Если это последняя — удаляется вся серия обстановки."""
    if not revision:
        raise ValueError('Ревизия не указана')

    situation = revision.situation
    if situation.revisions.count() <= 1:
        situation.delete()
        return None

    is_current = situation.current_revision_id == revision.id
    revision.delete()

    if is_current:
        new_current = situation.revisions.order_by('-version').first()
        situation.current_revision = new_current
        situation.save(update_fields=['current_revision'])

    return situation
