"""
Витрина трёх конструкторов демонстрации.

Показывает:
  - библиотеку этапов (часть только для слотов мультиэкрана);
  - этап из нескольких тактов (камера + объекты + подпись, затем приближение);
  - пресет 2+3 с назначенными этапами;
  - программу: fade / stagger / blackout, разворот слота мультиэкрана,
    пауза «по клику».

Использование:
  python manage.py seed_constructors_demo_scenario
  python manage.py seed_constructors_demo_scenario --replace
  python manage.py seed_constructors_demo_scenario --replace --default
"""

import uuid

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    normalize_scenario_mosaic,
    replace_demo_scenario_library,
)
from formular.models import (
    Country,
    DemoScenario,
    DemoStepStartMode,
    DemoStepTool,
    Event,
    Target,
)


SCENARIO_TITLE = 'Три конструктора (витрина)'
LEGACY_TITLES = ()
STEP_MS = 4000
CAM_MS = 2200
CAUCASUS = (40.45, 46.40)
ASIA = (41.20, 70.80)
OVERVIEW = (42.50, 55.00)
PRESET_ID = 'constructors-mosaic-2plus3'

DESCRIPTION = (
    'Витрина новых возможностей: библиотека этапов, пресет «два сверху, три снизу» '
    'и программа показа. Один этап собран из нескольких тактов; те же этапы стоят '
    'на слотах мультиэкрана и снова на основной карте. Есть вход fade / stagger / '
    'blackout, разворот слота в полный экран и пауза для докладчика.'
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


def _caption(content, *, screen_y=0.12, font_size=38):
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
            'shadow': {'enabled': True, 'color': 'rgba(0,0,0,0.55)', 'blur': 12, 'x': 0, 'y': 2},
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


def _seq(kind, *, stage_id=None, preset_id=None, enter='none', exit_effect='none',
         duration_ms=0, wait=False, enter_ms=500, exit_ms=400,
         mosaic_action='show_grid', slot=None):
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


class Command(BaseCommand):
    help = 'Витрина трёх конструкторов: этапы, мультиэкран 2+3, программа с переходами'

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true')
        parser.add_argument('--default', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        existing = DemoScenario.objects.filter(title=SCENARIO_TITLE).first()
        if existing and not options['replace']:
            self.stdout.write(self.style.WARNING(
                f'Сценарий «{existing.title}» уже есть (id={existing.id}). '
                'Запустите с --replace.'
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
        if caucasus_objects.count() < 2:
            armenia = Country.objects.filter(iso_code='AM').first()
            extra = Target.objects.filter(country=armenia)[:4] if armenia else Target.objects.none()
            caucasus_objects = (caucasus_objects | extra).distinct()
        if caucasus_objects.count() < 2:
            caucasus_objects = Target.objects.all()[:4]

        hydro_objects = Target.objects.filter(
            Q(title__icontains='ГЭС') | Q(title__icontains='Рогун')
        ).distinct()[:6]
        if not hydro_objects.exists():
            hydro_objects = Target.objects.all()[4:10]

        rls_objects = Target.objects.filter(title__startswith='РЛС ').order_by('title')[:6]
        if not rls_objects.exists():
            rls_objects = Target.objects.all()[10:16]

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
            events = Event.objects.all()[:4]

        caucasus_ids = _ids(caucasus_objects)
        hydro_ids = _ids(hydro_objects)
        rls_ids = _ids(rls_objects)
        event_ids = _ids(events)
        filler = Target.objects.all()[16:22]
        filler_ids = _ids(filler) or caucasus_ids[:2]

        title = _stage('Титул', [
            _step(
                title='Общий план',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=3500,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Этап → мультиэкран → программа', font_size=42),
            ),
        ])

        # Несколько тактов внутри одного этапа: параллельный вход, затем приближение.
        beats = _stage('Этап из нескольких тактов', [
            _step(
                title='Кавказ: камера',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*CAUCASUS, 6),
                duration_ms=3800,
            ),
            _step(
                title='Объекты',
                tool=DemoStepTool.OBJECTS,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                camera={'mode': 'none'},
                selection={'target_ids': caucasus_ids},
                animation={'effect': 'fade_in', 'duration_ms': 1400, 'easing': 'ease_out'},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Один этап · несколько тактов'),
            ),
            _step(
                title='Приближение',
                tool=DemoStepTool.CAMERA,
                start_mode=DemoStepStartMode.AFTER_PREVIOUS,
                hold_previous=True,
                camera=_fly(*CAUCASUS, 9),
                duration_ms=3200,
            ),
        ])

        caucasus = _stage('Кавказ', [
            _step(
                title='Кавказ',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(*CAUCASUS, 7),
                selection={'target_ids': caucasus_ids},
                animation={'effect': 'fade_in', 'duration_ms': 1000, 'easing': 'ease_out'},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Кавказ', font_size=32),
            ),
        ])
        hydro = _stage('ГЭС / Азия', [
            _step(
                title='ГЭС / Азия',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(*ASIA, 6),
                selection={'target_ids': hydro_ids},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('ГЭС / Азия', font_size=32),
            ),
        ])
        events_stage = _stage('События', [
            _step(
                title='События',
                tool=DemoStepTool.EVENTS,
                camera=_fly(*CAUCASUS, 5),
                selection={'event_ids': event_ids},
                animation={'effect': 'blink', 'duration_ms': 1100, 'continuous': True, 'repeat': 0},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('События', font_size=32),
            ),
        ])
        rls = _stage('РЛС', [
            _step(
                title='РЛС',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(*ASIA, 5),
                selection={'target_ids': rls_ids},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('РЛС', font_size=32),
            ),
        ])
        overview = _stage('Общий план', [
            _step(
                title='Общий план',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(*OVERVIEW, 4),
                selection={'target_ids': filler_ids},
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Общий план', font_size=32),
            ),
        ])

        wait = _stage('Пауза докладчика', [
            _step(
                title='Пауза',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=2500,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Дальше — по щелчку докладчика', font_size=36),
            ),
        ])
        finale = _stage('Финал', [
            _step(
                title='Финал',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=3200,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Готово: три конструктора', font_size=40),
            ),
        ])

        stages_data = [
            title, beats, caucasus, hydro, events_stage, rls, overview, wait, finale,
        ]
        mosaic = normalize_scenario_mosaic({
            'presets': [{
                'id': PRESET_ID,
                'title': 'Два сверху, три снизу',
                'layout': '2+3',
                'transition_ms': 700,
                'reveal': 'stagger',
                'stagger_ms': 350,
                'expandable_slots': ['a', 'b', 'c', 'd', 'e'],
                'screens': [
                    {'id': 'a', 'label': 'Кавказ', 'loop': True, 'stage_id': caucasus['id']},
                    {'id': 'b', 'label': 'ГЭС / Азия', 'loop': False, 'stage_id': hydro['id']},
                    {'id': 'c', 'label': 'События', 'loop': False, 'stage_id': events_stage['id']},
                    {'id': 'd', 'label': 'РЛС', 'loop': True, 'stage_id': rls['id']},
                    {'id': 'e', 'label': 'Общий план', 'loop': False, 'stage_id': overview['id']},
                ],
            }],
            'active_preset_id': PRESET_ID,
        })
        sequence = [
            _seq('stage', stage_id=title['id'], enter='fade', enter_ms=600),
            _seq('stage', stage_id=beats['id']),
            _seq(
                'mosaic',
                preset_id=PRESET_ID,
                duration_ms=8000,
                enter='stagger',
                enter_ms=800,
            ),
            _seq(
                'mosaic',
                preset_id=PRESET_ID,
                mosaic_action='expand',
                slot='a',
                duration_ms=4000,
                enter_ms=700,
            ),
            _seq(
                'mosaic',
                preset_id=PRESET_ID,
                mosaic_action='collapse',
                duration_ms=800,
                enter_ms=700,
                exit_effect='fade',
                exit_ms=600,
            ),
            # Тот же этап, что на слоте A, теперь на живой карте.
            _seq('stage', stage_id=caucasus['id'], enter='blackout', enter_ms=700),
            _seq('stage', stage_id=wait['id'], wait=True),
            _seq('stage', stage_id=finale['id'], enter='fade', enter_ms=500),
        ]

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
        )
        if make_default:
            clear_other_default_scenarios(scenario)

        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, '
            f'этапов={len(stages_data)}, блоков программы={len(sequence)}, '
            f'default={make_default}).'
        ))
        self.stdout.write(
            '  программа: титул → такты → сетка 2+3 → разворот A → свёртка → '
            'Кавказ на карте → пауза докладчика → финал'
        )
        self.stdout.write(
            f'  объекты: Кавказ={len(caucasus_ids)}, ГЭС={len(hydro_ids)}, '
            f'РЛС={len(rls_ids)}, события={len(event_ids)}'
        )
