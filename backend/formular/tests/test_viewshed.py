from django.test import SimpleTestCase

from formular.dem_reader import DemTileIndex
from formular.viewshed import compute_flat_range_polygon, compute_los_polygon


class ViewshedFallbackTests(SimpleTestCase):
    def test_los_polygon_falls_back_to_flat_circle_without_dem(self):
        empty_dem = DemTileIndex('/nonexistent/dem/dir')
        geometry = compute_los_polygon(
            55.0,
            37.0,
            antenna_height_m=10.0,
            max_range_km=50.0,
            dem=empty_dem,
        )
        self.assertEqual(geometry['type'], 'Polygon')
        self.assertFalse(geometry['properties']['dem_available'])
        self.assertEqual(geometry['properties']['fallback'], 'flat_circle')
        self.assertGreater(len(geometry['coordinates'][0]), 3)

    def test_flat_range_polygon_has_expected_properties(self):
        geometry = compute_flat_range_polygon(
            42.0,
            69.0,
            antenna_height_m=15.0,
            max_range_km=120.0,
        )
        self.assertEqual(geometry['properties']['max_range_km'], 120.0)
        self.assertEqual(geometry['properties']['antenna_height_m'], 15.0)
