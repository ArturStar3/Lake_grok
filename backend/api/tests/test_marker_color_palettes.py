"""API палитр маркеров и вложенная палитра у стран."""

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.base import ADMIN_PASSWORD, auth_header, create_admin_group, create_country, create_user
from formular.models import MarkerColorPalette


class MarkerColorPaletteApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_group = create_admin_group(name='Palette Admins')
        cls.admin = create_user('palette_admin', password=ADMIN_PASSWORD, groups=[cls.admin_group])
        cls.palette = MarkerColorPalette.objects.filter(title='Синий').first()
        if cls.palette is None:
            cls.palette = MarkerColorPalette.objects.create(
                title='Синий API test',
                color_first='#008DD2',
                color_second='#FEFEFE',
                color_third='#00A0E3',
                color_forth='#A2D9F7',
            )

    def test_list_palettes_authenticated(self):
        headers = auth_header(self.client, 'palette_admin', ADMIN_PASSWORD)
        response = self.client.get('/api/v1/marker-color-palettes/', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)
        item = response.data[0]
        self.assertIn('color_first', item)
        self.assertIn('color_forth', item)

    def test_country_includes_marker_palette(self):
        country = create_country(iso_code='PLT', title='Palette Country', marker_palette=self.palette)
        self.admin_group.countries.add(country)
        headers = auth_header(self.client, 'palette_admin', ADMIN_PASSWORD)
        response = self.client.get(f'/api/v1/countries/{country.id}/', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['marker_palette']['id'], self.palette.id)
        self.assertEqual(response.data['marker_palette']['color_first'], self.palette.color_first)
        self.assertNotIn('color', response.data)

    def test_superuser_can_create_palette(self):
        superuser = create_user('palette_su', password=ADMIN_PASSWORD, superuser=True)
        headers = auth_header(self.client, 'palette_su', ADMIN_PASSWORD)
        payload = {
            'title': 'Кастомная палитра',
            'color_first': '#111111',
            'color_second': '#222222',
            'color_third': '#333333',
            'color_forth': '#444444',
        }
        response = self.client.post('/api/v1/marker-color-palettes/', payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], payload['title'])

    def test_invalid_hex_rejected(self):
        superuser = create_user('palette_su2', password=ADMIN_PASSWORD, superuser=True)
        headers = auth_header(self.client, 'palette_su2', ADMIN_PASSWORD)
        response = self.client.post(
            '/api/v1/marker-color-palettes/',
            {
                'title': 'Bad hex',
                'color_first': 'red',
                'color_second': '#FEFEFE',
                'color_third': '#00A0E3',
                'color_forth': '#A2D9F7',
            },
            format='json',
            **headers,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
