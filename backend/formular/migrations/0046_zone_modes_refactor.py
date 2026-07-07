from django.db import migrations, models


def migrate_zone_modes(apps, schema_editor):
    ActionType = apps.get_model('formular', 'ActionType')
    ActionType.objects.filter(zone_mode='inundation').update(
        zone_mode='polygon',
        is_inundation_zone=True,
    )
    ActionType.objects.filter(title__startswith='Затопление —').update(
        is_inundation_zone=True,
        zone_mode='polygon',
    )
    ActionType.objects.exclude(zone_mode='los_radar').update(min_elevation_deg=None)


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0045_inundation_zones'),
    ]

    operations = [
        migrations.AddField(
            model_name='actiontype',
            name='is_inundation_zone',
            field=models.BooleanField(
                default=False,
                help_text='Тип относится к сценариям затопления',
                verbose_name='Зона затопления',
            ),
        ),
        migrations.AlterField(
            model_name='actiontype',
            name='min_elevation_deg',
            field=models.FloatField(
                blank=True,
                help_text='Для зоны с учётом рельефа: луч ниже этого угла считается заблокированным',
                null=True,
                verbose_name='Мин. угол места, °',
            ),
        ),
        migrations.AlterField(
            model_name='actiontype',
            name='zone_mode',
            field=models.CharField(
                choices=[
                    ('flat', 'Круг на плоскости'),
                    ('los_radar', 'Круг на плоскости с учетом рельефа'),
                    ('polygon', 'Полигон'),
                ],
                default='flat',
                max_length=20,
                verbose_name='Режим геометрии зоны',
            ),
        ),
        migrations.RunPython(migrate_zone_modes, migrations.RunPython.noop),
    ]
