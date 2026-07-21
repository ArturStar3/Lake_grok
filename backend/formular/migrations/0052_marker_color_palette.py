# Marker color palettes and Country.marker_palette (replaces Country.color)

from django.db import migrations, models
import django.db.models.deletion


PALETTE_PRESETS = {
    'blue': {
        'title': 'Синий',
        'color_first': '#008DD2',
        'color_second': '#FEFEFE',
        'color_third': '#00A0E3',
        'color_forth': '#A2D9F7',
    },
    'green': {
        'title': 'Зелёный',
        'color_first': '#0e970e',
        'color_second': '#FEFEFE',
        'color_third': '#0bc214',
        'color_forth': '#a2f7bc',
    },
    'red': {
        'title': 'Красный',
        'color_first': '#970e0e',
        'color_second': '#FEFEFE',
        'color_third': '#c20b0b',
        'color_forth': '#f7baa2',
    },
    'yellow': {
        'title': 'Жёлтый',
        'color_first': '#8e970e',
        'color_second': '#FEFEFE',
        'color_third': '#c2bf0b',
        'color_forth': '#f7f1a2',
    },
    'marine': {
        'title': 'Морской',
        'color_first': '#0077BE',
        'color_second': '#5aad73',
        'color_third': '#35a5e6',
        'color_forth': '#95d3f7',
    },
}


def seed_palettes_and_assign_countries(apps, schema_editor):
    MarkerColorPalette = apps.get_model('formular', 'MarkerColorPalette')
    Country = apps.get_model('formular', 'Country')

    palette_by_key = {}
    for key, spec in PALETTE_PRESETS.items():
        obj, _ = MarkerColorPalette.objects.get_or_create(
            title=spec['title'],
            defaults={
                'color_first': spec['color_first'],
                'color_second': spec['color_second'],
                'color_third': spec['color_third'],
                'color_forth': spec['color_forth'],
            },
        )
        palette_by_key[key] = obj

    default_palette = palette_by_key['blue']

    for country in Country.objects.all():
        old_color = getattr(country, 'color', None) or 'blue'
        palette = palette_by_key.get(old_color, default_palette)
        country.marker_palette_id = palette.pk
        country.save(update_fields=['marker_palette_id'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0051_map_display_settings_target_vulnerability'),
    ]

    operations = [
        migrations.CreateModel(
            name='MarkerColorPalette',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=100, unique=True, verbose_name='Название')),
                ('color_first', models.CharField(max_length=7, verbose_name='Цвет 1 (first)')),
                ('color_second', models.CharField(max_length=7, verbose_name='Цвет 2 (second)')),
                ('color_third', models.CharField(max_length=7, verbose_name='Цвет 3 (third)')),
                ('color_forth', models.CharField(max_length=7, verbose_name='Цвет 4 (forth)')),
            ],
            options={
                'verbose_name': 'Палитра маркера',
                'verbose_name_plural': 'Палитры маркеров',
                'ordering': ['title'],
            },
        ),
        migrations.AddField(
            model_name='country',
            name='marker_palette',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='countries',
                to='formular.markercolorpalette',
                verbose_name='Палитра маркера',
            ),
        ),
        migrations.RunPython(seed_palettes_and_assign_countries, noop_reverse),
        migrations.RemoveField(
            model_name='country',
            name='color',
        ),
        migrations.AlterField(
            model_name='country',
            name='marker_palette',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='countries',
                to='formular.markercolorpalette',
                verbose_name='Палитра маркера',
            ),
        ),
    ]
