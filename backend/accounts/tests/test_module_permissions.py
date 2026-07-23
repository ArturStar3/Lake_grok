"""Тесты уровня write_delete и прав на удаление по модулям."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.enums import ModuleLevel
from accounts.models import SecurityGroup
from accounts.services.permissions import can_delete_module, can_write_module
from accounts.tests.base import TEST_PASSWORD, create_country, create_user
from formular.models import Target, TargetType

User = get_user_model()


class ModuleWriteDeletePermissionTests(APITestCase):
    def setUp(self):
        self.country = create_country(iso_code='KAZ', title='Казахстан')
        self.target_type = TargetType.objects.create(title='Тип')

    def _group(self, **module_levels):
        defaults = {
            'name': 'Тестовая группа',
            'targets': ModuleLevel.NONE,
            'events': ModuleLevel.NONE,
            'operational_situations': ModuleLevel.NONE,
            'formular': ModuleLevel.NONE,
            'country_dossier': ModuleLevel.NONE,
            'persons': ModuleLevel.NONE,
            'equipment': ModuleLevel.NONE,
            'reports': ModuleLevel.NONE,
            'data_exchange': ModuleLevel.NONE,
        }
        defaults.update(module_levels)
        group = SecurityGroup.objects.create(**defaults)
        group.countries.add(self.country)
        return group

    def test_me_payload_has_no_can_delete(self):
        group = self._group(targets=ModuleLevel.WRITE_DELETE)
        user = create_user('perm_user', groups=(group,))
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        perms = response.data['permissions']
        self.assertNotIn('can_delete', perms)
        self.assertEqual(perms['modules']['targets'], ModuleLevel.WRITE_DELETE)

    def test_write_allows_edit_not_delete(self):
        group = self._group(targets=ModuleLevel.WRITE)
        user = create_user('write_only', groups=(group,))
        self.assertTrue(can_write_module(user, 'targets'))
        self.assertFalse(can_delete_module(user, 'targets'))

    def test_write_delete_allows_both(self):
        group = self._group(targets=ModuleLevel.WRITE_DELETE)
        user = create_user('write_del', groups=(group,))
        self.assertTrue(can_write_module(user, 'targets'))
        self.assertTrue(can_delete_module(user, 'targets'))

    def test_destroy_target_requires_write_delete(self):
        group = self._group(targets=ModuleLevel.WRITE)
        user = create_user('no_del', groups=(group,))
        target = Target.objects.create(
            title='Obj',
            country=self.country,
            type=self.target_type,
            lat=43.2,
            lng=76.9,
        )
        self.client.force_authenticate(user=user)
        response = self.client.delete(f'/api/v1/targets/{target.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Target.objects.filter(pk=target.id).exists())

    def test_destroy_target_with_write_delete(self):
        group = self._group(targets=ModuleLevel.WRITE_DELETE)
        user = create_user('can_del', password=TEST_PASSWORD, groups=(group,))
        target = Target.objects.create(
            title='Obj2',
            country=self.country,
            type=self.target_type,
            lat=43.3,
            lng=76.8,
        )
        login = self.client.post(
            '/api/v1/auth/login/',
            {'username': 'can_del', 'password': TEST_PASSWORD},
            format='json',
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        token = login.data['access']
        response = self.client.delete(
            f'/api/v1/targets/{target.id}/',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Target.objects.filter(pk=target.id).exists())
