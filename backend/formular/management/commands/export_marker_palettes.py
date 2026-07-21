"""Экспорт палитр маркеров в JSON (резервная копия / аудит)."""

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from formular.models import Country, MarkerColorPalette


class Command(BaseCommand):
    help = 'Экспортирует MarkerColorPalette и привязки Country → palette в JSON-файл.'

    def add_arguments(self, parser):
        parser.add_argument(
            '-o',
            '--output',
            default='marker_palettes_export.json',
            help='Путь к выходному JSON (по умолчанию marker_palettes_export.json).',
        )

    def handle(self, *args, **options):
        out_path = Path(options['output'])
        palettes = list(
            MarkerColorPalette.objects.order_by('id').values(
                'id',
                'title',
                'color_first',
                'color_second',
                'color_third',
                'color_forth',
            )
        )
        countries = list(
            Country.objects.select_related('marker_palette')
            .order_by('id')
            .values('id', 'title', 'iso_code', 'marker_palette_id')
        )
        payload = {
            'palettes': palettes,
            'countries': countries,
        }
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        self.stdout.write(self.style.SUCCESS(f'Экспорт: {out_path.resolve()}'))
        self.stdout.write(f'  Палитр: {len(palettes)}, стран: {len(countries)}')
