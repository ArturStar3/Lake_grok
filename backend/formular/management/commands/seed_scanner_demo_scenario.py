"""Создаёт автономную демонстрацию сканирования документов."""

from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.demo_scanner import import_docx
from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    normalize_scenario_tableau,
    replace_demo_scenario_library,
)
from formular.models import DemoScenario, DemoTableauMedia


SCENARIO_TITLE = 'Сканирование документов: конфликт в Украине'
PRESET_ID = 'scanner-conflict-ukraine'
SCENE_DURATION_MS = 90_000
ASSET_DIR = Path(__file__).resolve().parents[2] / 'demo_assets' / 'scanner_conflict_ukraine'
DOCUMENT_NAME = 'conflict-in-ukraine-overview.docx'
IMAGE_TITLES = (
    'Городская инфраструктура',
    'Гуманитарный склад',
    'Резервное энергоснабжение',
    'Железнодорожное сообщение',
    'Сельское хозяйство',
    'Временный учебный класс',
    'Восстановление связи',
    'Защита культурного наследия',
    'Ремонт транспортной инфраструктуры',
    'Восстановление жилого квартала',
)

DESCRIPTION = (
    'Тестовая демонстрация: десять нейтральных тематических изображений проходят '
    'визуальное сканирование, а текст одностраничного DOCX последовательно '
    'формируется на итоговом листе.'
)


def _load_document():
    path = ASSET_DIR / DOCUMENT_NAME
    if not path.is_file():
        raise CommandError(f'Не найден демонстрационный документ: {path}')
    with path.open('rb') as stream:
        return import_docx(File(stream, name=DOCUMENT_NAME))


def _save_image(path):
    if not path.is_file():
        raise CommandError(f'Не найден демонстрационный файл: {path}')
    media = DemoTableauMedia()
    with path.open('rb') as stream:
        media.image.save(path.name, File(stream, name=path.name), save=True)
    return media.image.url


class Command(BaseCommand):
    help = 'Создаёт тестовый сценарий «Сканирование документов» с DOCX и 10 изображениями'

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

        document = _load_document()
        images = []
        for index, title in enumerate(IMAGE_TITLES, start=1):
            path = ASSET_DIR / f'source-{index:02d}.jpg'
            images.append({
                'src': _save_image(path),
                'title': title,
            })

        tableau = normalize_scenario_tableau({
            'blocks': [],
            'presets': [{
                'id': PRESET_ID,
                'title': 'Сканирование документов',
                'variant': 'scanner',
                'scanner': {
                    'images': images,
                    'document': document,
                    'effect': 'letters',
                    'scan_min_ms': 900,
                    'scan_max_ms': 1400,
                    'characters_per_second': 180,
                },
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
            f'изображений={len(images)}, документ={document["name"]}, '
            f'is_default={scenario.is_default}).'
        ))
        self.stdout.write(
            f'Откройте: Инструменты → Настроить демонстрацию… → «{SCENARIO_TITLE}» '
            '→ Воспроизвести.'
        )
