from django.core.management.base import BaseCommand
from django.db import transaction

from formular.enums import ActionLineTypes, ZoneGeometryModes
from formular.models import ActionType, Country, Marker, Target, TargetAction, TargetType

HYDRO_TYPE_TITLE = 'Гидротехнические сооружения'

INUNDATION_TYPES = [
    {
        'title': 'Затопление — нормальный уровень',
        'color': '#3498db',
        'line_type': ActionLineTypes.DASHED,
    },
    {
        'title': 'Затопление — аварийный уровень',
        'color': '#e74c3c',
        'line_type': ActionLineTypes.SOLID,
    },
    {
        'title': 'Затопление — проектный максимум',
        'color': '#9b59b6',
        'line_type': ActionLineTypes.DASH_DOT,
    },
]

DEMO_TARGETS = [
    {
        'title': 'Рогунская ГЭС',
        'label': 'Рогун',
        'country_iso': 'TJ',
        'lat': 38.389,
        'lng': 69.771,
        'crest_elevation_m': 1095.0,
        'normal_pool_level_m': 1070.0,
        'max_pool_level_m': 1090.0,
        'scenarios': [
            {
                'action_title': 'Затопление — нормальный уровень',
                'water_level_m': 1070.0,
                'scenario_label': 'НПУ',
                'polygon': [
                    [69.735, 38.360],
                    [69.810, 38.360],
                    [69.820, 38.395],
                    [69.760, 38.410],
                    [69.720, 38.385],
                    [69.735, 38.360],
                ],
            },
            {
                'action_title': 'Затопление — аварийный уровень',
                'water_level_m': 1090.0,
                'scenario_label': 'Аварийный подпор',
                'polygon': [
                    [69.710, 38.345],
                    [69.830, 38.345],
                    [69.845, 38.400],
                    [69.770, 38.425],
                    [69.700, 38.390],
                    [69.710, 38.345],
                ],
            },
        ],
    },
    {
        'title': 'КамГЭС',
        'label': 'КамГЭС',
        'country_iso': 'UZ',
        'lat': 41.250,
        'lng': 69.950,
        'crest_elevation_m': 345.0,
        'normal_pool_level_m': 330.0,
        'max_pool_level_m': 340.0,
        'scenarios': [
            {
                'action_title': 'Затопление — нормальный уровень',
                'water_level_m': 330.0,
                'scenario_label': 'НПУ',
                'polygon': [
                    [69.910, 41.220],
                    [69.990, 41.220],
                    [69.995, 41.265],
                    [69.920, 41.270],
                    [69.910, 41.220],
                ],
            },
            {
                'action_title': 'Затопление — проектный максимум',
                'water_level_m': 340.0,
                'scenario_label': 'ПМУ',
                'polygon': [
                    [69.895, 41.205],
                    [70.005, 41.205],
                    [70.010, 41.275],
                    [69.915, 41.280],
                    [69.895, 41.205],
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Создать демо-объекты ГТС с зонами затопления (полигоны)'

    @transaction.atomic
    def handle(self, *args, **options):
        action_types = {}
        for item in INUNDATION_TYPES:
            action_type, _ = ActionType.objects.get_or_create(
                title=item['title'],
                defaults={
                    'color': item['color'],
                    'line_type': item['line_type'],
                    'zone_mode': ZoneGeometryModes.INUNDATION,
                },
            )
            if action_type.zone_mode != ZoneGeometryModes.INUNDATION:
                action_type.zone_mode = ZoneGeometryModes.INUNDATION
                action_type.save(update_fields=['zone_mode'])
            action_types[item['title']] = action_type

        hydro_type, _ = TargetType.objects.get_or_create(title=HYDRO_TYPE_TITLE)
        marker = Marker.objects.filter(title__icontains='Гидротех').first()

        created_targets = 0
        created_actions = 0

        for demo in DEMO_TARGETS:
            country = Country.objects.filter(iso_code=demo['country_iso']).first()
            if not country:
                self.stdout.write(self.style.WARNING(
                    f"Страна {demo['country_iso']} не найдена, пропуск {demo['title']}"
                ))
                continue

            target, created = Target.objects.get_or_create(
                title=demo['title'],
                country=country,
                defaults={
                    'label': demo['label'],
                    'type': hydro_type,
                    'marker': marker,
                    'lat': demo['lat'],
                    'lng': demo['lng'],
                    'crest_elevation_m': demo['crest_elevation_m'],
                    'normal_pool_level_m': demo['normal_pool_level_m'],
                    'max_pool_level_m': demo['max_pool_level_m'],
                },
            )
            if created:
                created_targets += 1
            else:
                target.label = demo['label']
                target.type = hydro_type
                target.marker = marker or target.marker
                target.lat = demo['lat']
                target.lng = demo['lng']
                target.crest_elevation_m = demo['crest_elevation_m']
                target.normal_pool_level_m = demo['normal_pool_level_m']
                target.max_pool_level_m = demo['max_pool_level_m']
                target.save()

            target.actions.filter(action_type__zone_mode=ZoneGeometryModes.INUNDATION).delete()

            for scenario in demo['scenarios']:
                action_type = action_types[scenario['action_title']]
                geometry = {
                    'type': 'Polygon',
                    'coordinates': [scenario['polygon']],
                }
                TargetAction.objects.create(
                    target=target,
                    action_type=action_type,
                    radius=None,
                    zone_geometry=geometry,
                    zone_metadata={
                        'water_level_m': scenario['water_level_m'],
                        'scenario_label': scenario['scenario_label'],
                    },
                )
                created_actions += 1

        self.stdout.write(self.style.SUCCESS(
            f'Готово: объектов создано {created_targets}, зон затопления {created_actions}'
        ))
