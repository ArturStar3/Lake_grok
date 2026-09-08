"""API-тесты персонального избранного карты."""

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import MAP_FAVORITES_MAX, MapFavorite
from accounts.tests.base import TEST_PASSWORD, auth_header, create_user


class MapFavoritesApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user_a = create_user('fav_a')
        cls.user_b = create_user('fav_b')

    def _create(self, headers, **overrides):
        payload = {
            'kind': 'object',
            'entity_id': 'target-1',
            'title': 'Штаб',
            'source_title': 'Объект 1',
            'subtitle': 'Страна',
        }
        payload.update(overrides)
        return self.client.post('/api/v1/map-favorites/', payload, format='json', **headers)

    def test_unauthenticated_rejected(self):
        response = self.client.get('/api/v1/map-favorites/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_crud_is_scoped_to_current_user(self):
        headers_a = auth_header(self.client, 'fav_a', TEST_PASSWORD)
        headers_b = auth_header(self.client, 'fav_b', TEST_PASSWORD)

        created = self._create(headers_a)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        fav_id = created.data['id']
        self.assertEqual(created.data['title'], 'Штаб')
        self.assertEqual(created.data['entity_id'], 'target-1')

        list_a = self.client.get('/api/v1/map-favorites/', **headers_a)
        self.assertEqual(list_a.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_a.data), 1)

        list_b = self.client.get('/api/v1/map-favorites/', **headers_b)
        self.assertEqual(list_b.status_code, status.HTTP_200_OK)
        self.assertEqual(list_b.data, [])

        foreign = self.client.patch(
            f'/api/v1/map-favorites/{fav_id}/',
            {'title': 'Чужое'},
            format='json',
            **headers_b,
        )
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)

        renamed = self.client.patch(
            f'/api/v1/map-favorites/{fav_id}/',
            {'title': 'КП'},
            format='json',
            **headers_a,
        )
        self.assertEqual(renamed.status_code, status.HTTP_200_OK)
        self.assertEqual(renamed.data['title'], 'КП')

        deleted_foreign = self.client.delete(f'/api/v1/map-favorites/{fav_id}/', **headers_b)
        self.assertEqual(deleted_foreign.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(MapFavorite.objects.filter(pk=fav_id, user=self.user_a).exists())

        deleted = self.client.delete(f'/api/v1/map-favorites/{fav_id}/', **headers_a)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MapFavorite.objects.filter(pk=fav_id).exists())

    def test_duplicate_and_limit(self):
        headers = auth_header(self.client, 'fav_a', TEST_PASSWORD)
        first = self._create(headers)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        dup = self._create(headers)
        self.assertEqual(dup.status_code, status.HTTP_400_BAD_REQUEST)

        for index in range(MAP_FAVORITES_MAX - 1):
            resp = self._create(headers, entity_id=f'target-{index + 2}', title=f'Пункт {index}')
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

        overflow = self._create(headers, entity_id='target-overflow', title='Лишний')
        self.assertEqual(overflow.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MapFavorite.objects.filter(user=self.user_a).count(), MAP_FAVORITES_MAX)
