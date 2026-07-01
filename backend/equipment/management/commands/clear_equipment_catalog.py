from django.core.management.base import BaseCommand

from equipment.catalog.loader import clear_equipment_catalog


class Command(BaseCommand):
    help = (
        'Удаляет только данные каталога вооружения. '
        'Не затрагивает объекты карты, события, формуляры, страны и типы зон.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Подтвердить удаление без запроса',
        )
        parser.add_argument(
            '--keep-units',
            action='store_true',
            help='Не удалять единицы измерения (км, км/ч)',
        )

    def handle(self, *args, **options):
        if not options['yes']:
            self.stdout.write(self.style.WARNING(
                'Будут удалены: образцы техники, категории, параметры ТТХ, '
                'значения ТТХ, записи EquipmentImage в БД и media/equipment/.\n'
                'Связи TargetEquipment на объектах карты удалятся (CASCADE).\n'
                'НЕ затрагиваются: Target, события, формуляры, Country, ActionType, '
                'маркеры, catalog/images/ на диске.'
            ))
            confirm = input('Продолжить? [y/N]: ').strip().lower()
            if confirm not in ('y', 'yes', 'д', 'да'):
                self.stdout.write('Отменено.')
                return

        stats = clear_equipment_catalog(delete_orphan_units=not options['keep_units'])
        self.stdout.write(self.style.SUCCESS(
            f'Удалено: образцов — {stats["equipment"]}, '
            f'изображений — {stats["images"]}, '
            f'значений ТТХ — {stats["parameter_values"]}, '
            f'параметров — {stats["parameters"]}, '
            f'категорий — {stats["categories"]}, '
            f'единиц измерения — {stats["units"]}'
        ))
