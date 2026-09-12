"""
Тестовая демонстрация художественного варианта «Полноэкранное видео».

Использование:
  python manage.py seed_video_demo_scenario
  python manage.py seed_video_demo_scenario --replace
  python manage.py seed_video_demo_scenario --replace --default
"""

from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.demo_scenario_utils import (
    clear_other_default_scenarios,
    normalize_scenario_tableau,
    replace_demo_scenario_library,
)
from formular.models import DemoMosaicMedia, DemoScenario


SCENARIO_TITLE = 'Полноэкранное видео (тест)'
PRESET_ID = 'fullscreen-video-test'
SCENE_DURATION_MS = 18_000
ASSET_DIR = Path(__file__).resolve().parents[2] / 'demo_assets' / 'fullscreen_video'
VIDEO_NAME = 'vidosik.mp4'
SOURCE_NAME = 'видосик.mp4'

DESCRIPTION = (
    'Тестовая демонстрация художественного варианта «Полноэкранное видео»: '
    'ролик на весь экран, карта скрыта.'
)


def resolve_video_path(explicit=None):
    if explicit:
        path = Path(explicit)
        if path.is_file():
            return path
        raise CommandError(f'Не найден видеофайл: {path}')

    bundled = ASSET_DIR / VIDEO_NAME
    if bundled.is_file():
        return bundled

    command_file = Path(__file__).resolve()
    candidates = [
        command_file.parents[4] / SOURCE_NAME,
        command_file.parents[3].parent / SOURCE_NAME,
        Path.cwd() / SOURCE_NAME,
        Path.cwd() / VIDEO_NAME,
    ]
    for path in candidates:
        try:
            if path.is_file():
                return path
        except OSError:
            continue
    raise CommandError(
        f'Не найден видеофайл «{SOURCE_NAME}». '
        f'Ожидался {bundled} или файл в корне репозитория.'
    )


def _save_video(path):
    media = DemoMosaicMedia()
    with path.open('rb') as stream:
        media.video.save(VIDEO_NAME, File(stream, name=VIDEO_NAME), save=True)
    return media.video.url, str(media.id)


class Command(BaseCommand):
    help = 'Создаёт тестовый сценарий «Полноэкранное видео»'

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true')
        parser.add_argument('--default', action='store_true')
        parser.add_argument(
            '--video',
            help='Путь к MP4/WebM вместо встроенного видосик.mp4',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        existing = DemoScenario.objects.filter(title=SCENARIO_TITLE).first()
        if existing and not options['replace']:
            self.stdout.write(self.style.WARNING(
                f'Сценарий «{existing.title}» уже есть (id={existing.id}). '
                'Запустите команду с --replace.'
            ))
            return

        video_path = resolve_video_path(options.get('video'))
        video_url, video_media_id = _save_video(video_path)
        tableau = normalize_scenario_tableau({
            'blocks': [],
            'presets': [{
                'id': PRESET_ID,
                'title': 'Полноэкранное видео',
                'variant': 'video',
                'video': {
                    'video_url': video_url,
                    'video_media_id': video_media_id,
                    'object_fit': 'cover',
                    'loop': True,
                },
                'caption': {
                    'content': 'Полноэкранное видео',
                    'x': 50,
                    'y': 6,
                    'font_size': 22,
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
            f'видео={video_url}, is_default={scenario.is_default}).'
        ))
        self.stdout.write(
            f'Откройте: Инструменты → Настроить демонстрацию… → «{SCENARIO_TITLE}» '
            '→ Воспроизвести.'
        )
