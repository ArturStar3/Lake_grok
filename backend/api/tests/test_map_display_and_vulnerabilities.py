"""Тесты API настроек карты и уязвимостей объектов."""

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.base import ADMIN_PASSWORD, auth_header, create_admin_group, create_country, create_user
from formular.models import MapDisplaySettings, Target, TargetType, TargetVulnerability


class MapDisplaySettingsApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = create_country(iso_code='MAP', title='Map Country')
        cls.admin_group = create_admin_group(name='Map Admins')
        cls.admin_group.countries.add(cls.country)
        create_user('map_admin', password=ADMIN_PASSWORD, groups=[cls.admin_group])

    def test_map_display_settings_returns_defaults(self):
        headers = auth_header(self.client, 'map_admin', ADMIN_PASSWORD)
        response = self.client.get('/api/v1/map-display-settings/', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rules = response.data['zoom_rules']
        self.assertIn('flag_tiers', rules)
        self.assertEqual(rules['non_flag_min_zoom'], 6)
        self.assertEqual(rules['cluster_distance_px'], 38)
        self.assertTrue(MapDisplaySettings.objects.filter(pk=1).exists())


class TargetVulnerabilityApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = create_country(iso_code='VUL', title='Vuln Country')
        cls.target_type = TargetType.objects.create(title='Объект', order=1)
        cls.target_type.countries.add(cls.country)
        cls.admin_group = create_admin_group(name='Vuln Admins')
        cls.admin_group.countries.add(cls.country)
        create_user('vuln_admin', password=ADMIN_PASSWORD, groups=[cls.admin_group])
        cls.target = Target.objects.create(
            title='Test Target',
            label='T1',
            country=cls.country,
            type=cls.target_type,
            lat=55.0,
            lng=37.0,
        )

    def test_vulnerability_crud(self):
        headers = auth_header(self.client, 'vuln_admin', ADMIN_PASSWORD)
        create_resp = self.client.post(
            '/api/v1/target-vulnerabilities/',
            {
                'target': str(self.target.id),
                'title': 'Слабое место',
                'description': 'Описание',
                'lat': 55.01,
                'lng': 37.01,
                'order': 0,
            },
            format='json',
            **headers,
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        vuln_id = create_resp.data['id']

        list_resp = self.client.get(
            f'/api/v1/target-vulnerabilities/?target={self.target.id}',
            **headers,
        )
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)

        detail_target = self.client.get(f'/api/v1/targets/{self.target.id}/', **headers)
        self.assertEqual(len(detail_target.data.get('vulnerabilities', [])), 1)

        delete_resp = self.client.delete(f'/api/v1/target-vulnerabilities/{vuln_id}/', **headers)
        self.assertEqual(delete_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TargetVulnerability.objects.filter(pk=vuln_id).exists())
