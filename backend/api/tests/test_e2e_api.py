"""End-to-end тесты основных API-маршрутов."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.enums import ModuleLevel
from accounts.tests.base import (
    ADMIN_PASSWORD,
    TEST_PASSWORD,
    auth_header,
    create_admin_group,
    create_country,
    create_user,
)
from formular.models import Target, TargetType

User = get_user_model()


class CoreApiE2ETests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = create_country(iso_code='E2E', title='E2E Country')
        cls.target_type = TargetType.objects.create(title='База', order=1)
        cls.target_type.countries.add(cls.country)
        cls.admin_group = create_admin_group(name='E2E Admins')
        cls.admin_group.countries.add(cls.country)
        cls.admin = create_user('e2e_admin', password=ADMIN_PASSWORD, groups=[cls.admin_group])

    def test_public_reference_endpoints_require_auth(self):
        response = self.client.get('/api/v1/countries/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_targets_list_create_retrieve_flow(self):
        headers = auth_header(self.client, 'e2e_admin', ADMIN_PASSWORD)
        list_resp = self.client.get('/api/v1/targets/', **headers)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)

        create_resp = self.client.post(
            '/api/v1/targets/',
            {
                'title': 'E2E Object',
                'label': 'EO-1',
                'country': self.country.id,
                'type': self.target_type.id,
                'lat': 55.75,
                'lng': 37.62,
                'action_radius': 10,
            },
            format='json',
            **headers,
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        target_id = create_resp.data['id']

        detail = self.client.get(f'/api/v1/targets/{target_id}/', **headers)
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data['title'], 'E2E Object')
        self.assertTrue(Target.objects.filter(pk=target_id).exists())

    def test_country_scoped_user_sees_only_allowed_country(self):
        other_country = create_country(iso_code='OTH', title='Other Country')
        limited_group = create_admin_group(
            name='Limited',
            targets=ModuleLevel.READ,
            can_manage_users=False,
            can_approve_registrations=False,
        )
        limited_group.countries.add(self.country)
        create_user('limited', groups=[limited_group])
        Target.objects.create(
            title='Visible',
            label='V1',
            country=self.country,
            type=self.target_type,
            lat=1,
            lng=2,
        )
        Target.objects.create(
            title='Hidden',
            label='H1',
            country=other_country,
            type=self.target_type,
            lat=3,
            lng=4,
        )

        headers = auth_header(self.client, 'limited', TEST_PASSWORD)
        response = self.client.get('/api/v1/targets/', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item['title'] for item in response.data}
        self.assertIn('Visible', titles)
        self.assertNotIn('Hidden', titles)

    def test_markers_and_action_types_readable(self):
        headers = auth_header(self.client, 'e2e_admin', ADMIN_PASSWORD)
        markers = self.client.get('/api/v1/markers/', **headers)
        self.assertEqual(markers.status_code, status.HTTP_200_OK)
        actions = self.client.get('/api/v1/action-types/', **headers)
        self.assertEqual(actions.status_code, status.HTTP_200_OK)
