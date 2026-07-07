"""Хелперы доступа для API views."""

from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.permissions import IsActiveAppUser
from accounts.services.permissions import (
    can_delete,
    can_manage_reference,
    get_allowed_country_ids,
    has_country_access,
    is_active_user,
    user_can_read,
    user_can_write,
)


class ActiveUserMixin:
    permission_classes = [IsActiveAppUser]


def ensure_country_access(user, country_id):
    if not has_country_access(user, country_id):
        raise NotFound()


def ensure_can_read(user, module, country_id=None):
    if not user_can_read(user, module, country_id):
        if country_id is not None and is_active_user(user):
            raise NotFound()
        raise PermissionDenied('Недостаточно прав для просмотра')


def ensure_can_write(user, module, country_id=None):
    if not user_can_write(user, module, country_id):
        if country_id is not None and is_active_user(user):
            raise NotFound()
        raise PermissionDenied('Недостаточно прав для редактирования')


def ensure_can_delete(user):
    if not can_delete(user):
        raise PermissionDenied('Недостаточно прав для удаления')


def ensure_can_manage_reference(user):
    if not can_manage_reference(user):
        raise PermissionDenied('Недостаточно прав для управления справочниками')


def filter_by_user_countries(queryset, user, country_field='country_id'):
    allowed = get_allowed_country_ids(user)
    if allowed is None:
        return queryset
    if not allowed:
        return queryset.none()
    return queryset.filter(**{f'{country_field}__in': allowed})
