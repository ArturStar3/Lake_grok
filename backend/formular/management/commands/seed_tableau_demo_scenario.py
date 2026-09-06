"""
Создаёт демонстрационный сценарий художественного режима (как на референсе).

Витрина: живая карта Казахстана / Центральной Азии с наклоном «планшет»,
стеклянные карточки «Источники информации» и пунктирные стрелки к РЛС
Астана / Алматы и связанным объектам.

Использование:
  python manage.py seed_tableau_demo_scenario
  python manage.py seed_tableau_demo_scenario --replace
  python manage.py seed_tableau_demo_scenario --replace --default
"""

import uuid

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    normalize_scenario_tableau,
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


SCENARIO_TITLE = 'Художественный: планшетный обзор'
LEGACY_TITLES = ()
STEP_MS = 5000
CAM_MS = 2400
# Центр обзора ближе к референсу (Казахстан / ЦА)
KAZ_CENTER = (46.5, 70.0)
OVERVIEW = (45.0, 65.0)
PRESET_ID = 'tableau-showcase-tablet'

DESCRIPTION = (
    'Демонстрация художественного режима: карта наклоняется как планшет, '
    'поверх — стеклянные карточки «Источники информации» и пунктирные '
    'стрелки к объектам (РЛС Астана, РЛС Алматы и др.).'
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
        'animation': {'effect': 'none'},
        'text': text or {},
    }


def _caption(content):
    return {
        'content': content,
        'anchor': 'screen',
        'screen': {'x': 0.5, 'y': 0.1},
        'style': {
            'font_family': 'Roboto',
            'font_size': 38,
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


def _seq_stage(stage_id, *, enter='none', exit_effect='none', duration_ms=0):
    return {
        'type': 'stage',
        'stage_id': stage_id,
        'duration_ms': duration_ms,
        'wait_for_presenter': False,
        'enter': {'effect': enter, 'duration_ms': 500},
        'exit': {'effect': exit_effect, 'duration_ms': 400},
    }


def _pick_targets(*title_fragments, limit=6):
    qs = Target.objects.none()
    for fragment in title_fragments:
        qs = qs | Target.objects.filter(title__icontains=fragment)
    found = qs.distinct()
    if found.exists():
        return found[:limit]
    return Target.objects.none()


class Command(BaseCommand):
    help = (
        'Создаёт демонстрационный сценарий художественного режима '
        '(наклон карты + карточки со стрелками)'
    )

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

        kz = Country.objects.filter(iso_code='KZ').first()

        astana = _pick_targets('РЛС Астана', 'Астана', limit=2)
        almaty = _pick_targets('РЛС Алматы', 'Алматы', limit=2)
        rls_other = Target.objects.filter(title__startswith='РЛС ').exclude(
            id__in=list(astana.values_list('id', flat=True))
            + list(almaty.values_list('id', flat=True))
        ).order_by('title')[:4]

        if kz and (astana.count() + almaty.count()) < 2:
            kz_targets = Target.objects.filter(country=kz).order_by('title')[:8]
        else:
            kz_targets = Target.objects.none()

        showcase = (astana | almaty | rls_other | kz_targets).distinct()
        if showcase.count() < 3:
            showcase = Target.objects.all()[:8]

        events = Event.objects.filter(
            Q(title__icontains='Казахстан')
            | Q(title__icontains='Алматы')
            | Q(title__icontains='Астана')
            | Q(title__icontains='РЛС')
            | Q(title__icontains='Учения')
        ).distinct()[:4]
        if events.count() < 1:
            events = Event.objects.all()[:3]

        showcase_ids = _ids(showcase)
        event_ids = _ids(events)

        intro = _stage('Интро', [
            _step(
                title='Общий план',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=2600,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Художественный режим'),
            ),
        ])

        # Один такт с объектами + событиями — карта сразу «полная» под карточки
        tableau_stage = _stage('Планшет: источники', [
            _step(
                title='Казахстан / ЦА',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(*KAZ_CENTER, 5.2),
                selection={'target_ids': showcase_ids},
                duration_ms=STEP_MS,
            ),
            _step(
                title='События региона',
                tool=DemoStepTool.EVENTS,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                selection={'event_ids': event_ids},
                duration_ms=STEP_MS,
            ),
        ])

        finale = _stage('Финал', [
            _step(
                title='Финал',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=2400,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Демонстрация художественного режима'),
            ),
        ])

        stages_data = [intro, tableau_stage, finale]

        def _info_block(block_id, title, items):
            content = title + '\n' + '\n'.join(f'• {item}' for item in items)
            return {
                'id': block_id,
                'title': title,
                'width': 22,
                'height': 28,
                'border_radius_px': 12,
                'fill': {'color': 'rgba(15,23,42,0.55)', 'opacity': 1},
                'border': {'color': 'rgba(255,255,255,0.28)', 'width': 1, 'opacity': 1},
                'elements': [{
                    'type': 'text',
                    'id': f'{block_id}-text',
                    'content': content,
                    'x': 8,
                    'y': 8,
                    'w': 84,
                    'h': 84,
                    'style': {
                        'font_size': 13,
                        'font_weight': 600,
                        'text_align': 'left',
                        'color': '#f8fafc',
                        'line_height': 1.35,
                    },
                }],
            }

        blocks = [
            _info_block('block-astana', 'Источники информации', [
                'Официальные сайты ВУС / ВРУ',
                'Минсвязи ДРУ',
                'Открытые реестры РЛС',
            ]),
            _info_block('block-almaty-n', 'Источники информации', [
                'Региональный узел связи',
                'Каталог объектов Алматы',
                'Сводка по южному сектору',
            ]),
            _info_block('block-net', 'Источники информации', [
                'Сеть датчиков ЦА',
                'Межведомственный обмен',
                'Архив учений',
            ]),
            _info_block('block-almaty-s', 'Источники информации', [
                'Позиции РЛС (горы юг)',
                'Метео и рельеф',
                'Контроль зоны обзора',
            ]),
            _info_block('block-bridge', 'Сводка источников', [
                'Астана / ВУС',
                'Алматы север',
                'Сеть ЦА',
                'Алматы юг / РЛС',
            ]),
        ]

        tableau = normalize_scenario_tableau({
            'blocks': blocks,
            'presets': [{
                'id': PRESET_ID,
                'title': 'Источники на планшете',
                'stage_id': tableau_stage['id'],
                'tilt': {
                    'perspective': 1600,
                    'rotate_x': 58,
                    'rotate_z': -6,
                    'scale': 0.88,
                },
                'border_radius_px': 16,
                'tilt_ms': 900,
                'untilt_ms': 700,
                'caption': {
                    'content': 'Источники информации',
                    'x': 50,
                    'y': 5,
                },
                'card_stagger_ms': 380,
                'arrow_draw_ms': 1100,
                'camera': {
                    'mode': 'fly_to',
                    'lat': KAZ_CENTER[0],
                    'lng': KAZ_CENTER[1],
                    'zoom': 5.2,
                    'duration_ms': CAM_MS,
                },
                'map_reveal': {
                    'lifetime_ms': 3500,
                    'spawn_gap_min_ms': 0,
                    'spawn_gap_max_ms': 1000,
                },
                'overlay': {
                    'cols': 4,
                    'rows': 2,
                    'x': 4,
                    'y': 2,
                    'width': 92,
                    'height': 34,
                    'column_gap': 1.2,
                    'row_gap': 1.2,
                    'row_heights': [1.4, 0.8],
                    'cells': [
                        {
                            'id': 'cell-astana',
                            'row': 0,
                            'col': 0,
                            'col_span': 1,
                            'role': 'card',
                            'block_id': 'block-astana',
                            'content_width': 90,
                            'content_height': 100,
                            'align_x': 'center',
                            'align_y': 'center',
                        },
                        {
                            'id': 'cell-almaty-n',
                            'row': 0,
                            'col': 1,
                            'col_span': 1,
                            'role': 'card',
                            'block_id': 'block-almaty-n',
                            'content_width': 90,
                            'content_height': 100,
                            'align_x': 'center',
                            'align_y': 'center',
                        },
                        {
                            'id': 'cell-net',
                            'row': 0,
                            'col': 2,
                            'col_span': 1,
                            'role': 'card',
                            'block_id': 'block-net',
                            'content_width': 90,
                            'content_height': 100,
                            'align_x': 'center',
                            'align_y': 'center',
                        },
                        {
                            'id': 'cell-almaty-s',
                            'row': 0,
                            'col': 3,
                            'col_span': 1,
                            'role': 'card',
                            'block_id': 'block-almaty-s',
                            'content_width': 90,
                            'content_height': 100,
                            'align_x': 'center',
                            'align_y': 'center',
                        },
                        {
                            'id': 'cell-bridge',
                            'row': 1,
                            'col': 1,
                            'col_span': 2,
                            'role': 'bridge',
                            'block_id': 'block-bridge',
                            'content_width': 100,
                            'content_height': 70,
                            'align_x': 'center',
                            'align_y': 'center',
                        },
                    ],
                    'map_arrow': {
                        'inset': 14,
                        'line': 'dashed',
                        'width': 1.5,
                        'color': 'rgba(248,250,252,0.88)',
                        'head': 'end',
                    },
                },
            }],
            'active_preset_id': PRESET_ID,
        })

        sequence = [
            _seq_stage(intro['id'], enter='fade'),
            {
                'type': 'tableau',
                'preset_id': PRESET_ID,
                'duration_ms': 18000,
                'wait_for_presenter': False,
                'enter': {'effect': 'fade', 'duration_ms': 800},
                'exit': {'effect': 'fade', 'duration_ms': 500},
            },
            _seq_stage(finale['id'], enter='blackout'),
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
            tableau_data=tableau,
        )
        if make_default:
            clear_other_default_scenarios(scenario)

        overlay = tableau['presets'][0]['overlay']
        overlay_cells = overlay.get('cells') or []
        bridge_cells = sum(1 for cell in overlay_cells if cell.get('role') == 'bridge')
        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, '
            f'этапов={len(stages_data)}, блоков программы={len(sequence)}, '
            f'шаблонов={len(tableau["blocks"])}, '
            f'overlay.cells={len(overlay_cells)}, '
            f'bridge={bridge_cells > 0}). '
            f'is_default={scenario.is_default}.'
        ))
        self.stdout.write(
            'Откройте: Инструменты → Настроить демонстрацию… → '
            '«Художественный: планшетный обзор» → Воспроизвести.'
        )
