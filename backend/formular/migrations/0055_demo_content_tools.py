# Generated for demo tools: formular and country dossiers

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0054_demo_scenarios'),
    ]

    operations = [
        migrations.AlterField(
            model_name='demoscenariostep',
            name='tool',
            field=models.CharField(
                choices=[
                    ('camera', 'Камера'),
                    ('objects', 'Объекты'),
                    ('events', 'События'),
                    ('zones', 'Зоны действия'),
                    ('inundation', 'Зоны затопления'),
                    ('situations', 'Оперативная обстановка'),
                    ('layers', 'Слои карты'),
                    ('formular', 'Формуляр объекта'),
                    ('country', 'Справка по стране'),
                ],
                default='camera',
                max_length=20,
                verbose_name='Инструмент',
            ),
        ),
        migrations.AlterField(
            model_name='demoscenariostep',
            name='selection',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='target_ids, event_ids, situation_ids, zone_leaves, overlay_layer_ids, country_isos',
                verbose_name='Выбранные элементы (JSON)',
            ),
        ),
    ]
