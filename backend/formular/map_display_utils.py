"""Валидация и нормализация правил отображения карты."""

from copy import deepcopy

from formular.models import DEFAULT_MAP_DISPLAY_ZOOM_RULES


def normalize_map_display_zoom_rules(raw):
    """Возвращает словарь с дефолтами для отсутствующих ключей."""
    base = deepcopy(DEFAULT_MAP_DISPLAY_ZOOM_RULES)
    if not isinstance(raw, dict):
        return base

    tiers = raw.get('flag_tiers')
    if isinstance(tiers, list) and tiers:
        cleaned = []
        for item in tiers:
            if not isinstance(item, dict):
                continue
            try:
                max_zoom = int(item.get('max_zoom'))
                max_order = int(item.get('max_order'))
            except (TypeError, ValueError):
                continue
            cleaned.append({'max_zoom': max_zoom, 'max_order': max_order})
        if cleaned:
            cleaned.sort(key=lambda x: x['max_zoom'])
            base['flag_tiers'] = cleaned

    try:
        non_flag = raw.get('non_flag_min_zoom')
        if non_flag is not None:
            base['non_flag_min_zoom'] = int(non_flag)
    except (TypeError, ValueError):
        pass

    try:
        dist = raw.get('cluster_distance_px')
        if dist is not None:
            px = int(dist)
            if px > 0:
                base['cluster_distance_px'] = px
    except (TypeError, ValueError):
        pass

    return base


def validate_map_display_zoom_rules(raw):
    """Проверка структуры перед сохранением в admin."""
    if raw is None:
        return normalize_map_display_zoom_rules({})
    if not isinstance(raw, dict):
        raise ValueError('zoom_rules должен быть объектом JSON')

    tiers = raw.get('flag_tiers')
    if tiers is not None:
        if not isinstance(tiers, list):
            raise ValueError('flag_tiers должен быть массивом')
        for item in tiers:
            if not isinstance(item, dict):
                raise ValueError('Элемент flag_tiers должен быть объектом')
            if 'max_zoom' not in item or 'max_order' not in item:
                raise ValueError('flag_tiers: нужны max_zoom и max_order')

    if 'non_flag_min_zoom' in raw and raw['non_flag_min_zoom'] is not None:
        int(raw['non_flag_min_zoom'])

    if 'cluster_distance_px' in raw and raw['cluster_distance_px'] is not None:
        px = int(raw['cluster_distance_px'])
        if px <= 0:
            raise ValueError('cluster_distance_px должен быть > 0')

    return normalize_map_display_zoom_rules(raw)
