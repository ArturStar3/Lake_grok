"""Создаёт тестовую демонстрацию художественного варианта «Обмен информацией»."""

from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image, ImageDraw, ImageFont

from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    normalize_scenario_tableau,
    replace_demo_scenario_library,
)
from formular.models import DemoScenario, DemoTableauMedia


SCENARIO_TITLE = 'Обмен информацией (тест)'
PRESET_ID = 'network-exchange-test'
SCENE_DURATION_MS = 20_000
DESCRIPTION = (
    'Тестовая демонстрация художественного варианта «Обмен информацией»: '
    'три узла с логотипами связаны двунаправленным потоком данных.'
)

NODES = (
    ('Штаб', 'ШТ', (16, 42, 52), (114, 237, 208)),
    ('Поле', 'ПЛ', (14, 36, 64), (85, 185, 239)),
    ('Аналитика', 'АН', (28, 32, 62), (186, 176, 255)),
)


def _load_font(size):
    for name in ('arial.ttf', 'Arial.ttf', 'DejaVuSans.ttf', 'segoeui.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _text_size(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def _make_logo_png(initials, bg, accent):
    size = 512
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((18, 18, size - 18, size - 18), fill=(*bg, 245), outline=accent, width=14)
    draw.ellipse((70, 70, size - 70, size - 70), outline=(*accent, 140), width=3)
    font = _load_font(128)
    width, height = _text_size(draw, initials, font)
    draw.text(
        ((size - width) / 2, (size - height) / 2 - 10),
        initials,
        fill=(245, 252, 250),
        font=font,
    )
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.read()


def _save_logo(title, initials, bg, accent, index):
    filename = f'network-node-{index + 1}.png'
    media = DemoTableauMedia()
    media.image.save(
        filename,
        ContentFile(_make_logo_png(initials, bg, accent), name=filename),
        save=True,
    )
    return {'src': media.image.url, 'title': title}


class Command(BaseCommand):
    help = 'Создаёт тестовый сценарий «Обмен информацией» с тремя узлами сети'

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true')
        parser.add_argument('--default', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        existing = DemoScenario.objects.filter(title=SCENARIO_TITLE).first()
        if existing and not options['replace']:
            self.stdout.write(self.style.WARNING(
                f'Сценарий «{existing.title}» уже есть (id={existing.id}). '
                'Запустите команду с --replace.'
            ))
            return

        logos = [
            _save_logo(title, initials, bg, accent, index)
            for index, (title, initials, bg, accent) in enumerate(NODES)
        ]
        tableau = normalize_scenario_tableau({
            'blocks': [],
            'presets': [{
                'id': PRESET_ID,
                'title': 'Обмен информацией',
                'variant': 'network',
                'network': {'logos': logos},
            }],
            'active_preset_id': PRESET_ID,
        })
        sequence = [{
            'type': 'tableau',
            'preset_id': PRESET_ID,
            'duration_ms': SCENE_DURATION_MS,
            'wait_for_presenter': False,
            'enter': {'effect': 'fade', 'duration_ms': 600},
            'exit': {'effect': 'fade', 'duration_ms': 450},
        }]

        make_default = bool(options['default'])
        if existing:
            scenario = existing
            scenario.description = DESCRIPTION
            scenario.loop = False
            scenario.auto_advance = True
            scenario.is_default = make_default
            scenario.default_step_duration_ms = SCENE_DURATION_MS
            scenario.save()
        else:
            scenario = DemoScenario.objects.create(
                title=SCENARIO_TITLE,
                description=DESCRIPTION,
                loop=False,
                auto_advance=True,
                is_default=make_default,
                default_step_duration_ms=SCENE_DURATION_MS,
            )

        replace_demo_scenario_library(
            scenario,
            [],
            sequence_data=sequence,
            tableau_data=tableau,
        )
        if make_default:
            clear_other_default_scenarios(scenario)

        self.stdout.write(self.style.SUCCESS(
            f'Сценарий «{scenario.title}» сохранён (id={scenario.id}, '
            f'узлов={len(logos)}, is_default={scenario.is_default}).'
        ))
        self.stdout.write(
            f'Откройте: Инструменты → Настроить демонстрацию… → «{SCENARIO_TITLE}» '
            '→ Воспроизвести.'
        )
