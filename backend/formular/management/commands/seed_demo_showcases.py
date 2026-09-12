"""
Создаёт набор показательных сценариев демонстрации.

  1. Три конструктора (витрина) — этапы, 2+3, программа с переходами.
  2. Мультиэкран: обзор возможностей — короткий показ сетки 2+3.
  3. Мультиэкран: фотография и карта (тест) — два экрана и наезд правого.
  4. Художественный: планшетный обзор — наклон карты и карточки.
  5. Галерея: из объекта (тест) — разворот кадра из маркера, с картой и без.
  6. Все возможности карты (тест) — планшет, сетка 2+3 и развороты слоёв.
  7. Сканирование документов: конфликт в Украине — DOCX и 10 изображений.
  8. Обмен информацией (тест) — три узла сети с логотипами.
  9. Полноэкранное видео (тест) — ролик на весь экран.
  10. Обзор возможностей карты (тест) — инструменты карты по шагам.

Использование:
  python manage.py seed_demo_showcases --replace
  python manage.py seed_demo_showcases --replace --default-constructors
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        'Создаёт витринные сценарии конструкторов, мультиэкрана, '
        'художественного режима, обмена информацией и инструментов карты'
    )

    def add_arguments(self, parser):
        parser.add_argument('--replace', action='store_true')
        parser.add_argument(
            '--default-constructors',
            action='store_true',
            help='Поставить витрину трёх конструкторов сценарием по умолчанию',
        )

    def handle(self, *args, **options):
        replace = bool(options['replace'])
        kwargs = {'replace': True} if replace else {}
        call_command('seed_mosaic_demo_scenario', **kwargs)
        call_command('seed_photo_map_demo_scenario', **kwargs)
        call_command('seed_tableau_demo_scenario', **kwargs)
        call_command('seed_gallery_demo_scenario', **kwargs)
        call_command('seed_map_capabilities_demo_scenario', **kwargs)
        call_command('seed_scanner_demo_scenario', **kwargs)
        call_command('seed_network_demo_scenario', **kwargs)
        call_command('seed_video_demo_scenario', **kwargs)
        call_command('seed_sample_demo_scenario', **kwargs)
        call_command(
            'seed_constructors_demo_scenario',
            **kwargs,
            default=bool(options['default_constructors']),
        )
        self.stdout.write(self.style.SUCCESS(
            'Готово. В конструкторе сценарии: «Три конструктора (витрина)», '
            '«Мультиэкран: обзор возможностей», '
            '«Мультиэкран: фотография и карта (тест)», '
            '«Художественный: планшетный обзор», '
            '«Галерея: из объекта (тест)», '
            '«Все возможности карты (тест)», '
            '«Сканирование документов: конфликт в Украине», '
            '«Обмен информацией (тест)», '
            '«Полноэкранное видео (тест)», '
            '«Обзор возможностей карты (тест)».'
        ))
