from django.core.management.base import BaseCommand
from django.db import transaction

from equipment.models import (
    Equipment,
    EquipmentCategory,
    EquipmentParameterDefinition,
    EquipmentParameterValue,
    UnitOfMeasure,
)
from formular.enums import ActionLineTypes
from formular.models import ActionType, Country, Marker, Target, TargetEquipment, TargetType


ACTION_TYPE_SPECS = [
    ('Практическая дальность', '#2ecc71', ActionLineTypes.SOLID),
    ('Перегоночная дальность', '#3498db', ActionLineTypes.DASHED),
    ('Боевой радиус', '#e74c3c', ActionLineTypes.SOLID),
    ('Дальность стрельбы', '#9b59b6', ActionLineTypes.DASH_DOT),
    ('Радиус действия', '#f39c12', ActionLineTypes.DASHED),
    ('Зона поражения', '#c0392b', ActionLineTypes.SOLID),
]

PARAMETER_SPECS = [
    {
        'code': 'practical_range',
        'title': 'Практическая дальность полёта',
        'zone': 'Практическая дальность',
        'unit': 'км',
        'categories': ['Истребители', 'Бомбардировщики', 'Штурмовая авиация'],
    },
    {
        'code': 'ferry_range',
        'title': 'Перегоночная дальность',
        'zone': 'Перегоночная дальность',
        'unit': 'км',
        'categories': ['Истребители', 'Бомбардировщики', 'Штурмовая авиация'],
    },
    {
        'code': 'combat_radius',
        'title': 'Боевой радиус действия',
        'zone': 'Боевой радиус',
        'unit': 'км',
        'categories': ['Истребители', 'Бомбардировщики', 'Штурмовая авиация'],
    },
    {
        'code': 'gun_range',
        'title': 'Дальность стрельбы',
        'zone': 'Дальность стрельбы',
        'unit': 'км',
        'categories': ['Танки', 'БМП', 'БТР', 'Артиллерия'],
    },
    {
        'code': 'operational_radius',
        'title': 'Радиус действия',
        'zone': 'Радиус действия',
        'unit': 'км',
        'categories': ['Танки', 'БМП', 'БТР', 'Артиллерия', 'ЗРК'],
    },
    {
        'code': 'engagement_range',
        'title': 'Зона поражения',
        'zone': 'Зона поражения',
        'unit': 'км',
        'categories': ['ЗРК'],
    },
    {
        'code': 'max_speed',
        'title': 'Максимальная скорость',
        'zone': None,
        'unit': 'км/ч',
        'categories': [
            'Истребители',
            'Бомбардировщики',
            'Штурмовая авиация',
            'Танки',
            'БМП',
            'БТР',
            'Артиллерия',
        ],
    },
]

CATEGORY_TREE = [
    ('ВВС', None, 1),
    ('Истребители', 'ВВС', 1),
    ('Бомбардировщики', 'ВВС', 2),
    ('Штурмовая авиация', 'ВВС', 3),
    ('Сухопутные войска', None, 2),
    ('Танки', 'Сухопутные войска', 1),
    ('БМП', 'Сухопутные войска', 2),
    ('БТР', 'Сухопутные войска', 3),
    ('Артиллерия', 'Сухопутные войска', 4),
    ('ПВО', None, 3),
    ('ЗРК', 'ПВО', 1),
]

EQUIPMENT_SPECS = [
    {
        'designation': 'Су-35С',
        'title': 'Многоцелевой истребитель Су-35С',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Многоцелевой истребитель поколения 4++',
        'values': {
            'practical_range': 3600,
            'ferry_range': 4500,
            'combat_radius': 1500,
            'max_speed': 2400,
        },
    },
    {
        'designation': 'МиГ-31БМ',
        'title': 'Истребитель-перехватчик МиГ-31БМ',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Высотный перехватчик дальнего радиуса действия',
        'values': {
            'practical_range': 3000,
            'ferry_range': 3300,
            'combat_radius': 720,
            'max_speed': 3000,
        },
    },
    {
        'designation': 'Ту-160',
        'title': 'Стратегический бомбардировщик Ту-160',
        'category': 'Бомбардировщики',
        'iso': 'RU',
        'description': 'Стратегический ракетоносец-бомбардировщик',
        'values': {
            'practical_range': 12300,
            'ferry_range': 16000,
            'combat_radius': 7300,
            'max_speed': 950,
        },
    },
    {
        'designation': 'Су-34',
        'title': 'Фронтовой бомбардировщик Су-34',
        'category': 'Штурмовая авиация',
        'iso': 'RU',
        'description': 'Ударный самолёт для нанесения ударов по наземным целям',
        'values': {
            'practical_range': 4000,
            'ferry_range': 4500,
            'combat_radius': 1100,
            'max_speed': 1900,
        },
    },
    {
        'designation': 'Т-90М',
        'title': 'Основной боевой танк Т-90М «Прорыв»',
        'category': 'Танки',
        'iso': 'RU',
        'description': 'ОБТ с усиленной защитой и управляемыми снарядами',
        'values': {
            'gun_range': 5,
            'operational_radius': 450,
            'max_speed': 60,
        },
    },
    {
        'designation': 'Т-72Б3',
        'title': 'Основной боевой танк Т-72Б3',
        'category': 'Танки',
        'iso': 'RU',
        'description': 'Модернизированный ОБТ семейства Т-72',
        'values': {
            'gun_range': 4,
            'operational_radius': 400,
            'max_speed': 60,
        },
    },
    {
        'designation': 'БМП-3',
        'title': 'Боевая машина пехоты БМП-3',
        'category': 'БМП',
        'iso': 'RU',
        'description': 'БМП с мощным вооружением для поддержки мотострелков',
        'values': {
            'gun_range': 4,
            'operational_radius': 600,
            'max_speed': 70,
        },
    },
    {
        'designation': 'БТР-82А',
        'title': 'Бронетранспортёр БТР-82А',
        'category': 'БТР',
        'iso': 'RU',
        'description': 'Колёсный БТР для перевозки личного состава',
        'values': {
            'gun_range': 2,
            'operational_radius': 500,
            'max_speed': 80,
        },
    },
    {
        'designation': '2С19 «Мста-С»',
        'title': 'Самоходная артиллерийская установка 2С19 «Мста-С»',
        'category': 'Артиллерия',
        'iso': 'RU',
        'description': '152-мм САУ для огневой поддержки',
        'values': {
            'gun_range': 29,
            'operational_radius': 50,
            'max_speed': 60,
        },
    },
    {
        'designation': 'Тор-М2',
        'title': 'Зенитный ракетный комплекс «Тор-М2»',
        'category': 'ЗРК',
        'iso': 'RU',
        'description': 'Короткодействующий ЗРК для прикрытия войск и объектов',
        'values': {
            'engagement_range': 15,
            'operational_radius': 25,
        },
    },
    {
        'designation': 'С-400',
        'title': 'Зенитная ракетная система С-400 «Триумф»',
        'category': 'ЗРК',
        'iso': 'RU',
        'description': 'Дальнодействующий ЗРК класса С-300/400',
        'values': {
            'engagement_range': 250,
            'operational_radius': 40,
        },
    },
    {
        'designation': 'M1A2 Abrams',
        'title': 'Основной боевой танк M1A2 Abrams',
        'category': 'Танки',
        'iso': 'US',
        'description': 'ОБТ ВС США (для сравнения в каталоге)',
        'values': {
            'gun_range': 4,
            'operational_radius': 425,
            'max_speed': 67,
        },
    },
]

DEPLOYMENT_SPECS = [
    {
        'title': 'Аэродром Борисоглебск (демо)',
        'label': 'seed:equipment:borisoglebsk',
        'type': 'Аэродром',
        'iso': 'RU',
        'lat': 51.365,
        'lng': 42.085,
        'marker_contains': 'Аэродром',
        'equipment': [('Су-35С', 12), ('МиГ-31БМ', 6)],
    },
    {
        'title': 'Авиабаза Энгельс (демо)',
        'label': 'seed:equipment:engels',
        'type': 'Авиабаза',
        'iso': 'RU',
        'lat': 51.483,
        'lng': 46.210,
        'marker_contains': 'Авиабаза',
        'equipment': [('Ту-160', 8), ('Су-34', 24)],
    },
    {
        'title': 'Центральная база ремонта танков (демо)',
        'label': 'seed:equipment:tank_base',
        'type': 'Центральная база ремонта танков',
        'iso': 'RU',
        'lat': 58.089,
        'lng': 59.965,
        'marker_contains': 'ремонта танков',
        'equipment': [('Т-90М', 40), ('Т-72Б3', 60)],
    },
    {
        'title': 'Мотострелковый учебный центр (демо)',
        'label': 'seed:equipment:motor_rifle',
        'type': 'Мотострелковый учебный центр',
        'iso': 'RU',
        'lat': 56.312,
        'lng': 44.002,
        'marker_contains': 'Мотострелковый',
        'equipment': [('БМП-3', 36), ('БТР-82А', 24)],
    },
    {
        'title': 'Артиллерийский учебный центр (демо)',
        'label': 'seed:equipment:artillery',
        'type': 'Артиллерийский учебный центр',
        'iso': 'RU',
        'lat': 54.780,
        'lng': 32.045,
        'marker_contains': 'Артилерийский',
        'equipment': [('2С19 «Мста-С»', 18)],
    },
    {
        'title': 'Радиопеленгаторный пункт ПВО (демо)',
        'label': 'seed:equipment:air_defense',
        'type': 'Радиопеленгаторный пункт',
        'iso': 'RU',
        'lat': 55.755,
        'lng': 37.620,
        'marker_contains': 'Радиопеленгаторный',
        'equipment': [('Тор-М2', 4), ('С-400', 2)],
    },
]


class Command(BaseCommand):
    help = (
        'Заполняет каталог техники (авиация, танки, БМП, артиллерия, ЗРК) '
        'и демо-размещение на объектах карты'
    )

    @transaction.atomic
    def handle(self, *args, **options):
        countries = self._ensure_countries()
        units = self._ensure_units()
        categories = self._ensure_categories()
        action_types = self._ensure_action_types()
        parameters = self._ensure_parameters(categories, units, action_types)
        equipment_by_designation = self._ensure_equipment(
            countries,
            categories,
            parameters,
        )
        deployments = self._ensure_deployments(countries, equipment_by_designation)

        total_zones = sum(
            sum(1 for _ in item.catalog_zone_values())
            for item in equipment_by_designation.values()
        )
        self.stdout.write(self.style.SUCCESS(
            f'Готово: образцов техники — {len(equipment_by_designation)}, '
            f'объектов с размещением — {len(deployments)}, '
            f'зон в каталоге (суммарно) — {total_zones}'
        ))
        for target in deployments:
            names = ', '.join(
                f'{link.equipment.designation or link.equipment.title} ×{link.quantity}'
                for link in target.equipment_links.select_related('equipment').all()
            )
            zone_count = sum(
                1
                for link in target.equipment_links.all()
                for _ in link.equipment.catalog_zone_values()
            )
            self.stdout.write(f'  • {target.title}: {names} ({zone_count} зон)')

    def _ensure_countries(self):
        specs = [
            ('RU', 'Россия', 'РФ', 'red'),
            ('US', 'США', 'США', 'blue'),
        ]
        result = {}
        for iso, title, short, color in specs:
            country, _ = Country.objects.get_or_create(
                iso_code=iso,
                defaults={
                    'title': title,
                    'title_short': short,
                    'color': color,
                },
            )
            result[iso] = country
        return result

    def _ensure_units(self):
        specs = [
            ('км', 'Километр'),
            ('км/ч', 'Километр в час'),
        ]
        result = {}
        for symbol, title in specs:
            unit, _ = UnitOfMeasure.objects.get_or_create(
                symbol=symbol,
                defaults={'title': title},
            )
            result[symbol] = unit
        return result

    def _ensure_categories(self):
        by_title = {}
        for title, parent_title, order in CATEGORY_TREE:
            parent = by_title.get(parent_title) if parent_title else None
            category, _ = EquipmentCategory.objects.get_or_create(
                title=title,
                defaults={'parent': parent, 'order': order},
            )
            if parent and category.parent_id != parent.id:
                category.parent = parent
                category.order = order
                category.save(update_fields=['parent', 'order'])
            by_title[title] = category
        return by_title

    def _ensure_action_types(self):
        result = {}
        for title, color, line_type in ACTION_TYPE_SPECS:
            action_type, _ = ActionType.objects.get_or_create(
                title=title,
                defaults={'color': color, 'line_type': line_type},
            )
            result[title] = action_type
        return result

    def _ensure_parameters(self, categories, units, action_types):
        result = {}
        for spec in PARAMETER_SPECS:
            zone_title = spec['zone']
            param, created = EquipmentParameterDefinition.objects.get_or_create(
                code=spec['code'],
                defaults={
                    'title': spec['title'],
                    'unit': units[spec['unit']],
                    'action_type': action_types.get(zone_title) if zone_title else None,
                },
            )
            if not created:
                updates = {}
                if param.title != spec['title']:
                    updates['title'] = spec['title']
                expected_action = (
                    action_types.get(zone_title) if zone_title else None
                )
                if param.action_type_id != getattr(expected_action, 'id', None):
                    updates['action_type'] = expected_action
                expected_unit = units[spec['unit']]
                if param.unit_id != expected_unit.id:
                    updates['unit'] = expected_unit
                if updates:
                    for field, value in updates.items():
                        setattr(param, field, value)
                    param.save(update_fields=list(updates.keys()))

            for category_title in spec['categories']:
                param.categories.add(categories[category_title])
            result[spec['code']] = param
        return result

    def _ensure_equipment(self, countries, categories, parameters):
        result = {}
        for spec in EQUIPMENT_SPECS:
            equipment, _ = Equipment.objects.update_or_create(
                designation=spec['designation'],
                defaults={
                    'title': spec['title'],
                    'category': categories[spec['category']],
                    'origin_country': countries[spec['iso']],
                    'description': spec['description'],
                },
            )
            for code, value in spec['values'].items():
                EquipmentParameterValue.objects.update_or_create(
                    equipment=equipment,
                    parameter=parameters[code],
                    defaults={'value': value},
                )
            result[spec['designation']] = equipment
        return result

    def _ensure_deployments(self, countries, equipment_by_designation):
        deployments = []
        for spec in DEPLOYMENT_SPECS:
            target_type, _ = TargetType.objects.get_or_create(title=spec['type'])
            marker = Marker.objects.filter(
                title__icontains=spec['marker_contains'],
            ).first()

            legacy = Target.objects.filter(label='seed:equipment').first()
            if legacy and spec['label'] == 'seed:equipment:borisoglebsk':
                legacy.label = spec['label']
                legacy.save(update_fields=['label'])

            target, created = Target.objects.get_or_create(
                label=spec['label'],
                defaults={
                    'title': spec['title'],
                    'country': countries[spec['iso']],
                    'type': target_type,
                    'marker': marker,
                    'lat': spec['lat'],
                    'lng': spec['lng'],
                },
            )
            if not created:
                target.title = spec['title']
                target.country = countries[spec['iso']]
                target.type = target_type
                target.marker = marker
                target.lat = spec['lat']
                target.lng = spec['lng']
                target.save()

            designations = set()
            for item in spec['equipment']:
                if isinstance(item, (tuple, list)):
                    designation, quantity = item[0], item[1]
                else:
                    designation, quantity = item, 1
                equipment = equipment_by_designation[designation]
                TargetEquipment.objects.update_or_create(
                    target=target,
                    equipment=equipment,
                    defaults={'quantity': quantity},
                )
                designations.add(equipment.pk)
            TargetEquipment.objects.filter(target=target).exclude(
                equipment_id__in=designations,
            ).delete()
            deployments.append(target)
        return deployments
