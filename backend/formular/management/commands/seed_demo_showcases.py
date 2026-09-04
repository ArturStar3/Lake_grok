"""
Создаёт набор показательных сценариев демонстрации.

  1. Три конструктора (витрина) — этапы, 2+3, программа с переходами.
  2. Мультиэкран: обзор возможностей — короткий показ сетки 2+3.
  3. Обзор возможностей карты (тест) — инструменты карты по шагам.

Использование:
  python manage.py seed_demo_showcases --replace
  python manage.py seed_demo_showcases --replace --default-constructors
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Создаёт витринные сценарии трёх конструкторов, мультиэкрана и инструментов карты'

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
        call_command('seed_sample_demo_scenario', **kwargs)
        call_command(
            'seed_constructors_demo_scenario',
            **kwargs,
            default=bool(options['default_constructors']),
        )
        self.stdout.write(self.style.SUCCESS(
            'Готово. В конструкторе три сценария: «Три конструктора (витрина)», '
            '«Мультиэкран: обзор возможностей», «Обзор возможностей карты (тест)».'
        ))
