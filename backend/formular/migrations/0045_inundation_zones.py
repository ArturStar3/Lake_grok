from django.db import migrations, models


def create_inundation_action_types(apps, schema_editor):
    ActionType = apps.get_model('formular', 'ActionType')
    defaults = [
        {
            'title': 'Затопление — нормальный уровень',
            'color': '#3498db',
            'line_type': 'dashed',
            'zone_mode': 'inundation',
        },
        {
            'title': 'Затопление — аварийный уровень',
            'color': '#e74c3c',
            'line_type': 'solid',
            'zone_mode': 'inundation',
        },
        {
            'title': 'Затопление — проектный максимум',
            'color': '#9b59b6',
            'line_type': 'dash_dot',
            'zone_mode': 'inundation',
        },
    ]
    for item in defaults:
        ActionType.objects.get_or_create(
            title=item['title'],
            defaults=item,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0044_person_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='target',
            name='crest_elevation_m',
            field=models.FloatField(
                blank=True,
                help_text='Для гидротехнических сооружений',
                null=True,
                verbose_name='Отметка гребня, м',
            ),
        ),
        migrations.AddField(
            model_name='target',
            name='max_pool_level_m',
            field=models.FloatField(
                blank=True,
                help_text='Проектный максимальный / аварийный уровень',
                null=True,
                verbose_name='ПМУ, м',
            ),
        ),
        migrations.AddField(
            model_name='target',
            name='normal_pool_level_m',
            field=models.FloatField(
                blank=True,
                help_text='Нормальный подпорный уровень',
                null=True,
                verbose_name='НПУ, м',
            ),
        ),
        migrations.AddField(
            model_name='targetaction',
            name='zone_metadata',
            field=models.JSONField(
                blank=True,
                default=None,
                help_text='Для затопления: water_level_m, scenario_label, notes',
                null=True,
                verbose_name='Метаданные сценария зоны',
            ),
        ),
        migrations.AlterField(
            model_name='actiontype',
            name='zone_mode',
            field=models.CharField(
                choices=[
                    ('flat', 'Круг на плоскости'),
                    ('los_radar', 'Покрытие РЛС (рельеф)'),
                    ('inundation', 'Зона затопления (полигон)'),
                ],
                default='flat',
                max_length=20,
                verbose_name='Режим геометрии зоны',
            ),
        ),
        migrations.RunPython(create_inundation_action_types, migrations.RunPython.noop),
    ]
