"""
Добавляет тестовые зоны РЛС к существующим объектам для проверки viewshed.

Использование:
  python manage.py seed_rls_demo
  python manage.py seed_rls_demo --clear
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from formular.enums import ActionLineTypes, ZoneGeometryModes
from formular.models import ActionType, Country, Marker, Target, TargetAction, TargetType

# lat, lng, title_suffix, radius_km, antenna_height_m
RLS_DEMO_SITES = [
    (51.1833, 71.4167, 'РЛС Астана (равнина)', 120.0, 25.0),
    (49.8028, 73.0872, 'РЛС Караганда', 100.0, 20.0),
    (43.2380, 76.9455, 'РЛС Алматы (горы юг)', 80.0, 30.0),
    (46.8481, 75.0740, 'РЛС Балхаш (открытая степь)', 150.0, 18.0),
    (42.8746, 71.3988, 'РЛС Шымкент', 90.0, 22.0),
]

DEMO_LABEL_PREFIX = 'seed:rls-demo'


class Command(BaseCommand):
    help = 'Создаёт демо-объекты с зонами РЛС для тестирования покрытия с учётом рельефа'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help=f'Удалить объекты с меткой {DEMO_LABEL_PREFIX}',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            deleted, _ = Target.objects.filter(label__startswith=DEMO_LABEL_PREFIX).delete()
            self.stdout.write(self.style.WARNING(f'Удалено объектов: {deleted}'))
            return

        rls_type, _ = ActionType.objects.get_or_create(
            title='РЛС',
            defaults={
                'color': '#00ced1',
                'line_type': ActionLineTypes.SOLID,
                'zone_mode': ZoneGeometryModes.LOS_RADAR,
                'min_elevation_deg': 0.5,
            },
        )
        if rls_type.zone_mode != ZoneGeometryModes.LOS_RADAR:
            rls_type.zone_mode = ZoneGeometryModes.LOS_RADAR
            rls_type.save(update_fields=['zone_mode'])

        country = Country.objects.filter(iso_code='KZ').first()
        if not country:
            country = Country.objects.first()
        if not country:
            self.stderr.write('Нет стран в БД — сначала загрузите справочники')
            return

        marker = Marker.objects.filter(title__icontains='Радиопеленгатор').first()
        if not marker:
            marker = Marker.objects.filter(is_flag=False).first()

        target_type = TargetType.objects.first()

        created = 0
        for index, (lat, lng, suffix, radius_km, antenna_m) in enumerate(RLS_DEMO_SITES, start=1):
            label = f'{DEMO_LABEL_PREFIX}:{index:02d}'
            target, is_new = Target.objects.get_or_create(
                label=label,
                defaults={
                    'country': country,
                    'title': suffix,
                    'marker': marker,
                    'type': target_type,
                    'lat': lat,
                    'lng': lng,
                    'antenna_height_m': antenna_m,
                    'action_radius': radius_km,
                },
            )
            if not is_new:
                target.title = suffix
                target.lat = lat
                target.lng = lng
                target.antenna_height_m = antenna_m
                target.action_radius = radius_km
                target.save(
                    update_fields=['title', 'lat', 'lng', 'antenna_height_m', 'action_radius'],
                )

            action, action_created = TargetAction.objects.update_or_create(
                target=target,
                action_type=rls_type,
                defaults={
                    'radius': radius_km,
                    'zone_geometry': None,
                    'zone_geometry_computed_at': None,
                },
            )
            if is_new or action_created:
                created += 1

            self.stdout.write(
                f'  {target.title}: {lat}, {lng} — R={radius_km} км, h_ant={antenna_m} м'
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Готово: {len(RLS_DEMO_SITES)} демо-объектов РЛС '
                f'(новых/обновлённых: {created}). '
                'На карте включите тип зоны «РЛС» и нажмите «Рассчитать покрытие».'
            )
        )
