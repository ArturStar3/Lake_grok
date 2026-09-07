"""
Тестовый сценарий всех возможностей карты.

Программа:
  1. Художественный режим — копия пресета из «Художественный: планшетный обзор».
  2. Мультиэкран 2+3: объекты / зоны / события / обстановка / подтопление.
  3. Поочерёдный разворот каждого экрана в полный формат со свёрткой в сетку.

Использование:
  python manage.py seed_map_capabilities_demo_scenario
  python manage.py seed_map_capabilities_demo_scenario --replace
  python manage.py seed_map_capabilities_demo_scenario --replace --default
"""

import copy
import uuid

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    normalize_scenario_mosaic,
    normalize_scenario_tableau,
    replace_demo_scenario_library,
)
from formular.enums import ZoneGeometryModes
from formular.models import (
    ActionType,
    Country,
    DemoScenario,
    DemoStepStartMode,
    DemoStepTool,
    Event,
    OperationalSituation,
    Target,
)


SCENARIO_TITLE = 'Все возможности карты (тест)'
TABLEAU_SOURCE_TITLE = 'Художественный: планшетный обзор'
LEGACY_TITLES = ()
STEP_MS = 4000
CAM_MS = 2200
TABLEAU_MS = 18000
GRID_MS = 8000
EXPAND_MS = 2500
COLLAPSE_MS = 950
CAUCASUS = (40.45, 46.40)
ASIA = (41.20, 70.80)
MOSAIC_PRESET_ID = 'map-capabilities-mosaic-2plus3'

DESCRIPTION = (
    'Тестовая демонстрация возможностей карты: художественный режим '
    '(планшетный обзор из БД), затем мультиэкран «два сверху, три снизу» '
    'с объектами, зонами действия, событиями, оперативной обстановкой и '
    'зонами подтопления. Каждый экран по очереди разворачивается в полный '
    'формат и сворачивается обратно в сетку.'
)


def _ids(queryset, limit=None):
    values = list(queryset.values_list('id', flat=True))
    if limit is not None:
        values = values[:limit]
    return [str(item) for item in values]


def _unique(items):
    seen = set()
    result = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


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


def _step(
    *,
    title,
    tool,
    camera=None,
    selection=None,
    animation=None,
    hold_previous=False,
    start_mode=DemoStepStartMode.ON_CLICK,
    text=None,
    duration_ms=STEP_MS,
):
    return {
        'title': title,
        'tool': tool,
        'duration_ms': duration_ms,
        'start_mode': start_mode,
        'hold_previous': hold_previous,
        'camera': camera or {'mode': 'none'},
        'selection': selection or {},
        'animation': animation or {'effect': 'none'},
        'text': text or {},
    }


def _caption(content, *, screen_y=0.1, font_size=36):
    return {
        'content': content,
        'anchor': 'screen',
        'screen': {'x': 0.5, 'y': screen_y},
        'style': {
            'font_family': 'Roboto',
            'font_size': font_size,
            'font_weight': 700,
            'text_align': 'center',
            'color': '#ffffff',
            'stroke': {'enabled': True, 'color': '#0b1a2b', 'width': 3},
            'shadow': {
                'enabled': True,
                'color': 'rgba(0,0,0,0.55)',
                'blur': 12,
                'x': 0,
                'y': 2,
            },
        },
        'enter': {'effect': 'fade', 'duration_ms': 500, 'easing': 'ease_out'},
        'exit': {'effect': 'fade', 'duration_ms': 350},
    }


def _stage(title, steps):
    return {
        'id': str(uuid.uuid4()),
        'title': title,
        'steps': steps,
    }


def _seq(
    kind,
    *,
    stage_id=None,
    preset_id=None,
    enter='none',
    exit_effect='none',
    duration_ms=0,
    wait=False,
    enter_ms=500,
    exit_ms=400,
    mosaic_action='show_grid',
    slot=None,
):
    return {
        'type': kind,
        'stage_id': stage_id,
        'preset_id': preset_id,
        'mosaic_action': mosaic_action,
        'slot': slot,
        'duration_ms': duration_ms,
        'wait_for_presenter': wait,
        'enter': {'effect': enter, 'duration_ms': enter_ms},
        'exit': {'effect': exit_effect, 'duration_ms': exit_ms},
    }


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


def _clone_stage(stage):
    return {
        'id': str(uuid.uuid4()),
        'title': stage.title or 'Планшет: источники',
        'steps': [
            {
                'title': step.title or '',
                'tool': step.tool,
                'duration_ms': step.duration_ms,
                'start_mode': step.start_mode,
                'hold_previous': step.hold_previous,
                'camera': step.camera or {},
                'selection': step.selection or {},
                'animation': step.animation or {},
                'text': step.text or {},
                'mosaic': step.mosaic or {},
            }
            for step in stage.steps.all().order_by('order')
        ],
    }


def _copy_tableau_from_source(source):
    """Копирует tableau JSON и клонирует этапы, на которые ссылаются пресеты."""
    tableau = copy.deepcopy(source.tableau or {})
    if not isinstance(tableau, dict):
        tableau = {}
    presets = tableau.get('presets') if isinstance(tableau.get('presets'), list) else []
    source_stages = {
        str(stage.id): stage
        for stage in source.stages.prefetch_related('steps').all()
    }
    cloned = []
    id_map = {}
    for preset in presets:
        if not isinstance(preset, dict):
            continue
        old_id = str(preset.get('stage_id') or '').strip()
        if old_id and old_id not in id_map and old_id in source_stages:
            stage = _clone_stage(source_stages[old_id])
            id_map[old_id] = stage['id']
            cloned.append(stage)
        if old_id in id_map:
            preset['stage_id'] = id_map[old_id]
    return normalize_scenario_tableau(tableau), cloned


class Command(BaseCommand):
    help = (
        'Создаёт тестовый сценарий всех возможностей карты: '
        'художественный режим, мультиэкран 2+3 и развороты экранов'
    )

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true')
        parser.add_argument('--default', action='store_true')

    def _load_tableau_source(self):
        source = DemoScenario.objects.filter(title=TABLEAU_SOURCE_TITLE).first()
        if source and source.tableau:
            return source
        self.stdout.write(
            'Витрина художественного режима не найдена — создаю '
            f'«{TABLEAU_SOURCE_TITLE}».'
        )
        call_command('seed_tableau_demo_scenario')
        return DemoScenario.objects.filter(title=TABLEAU_SOURCE_TITLE).first()

    def handle(self, *args, **options):
        existing = DemoScenario.objects.filter(title=SCENARIO_TITLE).first()
        if not existing:
            existing = DemoScenario.objects.filter(title__in=LEGACY_TITLES).first()
        if existing and not options['replace']:
            self.stdout.write(self.style.WARNING(
                f'Сценарий «{existing.title}» уже есть (id={existing.id}). '
                'Запустите с --replace.'
            ))
            return

        source = self._load_tableau_source()
        if not source or not source.tableau:
            raise CommandError(
                f'Не удалось взять художественный пресет из «{TABLEAU_SOURCE_TITLE}».'
            )
        with transaction.atomic():
            self._write(existing, source, options)

    def _write(self, existing, source, options):
        tableau, tableau_stages = _copy_tableau_from_source(source)
        if not tableau.get('presets'):
            raise CommandError(
                f'В «{TABLEAU_SOURCE_TITLE}» нет художественных пресетов.'
            )
        tableau_preset_id = (
            tableau.get('active_preset_id')
            or tableau['presets'][0].get('id')
        )
        if not tableau_stages:
            self.stdout.write(self.style.WARNING(
                'У художественного пресета нет связанного этапа — '
                'карта под планшетом может быть пустой.'
            ))

        caucasus_objects = Target.objects.filter(
            title__in=[
                'Мингечевирская ГЭС (qa)',
                'Headquarters (АРМ-0003)',
                'Дивизия (АРМ-0049)',
                'Общевойсковая армия (АРМ-0053)',
            ]
        )
        if caucasus_objects.count() < 2:
            armenia = Country.objects.filter(iso_code='AM').first()
            extra = Target.objects.filter(country=armenia)[:4] if armenia else Target.objects.none()
            caucasus_objects = (caucasus_objects | extra).distinct()
        if caucasus_objects.count() < 2:
            caucasus_objects = Target.objects.all()[:6]

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
        if not hydro_objects.exists():
            hydro_objects = Target.objects.all()[4:10]

        events = Event.objects.filter(
            title__in=[
                'Учения ПВО на Кавказе',
                'Учения ОДКБ «Рубеж»',
                'Разведывательные полёты БПЛА',
                'Инцидент на КПП',
                'Модернизация позиции РЛС',
            ]
        )
        if events.count() < 2:
            events = Event.objects.all()[:6]

        situation_ids = _situation_ids('Центральная Азия')[:1]
        if not situation_ids:
            situation_ids = _situation_ids('Кавказ')[:1]
        if not situation_ids:
            fallback = OperationalSituation.objects.order_by('-created_at').first()
            if fallback:
                situation_ids = [str(fallback.id)]

        fire_type = ActionType.objects.filter(title='Огневая поддержка').first()
        recon_type = ActionType.objects.filter(title='Разведка').first()
        rls_type = (
            ActionType.objects.filter(title='РЛС').first()
            or ActionType.objects.filter(zone_mode=ZoneGeometryModes.LOS_RADAR).first()
        )
        inund_type = ActionType.objects.filter(
            title='Затопление — нормальный уровень',
            is_inundation_zone=True,
        ).first() or ActionType.objects.filter(is_inundation_zone=True).first()

        armenia_zone_leaves = []
        for action_type in (recon_type, fire_type):
            armenia_zone_leaves.extend(_zone_leaves(action_type, ['Армения']))
        if not armenia_zone_leaves:
            rls_country_titles = list(
                rls_objects.exclude(country__isnull=True).values_list(
                    'country__title', flat=True,
                )
            )
            if not rls_country_titles:
                kz = Country.objects.filter(iso_code='KZ').first()
                if kz:
                    rls_country_titles = [kz.title]
            armenia_zone_leaves = _zone_leaves(rls_type, rls_country_titles)

        inundation_leaves = []
        if inund_type:
            inundation_leaves = _zone_leaves(inund_type, [
                'Таджикистан', 'Кыргызстан', 'Казахстан', 'Азербайджан', 'Узбекистан',
            ])

        object_ids = _ids(caucasus_objects) or _ids(rls_objects, 6)
        event_ids = _ids(events)
        hydro_ids = _ids(hydro_objects, 8)

        reveal_loop = {
            'effect': 'reveal_from_center',
            'duration_ms': 2000,
            'easing': 'ease_out',
            'continuous': True,
        }
        state_cycle = {
            'effect': 'state_cycle',
            'continuous': True,
            'state_cycle': {
                'per_state_ms': 1400,
                'cross_fade_ms': 400,
                'order': 'old_to_new',
            },
        }

        objects_stage = _stage('Объекты', [
            _step(
                title='Объекты',
                tool=DemoStepTool.OBJECTS,
                camera=_fit(zoom=8, padding=80) if object_ids else _fly(*CAUCASUS, 7),
                selection={'target_ids': object_ids},
                animation={'effect': 'fade_in', 'duration_ms': 1400, 'easing': 'ease_out'},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Объекты'),
            ),
        ])
        zones_stage = _stage('Зоны действия', [
            _step(
                title='Зоны действия',
                tool=DemoStepTool.ZONES,
                camera=_fit(zoom=7, padding=64) if armenia_zone_leaves else _fly(*CAUCASUS, 6),
                selection={'zone_leaves': armenia_zone_leaves},
                animation=reveal_loop,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Зоны действия'),
            ),
        ])
        events_stage = _stage('События', [
            _step(
                title='События',
                tool=DemoStepTool.EVENTS,
                camera=_fly(*CAUCASUS, 5),
                selection={'event_ids': event_ids},
                animation={
                    'effect': 'blink',
                    'duration_ms': 1100,
                    'continuous': True,
                    'repeat': 0,
                },
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('События'),
            ),
        ])
        situations_stage = _stage('Оперативная обстановка', [
            _step(
                title='Оперативная обстановка',
                tool=DemoStepTool.SITUATIONS,
                camera=_fit(zoom=6, padding=88) if situation_ids else _fly(*ASIA, 6),
                selection={'situation_ids': situation_ids},
                animation=state_cycle,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Оперативная обстановка'),
            ),
        ])
        inundation_stage = _stage('Зоны подтапления', [
            _step(
                title='Зоны подтапления',
                tool=DemoStepTool.INUNDATION,
                camera=_fit(zoom=6, padding=72) if hydro_ids or inundation_leaves else _fly(*ASIA, 6),
                selection={
                    'target_ids': hydro_ids,
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
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Зоны подтапления'),
            ),
        ])

        stages_data = list(tableau_stages) + [
            objects_stage,
            zones_stage,
            events_stage,
            situations_stage,
            inundation_stage,
        ]

        mosaic = normalize_scenario_mosaic({
            'presets': [{
                'id': MOSAIC_PRESET_ID,
                'title': 'Два сверху, три снизу',
                'layout': '2+3',
                'transition_ms': 700,
                'expand_animation': 'center_then_stretch',
                'expand_ms': 1100,
                'collapse_ms': 950,
                'expand_easing': 'ease_out',
                'collapse_easing': 'ease_in_out',
                'reveal': 'stagger',
                'stagger_ms': 350,
                'expandable_slots': ['a', 'b', 'c', 'd', 'e'],
                'screens': [
                    {'id': 'a', 'label': 'Объекты', 'loop': True, 'stage_id': objects_stage['id']},
                    {'id': 'b', 'label': 'Зоны действия', 'loop': True, 'stage_id': zones_stage['id']},
                    {'id': 'c', 'label': 'События', 'loop': True, 'stage_id': events_stage['id']},
                    {
                        'id': 'd',
                        'label': 'Оперативная обстановка',
                        'loop': True,
                        'stage_id': situations_stage['id'],
                    },
                    {
                        'id': 'e',
                        'label': 'Зоны подтапления',
                        'loop': True,
                        'stage_id': inundation_stage['id'],
                    },
                ],
            }],
            'active_preset_id': MOSAIC_PRESET_ID,
        })

        sequence = [
            {
                'type': 'tableau',
                'preset_id': tableau_preset_id,
                'duration_ms': TABLEAU_MS,
                'wait_for_presenter': False,
                'enter': {'effect': 'fade', 'duration_ms': 800},
                'exit': {'effect': 'fade', 'duration_ms': 500},
            },
            _seq(
                'mosaic',
                preset_id=MOSAIC_PRESET_ID,
                duration_ms=GRID_MS,
                enter='stagger',
                enter_ms=800,
            ),
        ]
        for slot in ('a', 'b', 'c', 'd', 'e'):
            sequence.append(_seq(
                'mosaic',
                preset_id=MOSAIC_PRESET_ID,
                mosaic_action='expand',
                slot=slot,
                duration_ms=EXPAND_MS,
                enter_ms=700,
            ))
            sequence.append(_seq(
                'mosaic',
                preset_id=MOSAIC_PRESET_ID,
                mosaic_action='collapse',
                duration_ms=COLLAPSE_MS,
                enter_ms=700,
            ))

        make_default = bool(options['default'])
        if existing:
            scenario = existing
            scenario.title = SCENARIO_TITLE
            scenario.description = DESCRIPTION
            scenario.loop = True
            scenario.auto_advance = True
            scenario.is_default = make_default
            scenario.default_step_duration_ms = STEP_MS
            scenario.save()
        else:
            scenario = DemoScenario.objects.create(
                title=SCENARIO_TITLE,
                description=DESCRIPTION,
                loop=True,
                auto_advance=True,
                is_default=make_default,
                default_step_duration_ms=STEP_MS,
            )

        replace_demo_scenario_library(
            scenario,
            stages_data,
            sequence_data=sequence,
            mosaic_data=mosaic,
            tableau_data=tableau,
        )
        if make_default:
            clear_other_default_scenarios(scenario)

        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, '
            f'этапов={len(stages_data)}, блоков программы={len(sequence)}, '
            f'default={make_default}).'
        ))
        self.stdout.write(
            f'  художественный пресет: {tableau_preset_id} '
            f'(из «{TABLEAU_SOURCE_TITLE}», этапов={len(tableau_stages)})'
        )
        self.stdout.write(
            '  программа: планшет → сетка 2+3 → '
            'разворот/свёртка A–E (объекты, зоны, события, обстановка, подтопление)'
        )
        self.stdout.write(
            f'  объекты={len(object_ids)}, зоны={len(armenia_zone_leaves)}, '
            f'события={len(event_ids)}, обстановка={len(situation_ids)}, '
            f'подтопление={len(inundation_leaves)}'
        )
