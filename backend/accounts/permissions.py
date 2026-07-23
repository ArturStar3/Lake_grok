from rest_framework.permissions import BasePermission

from accounts.enums import UserStatus
from accounts.services.permissions import (
    can_approve_registrations,
    can_manage_reference,
    can_manage_users,
    can_read_module,
    can_write_module,
    get_allowed_country_ids,
    has_country_access,
    is_active_user,
    is_super_access,
)


class IsActiveAppUser(BasePermission):
    def has_permission(self, request, view):
        return is_active_user(request.user)


class IsSuperUserOrReadOnlyReference(BasePermission):
    """Справочники: чтение активным пользователям, запись — с правом manage_reference."""

    def has_permission(self, request, view):
        if not is_active_user(request.user):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return can_manage_reference(request.user)


class CanManageUsers(BasePermission):
    def has_permission(self, request, view):
        return can_manage_users(request.user)


class CanApproveRegistrations(BasePermission):
    def has_permission(self, request, view):
        return can_approve_registrations(request.user)


class ModulePermission(BasePermission):
    """Проверка прав модуля: GET/HEAD/OPTIONS — read, остальное — write."""

    module = 'targets'

    def has_permission(self, request, view):
        if not is_active_user(request.user):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return can_read_module(request.user, self.module)
        return can_write_module(request.user, self.module)


class TargetsPermission(ModulePermission):
    module = 'targets'


class EventsPermission(ModulePermission):
    module = 'events'


class OperationalSituationsPermission(ModulePermission):
    module = 'operational_situations'


class FormularPermission(ModulePermission):
    module = 'formular'


class CountryDossierPermission(ModulePermission):
    module = 'country_dossier'


class PersonsPermission(ModulePermission):
    module = 'persons'


class EquipmentPermission(ModulePermission):
    module = 'equipment'


class ReportsPermission(ModulePermission):
    module = 'reports'


class DataExchangePermission(ModulePermission):
    module = 'data_exchange'


class CountryScopedQuerysetMixin:
    """Фильтрация queryset по разрешённым странам."""

    country_field = 'country_id'

    def filter_by_allowed_countries(self, queryset):
        allowed = get_allowed_country_ids(self.request.user)
        if allowed is None:
            return queryset
        if not allowed:
            return queryset.none()
        return queryset.filter(**{f'{self.country_field}__in': allowed})

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self, 'action') and self.action in ('list', 'retrieve', 'parent_options', 'formular_completion'):
            return self.filter_by_allowed_countries(qs)
        return self.filter_by_allowed_countries(qs)


def check_country_access_or_404(user, country_id):
    if not has_country_access(user, country_id):
        from rest_framework.exceptions import NotFound
        raise NotFound()


def get_client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
