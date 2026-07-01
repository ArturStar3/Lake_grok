from django.core.management.base import BaseCommand

from equipment.catalog.loader import copy_local_seed_images, download_catalog_images


class Command(BaseCommand):
    help = 'Скачивает фото образцов из Wikimedia Commons в equipment/catalog/images/'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Перекачать все файлы',
        )
        parser.add_argument(
            '--delay',
            type=float,
            default=5.0,
            help='Пауза между запросами к Wikimedia (сек.)',
        )

    def handle(self, *args, **options):
        copied = copy_local_seed_images(stdout=self.stdout)
        if copied:
            self.stdout.write(f'Локальных изображений: {copied}')
        ok, failed = download_catalog_images(
            force=options['force'],
            stdout=self.stdout,
            delay_sec=options['delay'],
        )
        self.stdout.write(self.style.SUCCESS(f'Готово: {ok} файлов, ошибок: {failed}'))
