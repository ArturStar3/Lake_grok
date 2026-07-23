"""Общие фикстуры для тестов accounts и API."""

from django.contrib.auth import get_user_model

from accounts.enums import ModuleLevel, UserStatus
from accounts.models import SecurityGroup
from formular.models import Country, MarkerColorPalette

User = get_user_model()

TEST_PASSWORD = 'TestPass1'
ADMIN_PASSWORD = 'AdminPass1'

DEFAULT_TEST_PALETTE = {
    'title': 'Синий (тест)',
    'color_first': '#008DD2',
    'color_second': '#FEFEFE',
    'color_third': '#00A0E3',
    'color_forth': '#A2D9F7',
}


def get_or_create_test_marker_palette(**overrides):
    spec = {**DEFAULT_TEST_PALETTE, **overrides}
    palette, _ = MarkerColorPalette.objects.get_or_create(
        title=spec['title'],
        defaults={
            'color_first': spec['color_first'],
            'color_second': spec['color_second'],
            'color_third': spec['color_third'],
            'color_forth': spec['color_forth'],
        },
    )
    return palette


def create_country(**kwargs):
    marker_palette = kwargs.pop('marker_palette', None)
    if marker_palette is None:
        marker_palette = (
            MarkerColorPalette.objects.filter(title='Синий').first()
            or get_or_create_test_marker_palette()
        )
    defaults = {
        'title': 'Тестовая страна',
        'title_short': 'ТС',
        'iso_code': 'TST',
        'marker_palette': marker_palette,
    }
    defaults.update(kwargs)
    return Country.objects.create(**defaults)


def create_admin_group(**kwargs):
    defaults = {
        'name': 'Тест-админы',
        'targets': ModuleLevel.WRITE_DELETE,
        'events': ModuleLevel.WRITE_DELETE,
        'operational_situations': ModuleLevel.WRITE_DELETE,
        'formular': ModuleLevel.WRITE,
        'country_dossier': ModuleLevel.WRITE,
        'persons': ModuleLevel.WRITE_DELETE,
        'equipment': ModuleLevel.WRITE,
        'reports': ModuleLevel.WRITE_DELETE,
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
