"""Упрощённый расчёт зоны прямой видимости РЛС по GLO-90 DEM."""

from __future__ import annotations

import math
from datetime import datetime, timezone

from django.utils.dateparse import parse_datetime

from .dem_reader import DemTileIndex, get_dem_index

EARTH_RADIUS_M = 6_371_000


def destination_point(lat_deg: float, lon_deg: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    brng = math.radians(bearing_deg)
    angular = distance_m / EARTH_RADIUS_M

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular)
        + math.cos(lat1) * math.sin(angular) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


def _max_visible_range_m(
    obs_lat: float,
    obs_lon: float,
    observer_amsl_m: float,
    bearing_deg: float,
    max_range_m: float,
    min_elevation_deg: float,
    dem: DemTileIndex,
    range_step_m: float = 1000.0,
) -> float:
    """
    Максимальная дальность по азимуту: рельеф блокирует луч, если точка
    возвышается выше линии минимального угла места (над горизонтом + ε).
    """
    min_elev_rad = math.radians(min_elevation_deg)
    distance = range_step_m
    last_visible = 0.0

    while distance <= max_range_m:
        lat, lon = destination_point(obs_lat, obs_lon, bearing_deg, distance)
        terrain = dem.sample(lat, lon)
        if terrain is None:
            distance += range_step_m
            continue

        curvature = (distance * distance) / (2 * EARTH_RADIUS_M)
        # Угол от наблюдателя до точки рельефа (с учётом кривизны Земли)
        elev_angle = math.atan2(terrain - observer_amsl_m + curvature, distance)

        # Рельеф выше «пола» диаграммы направленности (min ε) — дальше не видим
        if elev_angle > min_elev_rad:
            return last_visible if last_visible > 0 else range_step_m

        last_visible = distance
        distance += range_step_m

    return max_range_m


def compute_flat_range_polygon(
    lat: float,
    lon: float,
    *,
    antenna_height_m: float,
    max_range_km: float,
    min_elevation_deg: float = 0.5,
    azimuth_step_deg: int = 10,
) -> dict:
    """Плоский круг заданного радиуса (fallback при отсутствии DEM)."""
    max_range_m = max_range_km * 1000.0
    ring: list[list[float]] = [[lon, lat]]
    for bearing in range(0, 360, azimuth_step_deg):
        end_lat, end_lon = destination_point(lat, lon, float(bearing), max_range_m)
        ring.append([end_lon, end_lat])
    ring.append([lon, lat])

    return {
        'type': 'Polygon',
        'coordinates': [ring],
        'properties': {
            'max_range_km': max_range_km,
            'antenna_height_m': antenna_height_m,
            'min_elevation_deg': min_elevation_deg,
            'azimuth_step_deg': azimuth_step_deg,
            'dem_available': False,
            'fallback': 'flat_circle',
            'computed_at': datetime.now(timezone.utc).isoformat(),
        },
    }


def compute_los_polygon(
    lat: float,
    lon: float,
    *,
    antenna_height_m: float,
    max_range_km: float,
    min_elevation_deg: float = 0.5,
    azimuth_step_deg: int = 10,
    dem: DemTileIndex | None = None,
) -> dict:
    """
  Возвращает GeoJSON Polygon (координаты [lon, lat]).
  Центр объекта включается в кольцо для корректного отображения «звезды» покрытия.
    """
    dem = dem or get_dem_index()
    if dem.tile_count == 0 or not dem.has_coverage(lat, lon):
        return compute_flat_range_polygon(
            lat,
            lon,
            antenna_height_m=antenna_height_m,
            max_range_km=max_range_km,
            min_elevation_deg=min_elevation_deg,
            azimuth_step_deg=azimuth_step_deg,
        )

    ground = dem.sample(lat, lon)
    if ground is None:
        ground = 0.0
    observer_amsl = ground + antenna_height_m
    max_range_m = max_range_km * 1000.0

    ring: list[list[float]] = [[lon, lat]]
    for bearing in range(0, 360, azimuth_step_deg):
        visible_m = _max_visible_range_m(
            lat,
            lon,
            observer_amsl,
            float(bearing),
            max_range_m,
            min_elevation_deg,
            dem,
        )
        end_lat, end_lon = destination_point(lat, lon, float(bearing), visible_m)
        ring.append([end_lon, end_lat])

    ring.append([lon, lat])

    return {
        'type': 'Polygon',
        'coordinates': [ring],
        'properties': {
            'observer_amsl_m': round(observer_amsl, 1),
            'ground_elevation_m': round(ground, 1),
            'max_range_km': max_range_km,
            'antenna_height_m': antenna_height_m,
            'min_elevation_deg': min_elevation_deg,
            'azimuth_step_deg': azimuth_step_deg,
            'dem_resolution': 'glo-90',
            'dem_available': True,
            'computed_at': datetime.now(timezone.utc).isoformat(),
        },
    }


def parse_computed_at(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return parse_datetime(value)
    return None
