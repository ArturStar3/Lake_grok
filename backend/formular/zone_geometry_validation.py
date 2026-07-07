"""Валидация GeoJSON-полигонов для зон действия."""

from __future__ import annotations

from django.core.exceptions import ValidationError

HYDRO_TARGET_TYPE_TITLE = 'Гидротехнические сооружения'


def _orientation(p, q, r):
    val = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])
    if abs(val) < 1e-12:
        return 0
    return 1 if val > 0 else 2


def _on_segment(p, q, r):
    return (
        min(p[0], r[0]) <= q[0] <= max(p[0], r[0])
        and min(p[1], r[1]) <= q[1] <= max(p[1], r[1])
    )


def _segments_intersect(p1, q1, p2, q2):
    o1 = _orientation(p1, q1, p2)
    o2 = _orientation(p1, q1, q2)
    o3 = _orientation(p2, q2, p1)
    o4 = _orientation(p2, q2, q1)

    if o1 != o2 and o3 != o4:
        return True

    if o1 == 0 and _on_segment(p1, p2, q1):
        return True
    if o2 == 0 and _on_segment(p1, q2, q1):
        return True
    if o3 == 0 and _on_segment(p2, p1, q2):
        return True
    if o4 == 0 and _on_segment(p2, q1, q2):
        return True

    return False


def is_self_intersecting_ring(ring: list) -> bool:
    if not ring or len(ring) < 4:
        return False
    points = ring[:-1] if ring[0] == ring[-1] else ring
    n = len(points)
    if n < 4:
        return False
    for i in range(n):
        a1 = points[i]
        a2 = points[(i + 1) % n]
        for j in range(i + 1, n):
            if abs(i - j) <= 1:
                continue
            if i == 0 and j == n - 1:
                continue
            b1 = points[j]
            b2 = points[(j + 1) % n]
            if _segments_intersect(a1, a2, b1, b2):
                return True
    return False


def _validate_ring(ring, label: str):
    if not isinstance(ring, list) or len(ring) < 4:
        raise ValidationError(f'{label}: кольцо полигона должно содержать минимум 4 точки')
    for point in ring:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            raise ValidationError(f'{label}: точка должна быть [lng, lat]')
        lng, lat = float(point[0]), float(point[1])
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise ValidationError(f'{label}: координаты вне допустимого диапазона')


def validate_zone_geometry(geometry) -> dict:
    if geometry is None:
        raise ValidationError('Геометрия зоны обязательна')
    if not isinstance(geometry, dict):
        raise ValidationError('Геометрия должна быть объектом GeoJSON')

    geom_type = geometry.get('type')
    if geom_type == 'Polygon':
        coords = geometry.get('coordinates')
        if not isinstance(coords, list) or not coords:
            raise ValidationError('Polygon: отсутствуют coordinates')
        _validate_ring(coords[0], 'Polygon')
        if is_self_intersecting_ring(coords[0]):
            raise ValidationError('Контур полигона не должен пересекать сам себя')
        return geometry

    if geom_type == 'MultiPolygon':
        coords = geometry.get('coordinates')
        if not isinstance(coords, list) or not coords:
            raise ValidationError('MultiPolygon: отсутствуют coordinates')
        for idx, polygon in enumerate(coords):
            if not polygon:
                raise ValidationError(f'MultiPolygon: пустой полигон #{idx + 1}')
            _validate_ring(polygon[0], f'MultiPolygon #{idx + 1}')
            if is_self_intersecting_ring(polygon[0]):
                raise ValidationError('Контур полигона не должен пересекать сам себя')
        return geometry

    raise ValidationError('Поддерживаются только Polygon и MultiPolygon')


def validate_zone_metadata(metadata) -> dict | None:
    if metadata in (None, {}):
        return None
    if not isinstance(metadata, dict):
        raise ValidationError('zone_metadata должен быть объектом')

    result = {}
    if 'water_level_m' in metadata and metadata['water_level_m'] not in (None, ''):
        try:
            result['water_level_m'] = float(metadata['water_level_m'])
        except (TypeError, ValueError) as exc:
            raise ValidationError('water_level_m должен быть числом') from exc

    if 'scenario_label' in metadata and metadata['scenario_label'] not in (None, ''):
        label = str(metadata['scenario_label']).strip()
        if label:
            result['scenario_label'] = label[:200]

    if 'notes' in metadata and metadata['notes'] not in (None, ''):
        notes = str(metadata['notes']).strip()
        if notes:
            result['notes'] = notes[:2000]

    return result or None


def is_hydro_target_type(target_type) -> bool:
    if target_type is None:
        return False
    return getattr(target_type, 'title', None) == HYDRO_TARGET_TYPE_TITLE
