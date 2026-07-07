"""Tests for operational situations API."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.enums import ModuleLevel
from accounts.tests.base import (
    ADMIN_PASSWORD,
    auth_header,
    create_admin_group,
    create_country,
    create_user,
)
from formular.models import OperationalSituation

User = get_user_model()

SAMPLE_GEOMETRY = {
    'type': 'Polygon',
    'coordinates': [
        [
            [71.40, 51.10],
            [71.50, 51.10],
            [71.50, 51.20],
            [71.40, 51.20],
            [71.40, 51.10],
        ],
    ],
}


def situation_payload(country_id, **overrides):
    data = {
        'title': 'Обстановка 1',
        'description': 'Описание',
        'situation_date': '2026-03-01',
        'color': '#2f80ed',
        'geometry': SAMPLE_GEOMETRY,
        'country_ids': [country_id],
    }
    data.update(overrides)
    return data


class OperationalSituationApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.country = create_country(iso_code='OS1', title='OS Country')
        cls.other_country = create_country(iso_code='OS2', title='Other OS')
        cls.admin_group = create_admin_group(name='OS Admins')
        cls.admin_group.countries.add(cls.country, cls.other_country)
        cls.admin = create_user('os_admin', password=ADMIN_PASSWORD, groups=[cls.admin_group])

    def setUp(self):
        self.headers = auth_header(self.client, 'os_admin', ADMIN_PASSWORD)

    def test_create_list_and_revisions(self):
        create_resp = self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id),
            format='json',
            **self.headers,
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        situation_id = create_resp.data['id']
        self.assertEqual(create_resp.data['current_revision']['version'], 1)

        list_resp = self.client.get('/api/v1/operational-situations/', **self.headers)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)

        rev_resp = self.client.get(
            f'/api/v1/operational-situations/{situation_id}/revisions/',
            **self.headers,
        )
        self.assertEqual(rev_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(rev_resp.data), 1)

    def test_new_revision_and_correction(self):
        create_resp = self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id),
            format='json',
            **self.headers,
        )
        situation_id = create_resp.data['id']

        revision_resp = self.client.post(
            f'/api/v1/operational-situations/{situation_id}/revisions/',
            situation_payload(self.country.id, title='Обстановка 2'),
            format='json',
            **self.headers,
        )
        self.assertEqual(revision_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(revision_resp.data['current_revision']['version'], 2)

        correct_resp = self.client.patch(
            f'/api/v1/operational-situations/{situation_id}/current/',
            {'title': 'Исправленное название'},
            format='json',
            **self.headers,
        )
        self.assertEqual(correct_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(correct_resp.data['current_revision']['title'], 'Исправленное название')
        self.assertEqual(correct_resp.data['current_revision']['version'], 2)

        rev_resp = self.client.get(
            f'/api/v1/operational-situations/{situation_id}/revisions/',
            **self.headers,
        )
        self.assertEqual(len(rev_resp.data), 2)

    def test_fork_creates_new_series(self):
        create_resp = self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id),
            format='json',
            **self.headers,
        )
        situation_id = create_resp.data['id']

        fork_resp = self.client.post(
            f'/api/v1/operational-situations/{situation_id}/fork/',
            {'title': 'Форк обстановки'},
            format='json',
            **self.headers,
        )
        self.assertEqual(fork_resp.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(fork_resp.data['id'], situation_id)
        self.assertEqual(OperationalSituation.objects.count(), 2)

    def test_country_scoped_list(self):
        limited_group = create_admin_group(
            name='OS Limited',
            operational_situations=ModuleLevel.READ,
            can_manage_users=False,
            can_approve_registrations=False,
        )
        limited_group.countries.add(self.country)
        create_user('os_limited', groups=[limited_group])

        self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id, title='Visible'),
            format='json',
            **self.headers,
        )
        self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.other_country.id, title='Hidden'),
            format='json',
            **self.headers,
        )

        limited_headers = auth_header(self.client, 'os_limited', 'TestPass1')
        list_resp = self.client.get('/api/v1/operational-situations/', **limited_headers)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        titles = [item['current_revision']['title'] for item in list_resp.data]
        self.assertIn('Visible', titles)
        self.assertNotIn('Hidden', titles)

    def test_list_ordered_by_situation_datetime(self):
        self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id, title='Ранняя', situation_date='2026-01-15', situation_time='08:00'),
            format='json',
            **self.headers,
        )
        self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id, title='Поздняя', situation_date='2026-06-20', situation_time='18:30'),
            format='json',
            **self.headers,
        )

        list_resp = self.client.get('/api/v1/operational-situations/', **self.headers)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        titles = [item['display_revision']['title'] for item in list_resp.data]
        self.assertEqual(titles, ['Поздняя', 'Ранняя'])

    def test_display_revision_uses_latest_datetime_not_current_version(self):
        create_resp = self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(
                self.country.id,
                title='Поздняя по дате',
                situation_date='2026-03-10',
            ),
            format='json',
            **self.headers,
        )
        situation_id = create_resp.data['id']

        self.client.post(
            f'/api/v1/operational-situations/{situation_id}/revisions/',
            situation_payload(
                self.country.id,
                title='Новая версия, ранняя дата',
                situation_date='2026-03-05',
            ),
            format='json',
            **self.headers,
        )

        detail_resp = self.client.get(
            f'/api/v1/operational-situations/{situation_id}/',
            **self.headers,
        )
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data['current_revision']['version'], 2)
        self.assertEqual(detail_resp.data['display_revision']['title'], 'Поздняя по дате')
        self.assertEqual(detail_resp.data['display_revision']['situation_date'], '2026-03-10')

    def test_timeline_ordered_by_situation_datetime(self):
        create_resp = self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(
                self.country.id,
                title='Поздняя',
                situation_date='2026-06-20',
                situation_time='18:30',
            ),
            format='json',
            **self.headers,
        )
        situation_id = create_resp.data['id']
        self.client.post(
            f'/api/v1/operational-situations/{situation_id}/revisions/',
            situation_payload(
                self.country.id,
                title='Ранняя',
                situation_date='2026-01-15',
                situation_time='08:00',
            ),
            format='json',
            **self.headers,
        )

        timeline_resp = self.client.get('/api/v1/operational-situations/timeline/', **self.headers)
        self.assertEqual(timeline_resp.status_code, status.HTTP_200_OK)
        titles = [item['title'] for item in timeline_resp.data]
        self.assertEqual(titles[:2], ['Поздняя', 'Ранняя'])

    def test_timeline_endpoint(self):
        self.client.post(
            '/api/v1/operational-situations/',
            situation_payload(self.country.id),
            format='json',
            **self.headers,
        )
        timeline_resp = self.client.get('/api/v1/operational-situations/timeline/', **self.headers)
        self.assertEqual(timeline_resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(timeline_resp.data), 1)
