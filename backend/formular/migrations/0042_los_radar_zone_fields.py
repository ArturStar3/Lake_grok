from django.db import migrations, models
import django.core.validators


def create_rls_action_type(apps, schema_editor):
    ActionType = apps.get_model('formular', 'ActionType')
    ActionType.objects.get_or_create(
        title='РЛС',
        defaults={
            'color': '#00ced1',
            'line_type': 'solid',
            'zone_mode': 'los_radar',
            'min_elevation_deg': 0.5,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0041_targettype_parent_order'),
    ]

    operations = [
        migrations.AddField(
            model_name='actiontype',
            name='zone_mode',
            field=models.CharField(
                choices=[('flat', 'Круг на плоскости'), ('los_radar', 'Покрытие РЛС (рельеф)')],
                default='flat',
                max_length=20,
                verbose_name='Режим геометрии зоны',
            ),
        ),
        migrations.AddField(
            model_name='actiontype',
            name='min_elevation_deg',
            field=models.FloatField(
                default=0.5,
                help_text='Для РЛС: луч ниже этого угла считается заблокированным рельефом',
                verbose_name='Мин. угол места, °',
            ),
        ),
        migrations.AddField(
            model_name='target',
            name='antenna_height_m',
            field=models.FloatField(
                default=10.0,
                help_text='Над уровнем земли в точке объекта (для расчёта покрытия РЛС)',
                validators=[django.core.validators.MinValueValidator(0.0, message='Высота не может быть отрицательной')],
                verbose_name='Высота антенны, м',
            ),
        ),
        migrations.AddField(
            model_name='targetaction',
            name='zone_geometry',
            field=models.JSONField(blank=True, default=None, null=True, verbose_name='Геометрия зоны (GeoJSON)'),
        ),
        migrations.AddField(
            model_name='targetaction',
            name='zone_geometry_computed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Зона рассчитана'),
        ),
        migrations.RunPython(create_rls_action_type, migrations.RunPython.noop),
    ]
