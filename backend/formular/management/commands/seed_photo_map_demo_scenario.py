"""
Тестовая демонстрация двух экранов мультиэкрана и наезда правого на полный кадр.

Программа:
  1. Интро — общий план.
  2. Сетка 1x2: слева фотография, справа живая карта.
  3. Разворот правого экрана (B) наездом поверх соседнего.
  4. Свёртка обратно в сетку.
  5. Финал.

Использование:
  python manage.py seed_photo_map_demo_scenario
  python manage.py seed_photo_map_demo_scenario --replace
  python manage.py seed_photo_map_demo_scenario --replace --default
"""

import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

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
    DemoTableauMedia,
    Target,
)
from PIL import Image, ImageDraw, ImageFont


SCENARIO_TITLE = 'Мультиэкран: фотография и карта (тест)'
LEGACY_TITLES = ()
PRESET_ID = 'photo-map-1x2'
STEP_MS = 4000
CAM_MS = 1800
GRID_MS = 5500
EXPAND_MS = 6500
COLLAPSE_MS = 1400
EXPAND_ANIM_MS = 1400
COLLAPSE_ANIM_MS = 1000
CAUCASUS = (40.45, 46.40)
OVERVIEW = (42.50, 55.00)

DESCRIPTION = (
    'Тестовая демонстрация крайней возможности мультиэкрана: два экрана в ряд '
    '(слева фотография, справа живая карта) и разворот правого экрана на полный '
    'кадр наездом поверх соседнего.'
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


def _caption(content, *, font_size=40):
    return {
        'content': content,
        'anchor': 'screen',
        'screen': {'x': 0.5, 'y': 0.12},
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


def _screen_text(content, *, y=0.82, font_size=32):
    return {
        'content': content,
        'anchor': 'screen',
        'screen': {'x': 0.5, 'y': y},
        'style': {
            'font_family': 'Roboto',
            'font_size': font_size,
            'font_weight': 700,
            'text_align': 'center',
            'color': '#ffffff',
            'stroke': {'enabled': True, 'color': '#0b1a2b', 'width': 2},
            'shadow': {'enabled': True, 'color': 'rgba(0,0,0,0.55)', 'blur': 10, 'x': 0, 'y': 2},
            'background': {
                'enabled': True,
                'color': '#0b1a2b',
                'opacity': 0.45,
                'radius': 8,
                'padding': 10,
            },
        },
        'enter': {'effect': 'fade', 'duration_ms': 400, 'easing': 'ease_out'},
        'exit': {'effect': 'fade', 'duration_ms': 250},
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


def _seq_mosaic(
    *,
    mosaic_action='show_grid',
    slot=None,
    duration_ms=0,
    enter='none',
    exit_effect='none',
    enter_ms=500,
    exit_ms=400,
    expand_animation=None,
):
    item = {
        'type': 'mosaic',
        'preset_id': PRESET_ID,
        'mosaic_action': mosaic_action,
        'slot': slot,
        'duration_ms': duration_ms,
        'wait_for_presenter': False,
        'enter': {'effect': enter, 'duration_ms': enter_ms},
        'exit': {'effect': exit_effect, 'duration_ms': exit_ms},
    }
    if expand_animation:
        item['expand_animation'] = expand_animation
    return item


def _load_font(size):
    for name in ('arial.ttf', 'Arial.ttf', 'DejaVuSans.ttf', 'segoeui.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _make_photo_png():
    """Плейсхолдер снимка местности для левого экрана."""
    width, height = 1600, 1000
    image = Image.new('RGB', (width, height), (28, 52, 48))
    draw = ImageDraw.Draw(image)
    for index in range(14):
        t = index / 13
        color = (
            int(18 + 22 * t),
            int(42 + 48 * t),
            int(36 + 18 * t),
        )
        y0 = int(height * (0.08 + t * 0.78))
        draw.rectangle((0, y0, width, height), fill=color)
    ridges = (
        (80, 620, 540, 980),
        (420, 480, 980, 1020),
        (860, 540, 1580, 1040),
        (200, 720, 780, 1080),
    )
    for box in ridges:
        draw.ellipse(box, fill=(62, 92, 58), outline=(92, 128, 78), width=2)
    river = [
        (0, 710), (180, 690), (340, 730), (520, 700),
        (740, 760), (980, 730), (1220, 790), (1600, 760),
    ]
    draw.line(river, fill=(72, 148, 168), width=18)
    draw.line(river, fill=(120, 196, 208), width=6)
    for col in range(0, width, 80):
        draw.line((col, 0, col, height), fill=(18, 28, 24), width=1)
    for row in range(0, height, 80):
        draw.line((0, row, width, row), fill=(18, 28, 24), width=1)
    draw.rectangle((0, 0, width, 86), fill=(11, 22, 28))
    draw.rectangle((0, height - 92, width, height), fill=(11, 22, 28))
    title_font = _load_font(42)
    hint_font = _load_font(24)
    draw.text((36, 22), 'Снимок местности', fill=(236, 244, 248), font=title_font)
    draw.text(
        (36, height - 64),
        'Левый экран · статическая фотография',
        fill=(160, 196, 188),
        font=hint_font,
    )
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.read()


def _save_photo():
    filename = 'photo-map-left.png'
    media = DemoTableauMedia()
    media.image.save(
        filename,
        ContentFile(_make_photo_png(), name=filename),
        save=True,
    )
    return media.image.url


def _pick_map_targets():
    named = Target.objects.filter(
        title__in=[
            'Мингечевирская ГЭС (qa)',
            'Headquarters (АРМ-0003)',
            'Дивизия (АРМ-0049)',
            'Общевойсковая армия (АРМ-0053)',
        ]
    )
    if named.count() >= 2:
        return named
    armenia = Country.objects.filter(iso_code='AM').first()
    if armenia:
        extra = Target.objects.filter(country=armenia)[:4]
        combined = (named | extra).distinct()
        if combined.count() >= 2:
            return combined
    return Target.objects.all()[:4]


class Command(BaseCommand):
    help = (
        'Создаёт тестовый сценарий двух экранов мультиэкрана '
        'с наездом правого экрана на полный кадр'
    )

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true')
        parser.add_argument('--default', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        existing = DemoScenario.objects.filter(title=SCENARIO_TITLE).first()
        if not existing and LEGACY_TITLES:
            existing = DemoScenario.objects.filter(title__in=LEGACY_TITLES).first()
        if existing and not options['replace']:
            self.stdout.write(self.style.WARNING(
                f'Сценарий «{existing.title}» уже есть (id={existing.id}). '
                'Запустите с --replace.'
            ))
            return

        photo_url = _save_photo()
        target_ids = _ids(_pick_map_targets())

        intro = _stage('Интро', [
            _step(
                title='Общий план',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=2800,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Два экрана: фотография и карта'),
            ),
        ])
        map_stage = _stage('Карта', [
            _step(
                title='Карта',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(*CAUCASUS, 7),
                selection={'target_ids': target_ids},
                duration_ms=STEP_MS,
            ),
        ])
        finale = _stage('Финал', [
            _step(
                title='Финал',
                tool=DemoStepTool.CAMERA,
                camera=_fly(*OVERVIEW, 4),
                duration_ms=2600,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Правый экран развернут наездом', font_size=36),
            ),
        ])

        stages_data = [intro, map_stage, finale]
        mosaic = normalize_scenario_mosaic({
            'presets': [{
                'id': PRESET_ID,
                'title': 'Фотография и карта',
                'layout': '1x2',
                'transition_ms': 700,
                'expand_animation': 'cover',
                'expand_ms': EXPAND_ANIM_MS,
                'collapse_ms': COLLAPSE_ANIM_MS,
                'expand_easing': 'ease_out',
                'collapse_easing': 'ease_in_out',
                'reveal': 'all',
                'stagger_ms': 0,
                'expandable_slots': ['b'],
                'screens': [
                    {
                        'id': 'a',
                        'label': 'Фотография',
                        'cue': 1,
                        'content_type': 'image',
                        'image_url': photo_url,
                        'image_fit': 'cover',
                        'text': _screen_text('Снимок местности'),
                    },
                    {
                        'id': 'b',
                        'label': 'Карта',
                        'cue': 2,
                        'loop': True,
                        'content_type': 'stage',
                        'stage_id': map_stage['id'],
                        'text': _screen_text('Живая карта'),
                    },
                ],
            }],
            'active_preset_id': PRESET_ID,
        })
        sequence = [
            _seq_stage(intro['id'], enter='fade'),
            _seq_mosaic(
                mosaic_action='show_grid',
                duration_ms=GRID_MS,
                enter='fade',
                enter_ms=700,
            ),
            _seq_mosaic(
                mosaic_action='expand',
                slot='b',
                duration_ms=EXPAND_MS,
                expand_animation='cover',
                enter_ms=700,
            ),
            _seq_mosaic(
                mosaic_action='collapse',
                duration_ms=COLLAPSE_MS,
                exit_effect='fade',
                exit_ms=500,
            ),
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
            mosaic_data=mosaic,
        )
        if make_default:
            clear_other_default_scenarios(scenario)

        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, '
            f'этапов={len(stages_data)}, блоков программы={len(sequence)}). '
            f'Раскладка 1x2, наезд экрана B. '
            f'Запуск: Демонстрация → «{SCENARIO_TITLE}».'
        ))
        self.stdout.write(
            f'  объекты на карте={len(target_ids)}, фото={photo_url}, '
            f'default={make_default}'
        )
