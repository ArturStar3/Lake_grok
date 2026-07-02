from pathlib import Path

from django.core.management.base import BaseCommand

from equipment.catalog.loader import write_catalog_fixture


class Command(BaseCommand):
    help = (
        'Генерирует catalog.json и manifest.json из data.py '
        '(без БД и без изображений) для оффлайн-импорта'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='equipment/catalog/fixtures',
            help='Каталог для catalog.json и manifest.json',
        )
        parser.add_argument(
            '--include-images',
            action='store_true',
            help='Включить метаданные изображений в catalog.json (файлы не копируются)',
        )

    def handle(self, *args, **options):
        output = Path(options['output'])
        if not output.is_absolute():
            from django.conf import settings
            output = Path(settings.BASE_DIR) / output

        path = write_catalog_fixture(output, include_images=options['include_images'])
        manifest = path / 'manifest.json'
        self.stdout.write(self.style.SUCCESS(f'Фикстура записана: {path}'))
        self.stdout.write(f'  catalog:  {path / "catalog.json"}')
        self.stdout.write(f'  manifest: {manifest}')
