from pathlib import Path

from django.core.management.base import BaseCommand

from equipment.catalog.loader import import_equipment_catalog


class Command(BaseCommand):
    help = 'Импорт каталога вооружения из bundle или fixtures (оффлайн-машина)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            type=str,
            default='equipment/catalog/fixtures',
            help='Каталог с catalog.json (по умолчанию equipment/catalog/fixtures)',
        )
        parser.add_argument(
            '--no-clear',
            action='store_true',
            help='Не очищать каталог перед импортом',
        )
        parser.add_argument(
            '--with-images',
            action='store_true',
            help='Импортировать изображения из media/equipment/ (если есть в bundle)',
        )

    def handle(self, *args, **options):
        input_dir = Path(options['input'])
        if not input_dir.is_absolute():
            from django.conf import settings
            input_dir = Path(settings.BASE_DIR) / input_dir

        if not (input_dir / 'catalog.json').is_file():
            self.stderr.write(self.style.ERROR(f'Не найден catalog.json в {input_dir}'))
            return

        stats = import_equipment_catalog(
            input_dir,
            clear_first=not options['no_clear'],
            attach_images=options['with_images'],
        )
        self.stdout.write(self.style.SUCCESS(
            f'Импорт завершён: образцов — {stats["equipment"]}, '
            f'изображений — {stats["images"]}'
        ))
