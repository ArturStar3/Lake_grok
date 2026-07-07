"""Общие фикстуры для тестов accounts и API."""

from django.contrib.auth import get_user_model

from accounts.enums import ModuleLevel, UserStatus
from accounts.models import SecurityGroup
from formular.enums import Colors
from formular.models import Country

User = get_user_model()

TEST_PASSWORD = 'TestPass1'
ADMIN_PASSWORD = 'AdminPass1'


def create_country(**kwargs):
    defaults = {
        'title': 'Тестовая страна',
        'title_short': 'ТС',
        'iso_code': 'TST',
        'color': Colors.blue.name,
    }
    defaults.update(kwargs)
    return Country.objects.create(**defaults)


def create_admin_group(**kwargs):
    defaults = {
        'name': 'Тест-админы',
        'targets': ModuleLevel.WRITE,
        'events': ModuleLevel.WRITE,
        'operational_situations': ModuleLevel.WRITE,
        'formular': ModuleLevel.WRITE,
        'country_dossier': ModuleLevel.WRITE,
        'persons': ModuleLevel.WRITE,
        'equipment': ModuleLevel.WRITE,
        'can_delete': True,
        'can_manage_reference': True,
        'can_manage_users': True,
        'can_approve_registrations': True,
    }
    defaults.update(kwargs)
    return SecurityGroup.objects.create(**defaults)


def create_user(username, password=TEST_PASSWORD, *, active=True, superuser=False, groups=()):
    user = User.objects.create_user(
        username=username,
        password=password,
        is_active=active,
        is_superuser=superuser,
    )
    if superuser:
        user.is_staff = True
        user.save(update_fields=['is_staff'])
    profile = user.profile
    if active and not superuser:
        profile.status = UserStatus.ACTIVE
    elif not superuser:
        profile.status = UserStatus.PENDING
        user.is_active = False
        user.save(update_fields=['is_active'])
    profile.save()
    if groups:
        profile.security_groups.set(groups)
    return user


def auth_header(client, username, password):
    response = client.post(
        '/api/v1/auth/login/',
        {'username': username, 'password': password},
        format='json',
    )
    assert response.status_code == 200, response.data
    token = response.data['access']
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}
