from pathlib import Path

from django.core.management.base import BaseCommand

from equipment.catalog.loader import export_equipment_catalog


class Command(BaseCommand):
    help = 'Экспорт каталога вооружения из БД в bundle для оффлайн-переноса'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='equipment/catalog/bundle',
            help='Каталог для manifest.json и catalog.json',
        )
        parser.add_argument(
            '--include-images',
            action='store_true',
            help='Скопировать media/equipment/ в bundle (по умолчанию только данные)',
        )

    def handle(self, *args, **options):
        output = Path(options['output'])
        if not output.is_absolute():
            from django.conf import settings
            output = Path(settings.BASE_DIR) / output

        path = export_equipment_catalog(output, include_images=options['include_images'])
        manifest = path / 'manifest.json'
        self.stdout.write(self.style.SUCCESS(f'Экспорт завершён: {path}'))
        self.stdout.write(f'  manifest: {manifest}')
        self.stdout.write(f'  catalog:  {path / "catalog.json"}')
        if options['include_images']:
            self.stdout.write(f'  media:    {path / "media" / "equipment"}')
