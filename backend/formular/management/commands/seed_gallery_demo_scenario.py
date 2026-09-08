"""
Тестовый сценарий галереи: вход «из объекта» на карте и без карты.

Программа:
  1. Интро — общий план.
  2. Галерея на карте: контур с хвостом растёт от маркера к кадру.
  3. Та же галерея без карты: тёмный градиент сцены, без территорий стран.
  4. Финал.

Использование:
  python manage.py seed_gallery_demo_scenario
  python manage.py seed_gallery_demo_scenario --replace
  python manage.py seed_gallery_demo_scenario --replace --default
"""

import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from PIL import Image, ImageDraw, ImageFont

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
    DemoTableauMedia,
    Target,
)


SCENARIO_TITLE = 'Галерея: из объекта (тест)'
LEGACY_TITLES = ()
STEP_MS = 4000
CAM_MS = 1800
GALLERY_MS = 14000
PRESET_MAP_ID = 'gallery-from-object-map'
PRESET_NOMAP_ID = 'gallery-from-object-nomap'

DESCRIPTION = (
    'Тестовая демонстрация галереи: кадры разворачиваются из объектов на карте '
    '(контур с хвостом), затем тот же показ без карты — тёмный градиент сцены '
    'без подсветки территорий государств.'
)

CARD_COLORS = (
    ((18, 36, 68), (47, 128, 237), 'Сводка'),
    ((16, 48, 52), (45, 212, 191), 'Обзор'),
    ((48, 32, 16), (251, 191, 36), 'Деталь'),
    ((42, 18, 36), (244, 114, 182), 'Контекст'),
)

REST_LAYOUT = (
    {'x': 6, 'y': 12, 'w': 30, 'h': 40},
    {'x': 40, 'y': 8, 'w': 26, 'h': 36},
    {'x': 68, 'y': 14, 'w': 26, 'h': 38},
    {'x': 22, 'y': 56, 'w': 34, 'h': 34},
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
            'font_size': 34,
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


def _seq_tableau(preset_id):
    return {
        'type': 'tableau',
        'preset_id': preset_id,
        'duration_ms': GALLERY_MS,
        'wait_for_presenter': False,
        'enter': {'effect': 'fade', 'duration_ms': 600},
        'exit': {'effect': 'fade', 'duration_ms': 450},
    }


def _pick_targets(limit=4):
    kz = Country.objects.filter(iso_code='KZ').first()
    qs = Target.objects.none()
    for fragment in ('РЛС Астана', 'РЛС Алматы', 'Астана', 'Алматы'):
        qs = qs | Target.objects.filter(title__icontains=fragment)
    found = list(qs.distinct().order_by('title')[:limit])
    if len(found) < limit and kz:
        extra = list(
            Target.objects.filter(country=kz)
            .exclude(id__in=[item.id for item in found])
            .order_by('title')[: limit - len(found)]
        )
        found.extend(extra)
    if len(found) < 2:
        found = list(Target.objects.order_by('title')[:limit])
    return found[:limit]


def _center_of(targets):
    lats = [item.lat for item in targets if item.lat is not None]
    lngs = [item.lng for item in targets if item.lng is not None]
    if not lats or not lngs:
        return 46.5, 70.0, 5.0
    lat = sum(lats) / len(lats)
    lng = sum(lngs) / len(lngs)
    spread = max(max(lats) - min(lats), max(lngs) - min(lngs), 0.4)
    zoom = 6.2 if spread < 4 else 5.2 if spread < 12 else 4.4
    return lat, lng, zoom


def _load_font(size):
    for name in ('arial.ttf', 'Arial.ttf', 'DejaVuSans.ttf', 'segoeui.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _make_card_png(title, bg, accent):
    width, height = 1280, 800
    image = Image.new('RGB', (width, height), bg)
    draw = ImageDraw.Draw(image)
    for index in range(8):
        alpha = 18 + index * 6
        color = tuple(min(255, int(c + alpha)) for c in accent)
        pad = 40 + index * 28
        draw.ellipse(
            (-pad, -pad, width * 0.7 + pad, height * 0.55 + pad),
            outline=color,
            width=3,
        )
    draw.rectangle((0, height - 150, width, height), fill=(11, 18, 32))
    title_font = _load_font(54)
    hint_font = _load_font(28)
    label = (title or 'Кадр')[:42]
    draw.text((48, height - 122), label, fill=(248, 250, 252), font=title_font)
    draw.text(
        (48, height - 58),
        'Галерея · вход из объекта',
        fill=tuple(min(255, c + 40) for c in accent),
        font=hint_font,
    )
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.read()


def _save_gallery_media(title, bg, accent, index):
    filename = f'gallery-from-object-{index + 1}.png'
    media = DemoTableauMedia()
    media.image.save(
        filename,
        ContentFile(_make_card_png(title, bg, accent), name=filename),
        save=True,
    )
    return media.image.url


class Command(BaseCommand):
    help = (
        'Создаёт тестовый сценарий галереи: разворот кадра из объекта '
        'на карте и без карты'
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

        targets = _pick_targets(4)
        if len(targets) < 2:
            raise CommandError(
                'Нужно хотя бы два объекта на карте. '
                'Сначала заполните цели (seed_test_targets / seed_qa_data).'
            )

        lat, lng, zoom = _center_of(targets)
        target_ids = [str(item.id) for item in targets]
        images = []
        for index, target in enumerate(targets):
            bg, accent, fallback = CARD_COLORS[index % len(CARD_COLORS)]
            title = target.title or fallback
            images.append({
                'id': f'gimg-from-object-{index + 1}',
                'src': _save_gallery_media(title, bg, accent, index),
                'title': title[:120],
                'target_id': str(target.id),
                'rest': REST_LAYOUT[index % len(REST_LAYOUT)],
            })

        intro = _stage('Интро', [
            _step(
                title='Общий план',
                tool=DemoStepTool.CAMERA,
                camera=_fly(lat, lng, max(zoom - 1.2, 3.5)),
                duration_ms=2800,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Галерея: разворот из объекта'),
            ),
        ])

        gallery_stage = _stage('Объекты галереи', [
            _step(
                title='Объекты кадра',
                tool=DemoStepTool.OBJECTS,
                camera=_fly(lat, lng, zoom),
                selection={'target_ids': target_ids},
                duration_ms=STEP_MS,
            ),
        ])

        finale = _stage('Финал', [
            _step(
                title='Финал',
                tool=DemoStepTool.CAMERA,
                camera=_fly(lat, lng, max(zoom - 1.2, 3.5)),
                duration_ms=2400,
            ),
            _step(
                title='',
                tool=DemoStepTool.TEXT,
                start_mode=DemoStepStartMode.WITH_PREVIOUS,
                hold_previous=True,
                text=_caption('Галерея без карты и с картой'),
            ),
        ])

        gallery_common = {
            'stagger_ms': 280,
            'enter_ms': 900,
            'hold_ms': 1000,
            'settle_ms': 480,
            'exit_ms': 420,
            'enter_effect': 'from_object',
            'exit_effect': 'fade_scale',
            'settle': 'free',
            'images': images,
        }

        camera = {
            'mode': 'fly_to',
            'lat': lat,
            'lng': lng,
            'zoom': zoom,
            'duration_ms': CAM_MS,
        }

        tableau = normalize_scenario_tableau({
            'blocks': [],
            'presets': [
                {
                    'id': PRESET_MAP_ID,
                    'title': 'Из объекта · карта',
                    'variant': 'gallery',
                    'stage_id': gallery_stage['id'],
                    'gallery': {
                        **gallery_common,
                        'show_map': True,
                        'images': [dict(item, rest=dict(item['rest'])) for item in images],
                    },
                    'caption': {
                        'content': 'Разворот из объекта на карте',
                        'x': 50,
                        'y': 4,
                    },
                    'camera': camera,
                },
                {
                    'id': PRESET_NOMAP_ID,
                    'title': 'Из объекта · без карты',
                    'variant': 'gallery',
                    'stage_id': gallery_stage['id'],
                    'gallery': {
                        **gallery_common,
                        'show_map': False,
                        'images': [dict(item, rest=dict(item['rest'])) for item in images],
                    },
                    'caption': {
                        'content': 'Без карты: градиент сцены',
                        'x': 50,
                        'y': 4,
                    },
                    'camera': camera,
                },
            ],
            'active_preset_id': PRESET_MAP_ID,
        })

        stages_data = [intro, gallery_stage, finale]
        sequence = [
            _seq_stage(intro['id'], enter='fade'),
            _seq_tableau(PRESET_MAP_ID),
            _seq_tableau(PRESET_NOMAP_ID),
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

        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, '
            f'кадров={len(images)}, объектов={len(target_ids)}, '
            f'is_default={scenario.is_default}).'
        ))
        self.stdout.write(
            'Откройте: Инструменты → Настроить демонстрацию… → '
            f'«{SCENARIO_TITLE}» → Воспроизвести.'
        )
