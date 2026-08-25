"""
Создаёт тестовый сценарий демонстрации карты (шаг = 4 с).

Использование:
  python manage.py seed_sample_demo_scenario
  python manage.py seed_sample_demo_scenario --replace
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    replace_demo_scenario_steps,
)
from formular.enums import ZoneGeometryModes
from formular.models import (
    ActionType,
    Country,
    CountryInfo,
    DemoScenario,
    DemoStepStartMode,
    DemoStepTool,
    Event,
    Formular,
    OperationalSituation,
    Target,
)


SCENARIO_TITLE = 'Обзор возможностей карты (тест)'
LEGACY_TITLES = (
    'Обзор возможностей карты (1 мин)',
    'Обзор возможностей карты (1,5 мин)',
)
STEP_MS = 4000
CAM_MS = 2500
CAUCASUS = (40.45, 46.40)
ASIA = (41.20, 70.80)
OVERVIEW = (42.50, 55.00)

DESCRIPTION = (
    'Тестовый сценарий: каждый шаг 4 секунды. Проверяет камеру, объекты, '
    'формуляр с проваливанием в пункты, справку по стране, зоны (в т.ч. РЛС '
    'без рельефа и непрерывное раскрытие), затопление, одну обстановку '
    'с карточкой и сменой состояний, слои карты.'
)


def _ids(queryset, limit=None):
    values = list(queryset.values_list('id', flat=True))
    if limit is not None:
        values = values[:limit]
    return [str(item) for item in values]


def _fly(lat, lng, zoom):
    return {
        'mode': 'fly_to',
        'lat': lat,
        'lng': lng,
        'zoom': zoom,
        'duration_ms': CAM_MS,
        'ease_linearity': 0.28,
    }


def _fit(zoom=7, padding=80):
    return {
        'mode': 'fit_selection',
        'zoom': zoom,
        'duration_ms': CAM_MS,
        'padding': padding,
    }


def _step(*, title, tool, camera=None, selection=None, animation=None, hold_previous=False):
    return {
        'title': title,
        'tool': tool,
        'duration_ms': STEP_MS,
        'start_mode': DemoStepStartMode.AFTER_PREVIOUS,
        'hold_previous': hold_previous,
        'camera': camera or {'mode': 'none'},
        'selection': selection or {},
        'animation': animation or {'effect': 'none'},
    }


def _situation_ids(*needles):
    ids = []
    seen = set()
    for needle in needles:
        item = OperationalSituation.objects.filter(
            current_revision__title__icontains=needle,
        ).first()
        if item is None or item.id in seen:
            continue
        seen.add(item.id)
        ids.append(str(item.id))
    return ids


def _unique(items):
    seen = set()
    result = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _formular_card_ids(target_ids, extra=None):
    cards = list(extra or [])
    if target_ids:
        rows = (
            Formular.objects.filter(target_id=target_ids[0])
            .exclude(content__isnull=True)
            .exclude(content='')
            .select_related('section')
            .order_by('section__order', 'section__title')[:3]
        )
        for row in rows:
            section = row.section
            if not section:
                continue
            cards.append(
                f'group-{section.parent_id}' if section.parent_id else f'section-{section.id}'
            )
    return _unique(cards + ['zones', 'equipment'])[:4]


def _country_card_ids(iso_code):
    cards = ['formular-completion']
    country = Country.objects.filter(iso_code=iso_code).first()
    if country:
        rows = (
            CountryInfo.objects.filter(country=country)
            .exclude(content__isnull=True)
            .exclude(content='')
            .select_related('section')
            .order_by('section__order', 'section__title')[:2]
        )
        for row in rows:
            section = row.section
            if not section:
                continue
            cards.append(
                f'group-{section.parent_id}' if section.parent_id else f'section-{section.id}'
            )
    return _unique(cards)[:3]


def _zone_leaves(action_type, country_titles):
    if not action_type:
        return []
    return [
        {
            'country': title,
            'action_type_id': str(action_type.id),
            'leaf': 'manual',
        }
        for title in _unique(country_titles)
    ]


class Command(BaseCommand):
    help = 'Создаёт тестовый сценарий демонстрации (4 с на шаг)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--replace',
            action='store_true',
            help='Перезаписать сценарий с тем же названием, если он уже есть',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        existing = DemoScenario.objects.filter(title=SCENARIO_TITLE).first()
        if not existing:
            existing = DemoScenario.objects.filter(title__in=LEGACY_TITLES).first()
        if existing and not options['replace']:
            self.stdout.write(self.style.WARNING(
                f'Сценарий «{existing.title}» уже есть (id={existing.id}). '
                'Запустите с --replace, чтобы обновить шаги.'
            ))
            return

        caucasus_objects = Target.objects.filter(
            title__in=[
                'Мингечевирская ГЭС (qa)',
                'Headquarters (АРМ-0003)',
                'Дивизия (АРМ-0049)',
                'Общевойсковая армия (АРМ-0053)',
            ]
        )
        if caucasus_objects.count() < 3:
            armenia = Country.objects.filter(iso_code='AM').first()
            extra = Target.objects.none()
            if armenia:
                extra = Target.objects.filter(country=armenia).filter(
                    Q(title__icontains='Headquarters')
                    | Q(title__icontains='Дивизия')
                    | Q(title__icontains='армия')
                )
            mingachevir = Target.objects.filter(title__icontains='Мингечевирск')
            caucasus_objects = (caucasus_objects | extra | mingachevir).distinct()
        rls_objects = Target.objects.filter(title__startswith='РЛС ').order_by('title')
        hydro_objects = Target.objects.filter(
            Q(title__in=[
                'Рогунская ГЭС',
                'Рогунская ГЭС (qa)',
                'Токтогульская ГЭС (qa)',
                'Шардаринская ГЭС (qa)',
                'Мингечевирская ГЭС (qa)',
                'Нурекская ГЭС (qa)',
            ])
            | Q(title__icontains='ГЭС')
        ).distinct()

        caucasus_formular_ids = _ids(caucasus_objects, 1)
        rls_formular_ids = _ids(rls_objects, 1)

        caucasus_events = Event.objects.filter(title='Учения ПВО на Кавказе')
        asia_events = Event.objects.filter(title__in=[
            'Учения ОДКБ «Рубеж»',
            'Разведывательные полёты БПЛА',
            'Инцидент на КПП',
            'Модернизация позиции РЛС',
        ])

        caucasus_situation_ids = _situation_ids('Кавказ')[:1]
        asia_situation_ids = _situation_ids('Центральная Азия')[:1]
        europe_situation_ids = _situation_ids('европейская часть')[:1]
        if not asia_situation_ids:
            fallback = OperationalSituation.objects.order_by('-created_at').first()
            if fallback:
                asia_situation_ids = [str(fallback.id)]

        fire_type = ActionType.objects.filter(title='Огневая поддержка').first()
        recon_type = ActionType.objects.filter(title='Разведка').first()
        rls_type = (
            ActionType.objects.filter(title='РЛС').first()
            or ActionType.objects.filter(zone_mode=ZoneGeometryModes.LOS_RADAR).first()
        )
        inund_type = ActionType.objects.filter(
            title='Затопление — нормальный уровень',
            is_inundation_zone=True,
        ).first()

        armenia_zone_leaves = []
        for action_type in (recon_type, fire_type):
            armenia_zone_leaves.extend(_zone_leaves(action_type, ['Армения']))

        rls_country_titles = list(
            rls_objects.exclude(country__isnull=True).values_list('country__title', flat=True)
        )
        if not rls_country_titles:
            kz = Country.objects.filter(iso_code='KZ').first()
            if kz:
                rls_country_titles = [kz.title]
        rls_zone_leaves = _zone_leaves(rls_type, rls_country_titles)

        inundation_leaves = []
        if inund_type:
            inundation_leaves = _zone_leaves(inund_type, [
                'Таджикистан', 'Кыргызстан', 'Казахстан', 'Азербайджан', 'Узбекистан',
            ])

        state_cycle = {
            'effect': 'state_cycle',
            'continuous': True,
            'state_cycle': {
                'per_state_ms': 1400,
                'cross_fade_ms': 400,
                'order': 'old_to_new',
            },
        }
        reveal_loop = {
            'effect': 'reveal_from_center',
            'duration_ms': 2000,
            'easing': 'ease_out',
            'continuous': True,
        }

        steps = [
            _step(
                title='Обзор: мелкий масштаб',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*CAUCASUS, 5),
            ),
            _step(
                title='Приближение',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*CAUCASUS, 8),
            ),
            _step(
                title='Крупный план',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*CAUCASUS, 11),
            ),
            _step(
                title='Объекты на Кавказе',
                tool=DemoStepTool.OBJECTS,
                camera=_fit(zoom=8, padding=80),
                selection={'target_ids': _ids(caucasus_objects)},
                animation={'effect': 'fade_in', 'duration_ms': 1400, 'easing': 'ease_out'},
            ),
            _step(
                title='Формуляр: пункты объекта',
                tool=DemoStepTool.FORMULAR,
                camera=_fit(zoom=9, padding=72),
                selection={
                    'target_ids': caucasus_formular_ids,
                    'card_ids': _formular_card_ids(caucasus_formular_ids),
                },
            ),
            _step(
                title='Справка: Армения',
                tool=DemoStepTool.COUNTRY,
                camera=_fit(zoom=7, padding=80),
                selection={
                    'country_isos': ['AM'],
                    'card_ids': _country_card_ids('AM'),
                },
            ),
            _step(
                title='Зоны действия',
                tool=DemoStepTool.ZONES,
                hold_previous=True,
                camera=_fit(zoom=7, padding=64),
                selection={'zone_leaves': armenia_zone_leaves},
                animation=reveal_loop,
            ),
            _step(
                title='События на Кавказе',
                tool=DemoStepTool.EVENTS,
                hold_previous=True,
                selection={'event_ids': _ids(caucasus_events)},
                animation={'effect': 'blink', 'duration_ms': 1100, 'continuous': True, 'repeat': 0},
            ),
            _step(
                title='Перелёт в Центральную Азию',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*ASIA, 6),
            ),
            _step(
                title='Объекты РЛС',
                tool=DemoStepTool.OBJECTS,
                camera=_fit(zoom=7, padding=80),
                selection={'target_ids': _ids(rls_objects, 5)},
                animation={'effect': 'fade_in', 'duration_ms': 1200, 'easing': 'ease_in_out'},
            ),
            _step(
                title='Зоны РЛС без рельефа',
                tool=DemoStepTool.ZONES,
                hold_previous=True,
                camera=_fit(zoom=6, padding=72),
                selection={'zone_leaves': rls_zone_leaves},
                animation=reveal_loop,
            ),
            _step(
                title='Формуляр РЛС: пункты',
                tool=DemoStepTool.FORMULAR,
                camera=_fit(zoom=9, padding=72),
                selection={
                    'target_ids': rls_formular_ids,
                    'card_ids': _formular_card_ids(rls_formular_ids, extra=['zones']),
                },
            ),
            _step(
                title='Справка: Казахстан',
                tool=DemoStepTool.COUNTRY,
                camera=_fit(zoom=6, padding=88),
                selection={
                    'country_isos': ['KZ'],
                    'card_ids': _country_card_ids('KZ'),
                },
            ),
            _step(
                title='События Центральной Азии',
                tool=DemoStepTool.EVENTS,
                hold_previous=True,
                selection={'event_ids': _ids(asia_events)},
                animation={'effect': 'blink', 'duration_ms': 1100, 'continuous': True, 'repeat': 0},
            ),
            _step(
                title='Зоны затопления',
                tool=DemoStepTool.INUNDATION,
                camera=_fit(zoom=6, padding=72),
                selection={
                    'target_ids': _ids(hydro_objects, 8),
                    'zone_leaves': inundation_leaves,
                },
                animation={
                    'effect': 'directional_wipe',
                    'direction': 'bottom',
                    'duration_ms': 1800,
                    'easing': 'ease_in_out',
                    'continuous': True,
                },
            ),
            _step(
                title='Обстановка: Кавказ',
                tool=DemoStepTool.SITUATIONS,
                camera=_fit(zoom=7, padding=88),
                selection={'situation_ids': caucasus_situation_ids},
                animation={'effect': 'fade_in', 'duration_ms': 1200, 'easing': 'ease_out'},
            ),
            _step(
                title='Обстановка: Центральная Азия',
                tool=DemoStepTool.SITUATIONS,
                camera=_fit(zoom=6, padding=88),
                selection={'situation_ids': asia_situation_ids},
                animation=state_cycle,
            ),
            _step(
                title='Обстановка: европейская часть РФ',
                tool=DemoStepTool.SITUATIONS,
                camera=_fit(zoom=6, padding=88),
                selection={'situation_ids': europe_situation_ids},
                animation=state_cycle,
            ),
            _step(
                title='Отдаление',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
            ),
            _step(
                title='Слои карты',
                tool=DemoStepTool.LAYERS,
                hold_previous=True,
                selection={
                    'overlay_layer_ids': ['water', 'hydroLabels', 'roads'],
                },
            ),
            _step(
                title='Возврат к обзору',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*CAUCASUS, 5),
            ),
        ]

        if existing:
            scenario = existing
            scenario.title = SCENARIO_TITLE
            scenario.description = DESCRIPTION
            scenario.loop = True
            scenario.is_default = True
            scenario.default_step_duration_ms = STEP_MS
            scenario.save()
        else:
            scenario = DemoScenario.objects.create(
                title=SCENARIO_TITLE,
                description=DESCRIPTION,
                loop=True,
                is_default=True,
                default_step_duration_ms=STEP_MS,
            )

        replace_demo_scenario_steps(scenario, steps)
        clear_other_default_scenarios(scenario)

        total_ms = sum(step['duration_ms'] for step in steps)
        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, шагов={len(steps)}, '
            f'{total_ms / 1000:.0f} с). Запуск: Инструменты → Демонстрация: воспроизвести.'
        ))
        self.stdout.write(
            f'  объекты Кавказа: {caucasus_objects.count()}, РЛС: {rls_objects.count()}, '
            f'ГЭС: {hydro_objects.count()}, события: {caucasus_events.count() + asia_events.count()}, '
            f'обстановка: Кавказ={len(caucasus_situation_ids)}, '
            f'Азия={len(asia_situation_ids)}, РФ={len(europe_situation_ids)}'
        )
