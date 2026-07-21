"""Проверка успешной миграции палитр маркеров (0052)."""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.utils import ProgrammingError

from formular.models import Country, MarkerColorPalette


class Command(BaseCommand):
    help = 'Проверяет миграцию formular.0052 (MarkerColorPalette, Country.marker_palette).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-palettes',
            type=int,
            default=1,
            help='Минимум записей в MarkerColorPalette (по умолчанию 1, для штатной миграции — 5).',
        )
        parser.add_argument(
            '--expect-seed-palettes',
            action='store_true',
            help='Требовать наличие стандартных палитр «Синий», «Красный» и т.д. после data-migration.',
        )

    def handle(self, *args, **options):
        min_palettes = options['min_palettes']
        expect_seed = options['expect_seed_palettes']
        errors = []

        if not self._migration_applied('0052_marker_color_palette'):
            errors.append(
                'Миграция formular.0052_marker_color_palette не применена. '
                'Выполните: python manage.py migrate formular'
            )

        if self._column_exists('formular_country', 'color'):
            errors.append(
                'В таблице formular_country всё ещё есть столбец color — миграция 0052 не завершена.'
            )

        if not self._column_exists('formular_country', 'marker_palette_id'):
            errors.append(
                'Нет столбца marker_palette_id у formular_country — миграция 0052 не применена.'
            )

        palette_count = MarkerColorPalette.objects.count()
        if palette_count < min_palettes:
            errors.append(
                f'MarkerColorPalette: записей {palette_count}, ожидалось не меньше {min_palettes}.'
            )

        if expect_seed:
            for title in ('Синий', 'Зелёный', 'Красный', 'Жёлтый', 'Морской'):
                if not MarkerColorPalette.objects.filter(title=title).exists():
                    errors.append(f'Отсутствует стандартная палитра «{title}».')

        countries_total = Country.objects.count()
        countries_without = Country.objects.filter(marker_palette__isnull=True).count()
        if countries_without:
            errors.append(
                f'Стран без палитры: {countries_without} из {countries_total}. '
                'Назначьте marker_palette в админке или повторите migrate.'
            )

        if errors:
            for msg in errors:
                self.stderr.write(self.style.ERROR(msg))
            raise CommandError(f'Проверка не пройдена ({len(errors)} проблем).')

        self.stdout.write(self.style.SUCCESS('Проверка палитр маркеров: OK'))
        self.stdout.write(f'  Палитр: {palette_count}')
        self.stdout.write(f'  Стран: {countries_total}, все с marker_palette')

    def _migration_applied(self, name_suffix):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1 FROM django_migrations
                WHERE app = 'formular' AND name = %s
                LIMIT 1
                """,
                [name_suffix],
            )
            return cursor.fetchone() is not None

    def _column_exists(self, table, column):
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = %s AND column_name = %s
                    LIMIT 1
                    """,
                    [table, column],
                )
                return cursor.fetchone() is not None
        except ProgrammingError:
            return False
