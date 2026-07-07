"""Сервис вычисления эффективных прав пользователя."""

from accounts.enums import LEVEL_RANK, MODULE_FIELDS, ModuleLevel, UserStatus
from accounts.models import SecurityGroup, UserProfile
from formular.models import Country


def get_profile(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return getattr(user, 'profile', None)
    return getattr(user, 'profile', None)


def is_super_access(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def is_active_user(user):
    if is_super_access(user):
        return True
    profile = get_profile(user)
    return profile is not None and profile.status == UserStatus.ACTIVE


def _security_groups_qs(user):
    profile = get_profile(user)
    if not profile:
        return SecurityGroup.objects.none()
    return profile.security_groups.all()


def _security_groups_list(user):
    """Один запрос к группам — переиспользуется в расчёте прав."""
    profile = get_profile(user)
    if not profile:
        return []
    prefetched = getattr(profile, '_prefetched_objects_cache', {}).get('security_groups')
    if prefetched is not None:
        return list(prefetched)
    return list(_security_groups_qs(user))


def get_allowed_country_ids(user):
    if is_super_access(user):
        return None
    profile = get_profile(user)
    if not profile:
        return set()
    return set(
        Country.objects.filter(security_groups__users=profile)
        .values_list('id', flat=True)
        .distinct()
    )


def get_module_permission(user, module):
    if is_super_access(user):
        return ModuleLevel.WRITE
    if module not in MODULE_FIELDS:
        return ModuleLevel.NONE
    best = ModuleLevel.NONE
    for group in _security_groups_list(user):
        level = getattr(group, module, ModuleLevel.NONE)
        if LEVEL_RANK.get(level, 0) > LEVEL_RANK.get(best, 0):
            best = level
    return best


def has_flag(user, flag_name):
    if is_super_access(user):
        return True
    for group in _security_groups_list(user):
        if getattr(group, flag_name, False):
            return True
    return False


def can_read_module(user, module):
    return LEVEL_RANK.get(get_module_permission(user, module), 0) >= LEVEL_RANK[ModuleLevel.READ]


def can_write_module(user, module):
    return LEVEL_RANK.get(get_module_permission(user, module), 0) >= LEVEL_RANK[ModuleLevel.WRITE]


def can_delete(user):
    return has_flag(user, 'can_delete')


def can_manage_reference(user):
    return has_flag(user, 'can_manage_reference')


def can_manage_users(user):
    return has_flag(user, 'can_manage_users')


def can_approve_registrations(user):
    return has_flag(user, 'can_approve_registrations')


def has_country_access(user, country_id):
    if country_id is None:
        return True
    allowed = get_allowed_country_ids(user)
    if allowed is None:
        return True
    try:
        cid = int(country_id)
    except (TypeError, ValueError):
        return False
    return cid in allowed


def user_can_read(user, module, country_id=None):
    if not is_active_user(user):
        return False
    if not can_read_module(user, module):
        return False
    if country_id is not None and not has_country_access(user, country_id):
        return False
    return True


def user_can_write(user, module, country_id=None):
    if not is_active_user(user):
        return False
    if not can_write_module(user, module):
        return False
    if country_id is not None and not has_country_access(user, country_id):
        return False
    return True


def build_permissions_payload(user):
    if is_super_access(user):
        modules = {m: ModuleLevel.WRITE for m in MODULE_FIELDS}
        return {
            'is_superuser': True,
            'modules': modules,
            'can_delete': True,
            'can_manage_reference': True,
            'can_manage_users': True,
            'can_approve_registrations': True,
            'allowed_country_ids': None,
        }

    groups = _security_groups_list(user)
    modules = {}
    for module in MODULE_FIELDS:
        best = ModuleLevel.NONE
        for group in groups:
            level = getattr(group, module, ModuleLevel.NONE)
            if LEVEL_RANK.get(level, 0) > LEVEL_RANK.get(best, 0):
                best = level
        modules[module] = best

    allowed = get_allowed_country_ids(user)
    return {
        'is_superuser': False,
        'modules': modules,
        'can_delete': any(getattr(g, 'can_delete', False) for g in groups),
        'can_manage_reference': any(getattr(g, 'can_manage_reference', False) for g in groups),
        'can_manage_users': any(getattr(g, 'can_manage_users', False) for g in groups),
        'can_approve_registrations': any(
            getattr(g, 'can_approve_registrations', False) for g in groups
        ),
        'allowed_country_ids': sorted(allowed) if allowed is not None else [],
    }


def filter_queryset_by_countries(queryset, user, country_field='country_id'):
    allowed = get_allowed_country_ids(user)
    if allowed is None:
        return queryset
    if not allowed:
        return queryset.none()
    return queryset.filter(**{f'{country_field}__in': allowed})
