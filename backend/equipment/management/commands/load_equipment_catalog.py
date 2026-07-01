from django.core.management.base import BaseCommand

from equipment.catalog.loader import (
    copy_local_seed_images,
    download_catalog_images,
    load_equipment_catalog,
)


class Command(BaseCommand):
    help = 'Загружает полный каталог вооружения (СНГ, NATO, EU, США) из catalog/data.py'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear-first',
            action='store_true',
            help='Очистить каталог вооружения перед загрузкой',
        )
        parser.add_argument(
            '--with-images',
            action='store_true',
            help='Прикрепить фото из equipment/catalog/images/ (если файлы есть)',
        )
        parser.add_argument(
            '--download-images',
            action='store_true',
            help='Скачать недостающие фото из Wikimedia Commons (нужен интернет)',
        )
        parser.add_argument(
            '--force-download',
            action='store_true',
            help='Перекачать все изображения заново',
        )

    def handle(self, *args, **options):
        attach_images = options['with_images'] or options['download_images']

        if attach_images:
            copied = copy_local_seed_images(stdout=self.stdout)
            if copied:
                self.stdout.write(f'Локальных изображений скопировано: {copied}')

        if options['download_images'] or options['force_download']:
            self.stdout.write('Загрузка изображений в equipment/catalog/images/ …')
            ok, failed = download_catalog_images(
                force=options['force_download'],
                stdout=self.stdout,
            )
            self.stdout.write(f'Изображений: успешно {ok}, ошибок {failed}')

        stats = load_equipment_catalog(
            clear_first=options['clear_first'],
            attach_images=attach_images,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Каталог загружен: образцов — {stats["equipment"]}, '
            f'категорий — {stats["categories"]}, '
            f'параметров — {stats["parameters"]}, '
            f'изображений — {stats["images"]}'
        ))
