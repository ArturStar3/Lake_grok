"""Сериализация/десериализация доменных сущностей для ZIP-бандла."""

from __future__ import annotations

import hashlib
import json
from pathlib import PurePosixPath

from django.db.models.fields.files import FieldFile

BUNDLE_FORMAT_VERSION = 1

# Порядок зависимостей при экспорте/импорте (справочники → домен).
ENTITY_ORDER = (
    'marker_color_palettes',
    'markers',
    'event_markers',
    'action_types',
    'event_types',
    'country_sections',
    'formular_sections',
    'person_sections',
    'relation_types',
    'equipment_categories',
    'units_of_measure',
    'equipment_parameter_definitions',
    'countries',
    'target_types',  # после countries — для M2M country_keys
    'equipment',
    'equipment_images',
    'equipment_parameter_values',
    'country_infos',
    'country_attachments',
    'targets',
    'target_actions',
    'target_equipment',
    'formulars',
    'formular_attachments',
    'target_vulnerabilities',
    'events',
    'persons',
    'person_infos',
    'person_attachments',
    'person_photos',
    'person_relations',
)

ENTITY_LABELS = {
    'marker_color_palettes': 'Палитры маркеров',
    'markers': 'Маркеры',
    'event_markers': 'Маркеры событий',
    'action_types': 'Типы зон',
    'event_types': 'Типы событий',
    'target_types': 'Типы объектов',
    'country_sections': 'Разделы досье страны',
    'formular_sections': 'Разделы формуляра',
    'person_sections': 'Разделы персоналий',
    'relation_types': 'Типы связей',
    'equipment_categories': 'Категории техники',
    'units_of_measure': 'Единицы измерения',
    'equipment_parameter_definitions': 'Параметры техники',
    'countries': 'Страны',
    'equipment': 'Техника',
    'equipment_images': 'Изображения техники',
    'equipment_parameter_values': 'Значения ТТХ',
    'country_infos': 'Досье страны',
    'country_attachments': 'Вложения досье',
    'targets': 'Объекты',
    'target_actions': 'Зоны действия',
    'target_equipment': 'Техника на объекте',
    'formulars': 'Формуляр',
    'formular_attachments': 'Вложения формуляра',
    'target_vulnerabilities': 'Уязвимости',
    'events': 'События',
    'persons': 'Персоналии',
    'person_infos': 'Информация о лицах',
    'person_attachments': 'Вложения лиц',
    'person_photos': 'Фото лиц',
    'person_relations': 'Связи лиц',
}

# Дочерние коллекции следуют решению родителя (не показываются как конфликты).
CHILD_ENTITY_TYPES = frozenset({
    'target_actions',
    'target_equipment',
    'equipment_parameter_values',
    'equipment_images',
})


def nk(*parts) -> str:
    return '||'.join('' if p is None else str(p) for p in parts)


def file_rel_path(field_file: FieldFile | None) -> str | None:
    if not field_file or not getattr(field_file, 'name', None):
        return None
    name = field_file.name.replace('\\', '/')
    return name.lstrip('/')


def media_zip_path(rel_path: str) -> str:
    return f'media/{rel_path}'


def snapshot_hash(payload: dict) -> str:
    """Хеш сравниваемого снимка без медиа-байтов (пути файлов входят)."""
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def serialize_palette(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'color_first': obj.color_first,
        'color_second': obj.color_second,
        'color_third': obj.color_third,
        'color_forth': obj.color_forth,
    }


def serialize_marker(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'path': file_rel_path(obj.path),
        'top': obj.top,
        'width': obj.width,
        'height': obj.height,
        'scale': str(obj.scale),
        'order': obj.order,
        'is_flag': obj.is_flag,
    }


def serialize_event_marker(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'path': file_rel_path(obj.path),
    }


def serialize_action_type(obj) -> dict:
    data = {
        'natural_key': nk(obj.title),
        'title': obj.title,
    }
    for field in (
        'color', 'line_type', 'zone_mode', 'min_elevation_deg',
        'is_inundation_zone', 'order',
    ):
        if hasattr(obj, field):
            val = getattr(obj, field)
            data[field] = str(val) if hasattr(val, 'quantize') else val
    return data


def serialize_simple_title(obj) -> dict:
    return {'natural_key': nk(obj.title), 'title': obj.title}


def serialize_target_type(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'parent_key': nk(obj.parent.title) if obj.parent_id else None,
        'country_keys': [nk(c.title) for c in obj.countries.all()],
    }


def serialize_section(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'order': getattr(obj, 'order', 1),
        'parent_key': nk(obj.parent.title) if getattr(obj, 'parent_id', None) else None,
        'is_hidden': getattr(obj, 'is_hidden', False),
    }


def serialize_relation_type(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'reverse_title': obj.reverse_title or '',
    }


def serialize_equipment_category(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'order': obj.order,
        'parent_key': nk(obj.parent.title) if obj.parent_id else None,
    }


def serialize_uom(obj) -> dict:
    return {
        'natural_key': nk(obj.symbol),
        'title': obj.title,
        'symbol': obj.symbol,
    }


def serialize_param_def(obj) -> dict:
    return {
        'natural_key': nk(obj.code),
        'title': obj.title,
        'code': obj.code,
        'unit_key': nk(obj.unit.symbol) if obj.unit_id else None,
        'action_type_key': nk(obj.action_type.title) if obj.action_type_id else None,
        'category_keys': [nk(c.title) for c in obj.categories.all()],
        'help_text': obj.help_text or '',
        'zone_color': obj.zone_color,
        'zone_line_type': obj.zone_line_type,
    }


def serialize_country(obj) -> dict:
    return {
        'natural_key': nk(obj.title),
        'title': obj.title,
        'title_short': obj.title_short,
        'iso_code': obj.iso_code,
        'marker_palette_key': nk(obj.marker_palette.title) if obj.marker_palette_id else None,
    }


def equipment_natural_key(obj) -> str:
    return nk(obj.designation) if obj.designation else nk('title', obj.title)


def serialize_equipment(obj) -> dict:
    return {
        'natural_key': equipment_natural_key(obj),
        'title': obj.title,
        'designation': obj.designation or '',
        'description': obj.description or '',
        'category_key': nk(obj.category.title) if obj.category_id else None,
        'origin_country_key': nk(obj.origin_country.title) if obj.origin_country_id else None,
    }


def serialize_equipment_image(obj) -> dict:
    return {
        'natural_key': nk(equipment_natural_key(obj.equipment), obj.order, PurePosixPath(obj.image.name).name if obj.image else ''),
        'equipment_key': equipment_natural_key(obj.equipment),
        'title': obj.title or '',
        'order': obj.order,
        'image': file_rel_path(obj.image),
    }


def serialize_param_value(obj) -> dict:
    return {
        'natural_key': nk(equipment_natural_key(obj.equipment), obj.parameter.code),
        'equipment_key': equipment_natural_key(obj.equipment),
        'parameter_key': nk(obj.parameter.code),
        'value': obj.value,
    }


def serialize_country_info(obj) -> dict:
    return {
        'natural_key': nk(obj.country.title, obj.section.title),
        'country_key': nk(obj.country.title),
        'section_key': nk(obj.section.title),
        'content': obj.content or '',
    }


def serialize_country_attachment(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'country_key': nk(obj.country.title),
        'section_key': nk(obj.section.title),
        'title': obj.title,
        'description': obj.description or '',
        'image': file_rel_path(obj.image),
    }


def serialize_target(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'country_key': nk(obj.country.title),
        'title': obj.title,
        'label': obj.label or '',
        'marker_key': nk(obj.marker.title) if obj.marker_id else None,
        'type_key': nk(obj.type.title) if obj.type_id else None,
        'parent_id': str(obj.parent_id) if obj.parent_id else None,
        'lat': obj.lat,
        'lng': obj.lng,
        'action_radius': obj.action_radius,
        'antenna_height_m': obj.antenna_height_m,
        'crest_elevation_m': obj.crest_elevation_m,
        'normal_pool_level_m': obj.normal_pool_level_m,
        'max_pool_level_m': obj.max_pool_level_m,
    }


def serialize_target_action(obj) -> dict:
    return {
        'natural_key': nk(str(obj.target_id), obj.action_type.title if obj.action_type_id else '', obj.pk),
        'target_id': str(obj.target_id),
        'action_type_key': nk(obj.action_type.title) if obj.action_type_id else None,
        'radius': obj.radius,
        'zone_geometry': obj.zone_geometry,
        'zone_geometry_computed_at': (
            obj.zone_geometry_computed_at.isoformat() if obj.zone_geometry_computed_at else None
        ),
        'zone_metadata': obj.zone_metadata,
    }


def serialize_target_equipment(obj) -> dict:
    return {
        'natural_key': nk(str(obj.target_id), equipment_natural_key(obj.equipment)),
        'target_id': str(obj.target_id),
        'equipment_key': equipment_natural_key(obj.equipment),
        'quantity': obj.quantity,
    }


def serialize_formular(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'target_id': str(obj.target_id),
        'section_key': nk(obj.section.title),
        'content': obj.content or '',
    }


def serialize_formular_attachment(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'target_id': str(obj.target_id),
        'section_key': nk(obj.section.title) if obj.section_id else None,
        'title': getattr(obj, 'title', '') or '',
        'description': getattr(obj, 'description', '') or '',
        'image': file_rel_path(obj.image),
    }


def serialize_vulnerability(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'target_id': str(obj.target_id),
        'title': obj.title,
        'description': obj.description or '',
        'image': file_rel_path(obj.image),
        'lat': obj.lat,
        'lng': obj.lng,
        'order': obj.order,
    }


def serialize_event(obj) -> dict:
    data = {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'title': obj.title,
        'country_key': nk(obj.country.title) if obj.country_id else None,
        'event_type_key': nk(obj.event_type.title) if obj.event_type_id else None,
        'marker_key': nk(obj.marker.title) if obj.marker_id else None,
    }
    for field in (
        'description', 'date_start', 'date_end', 'time_start', 'time_end',
        'lat', 'lng', 'object_name',
    ):
        if hasattr(obj, field):
            val = getattr(obj, field)
            if hasattr(val, 'isoformat'):
                val = val.isoformat()
            data[field] = val
    return data


def serialize_person(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'target_id': str(obj.target_id),
        'full_name': obj.full_name,
        'position': obj.position or '',
        'order': obj.order,
    }


def serialize_person_info(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'person_id': str(obj.person_id),
        'section_key': nk(obj.section.title) if obj.section_id else None,
        'content': getattr(obj, 'content', '') or '',
    }


def serialize_person_attachment(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'person_id': str(obj.person_id),
        'section_key': nk(obj.section.title) if getattr(obj, 'section_id', None) else None,
        'title': getattr(obj, 'title', '') or '',
        'description': getattr(obj, 'description', None) or '',
        'image': file_rel_path(obj.image),
    }


def serialize_person_photo(obj) -> dict:
    return {
        'natural_key': str(obj.id),
        'id': str(obj.id),
        'person_id': str(obj.person_id),
        'title': getattr(obj, 'title', '') or '',
        'image': file_rel_path(obj.image),
        'order': getattr(obj, 'order', 0),
    }


def serialize_person_relation(obj) -> dict:
    return {
        'natural_key': nk(str(obj.person_from_id), str(obj.person_to_id), obj.relation_type.title),
        'person_from_id': str(obj.person_from_id),
        'person_to_id': str(obj.person_to_id),
        'relation_type_key': nk(obj.relation_type.title),
        'notes': obj.notes or '',
    }


def collect_media_paths(records_by_type: dict) -> set[str]:
    paths = set()
    media_keys = ('path', 'image')
    for records in records_by_type.values():
        for rec in records:
            for key in media_keys:
                val = rec.get(key)
                if val:
                    paths.add(val)
    return paths
