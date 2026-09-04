# Мультиэкран демонстрации: раскладка сценария и привязка этапа к слоту

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0056_demo_stages_and_text'),
    ]

    operations = [
        migrations.AddField(
            model_name='demoscenario',
            name='mosaic',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='enabled, layout, transition_ms, slots[{id, label}]',
                verbose_name='Мультиэкран (JSON)',
            ),
        ),
        migrations.AddField(
            model_name='demoscenariostep',
            name='mosaic',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='slot, loop, label — задаётся на первом шаге этапа (on_click)',
                verbose_name='Мультиэкран этапа (JSON)',
            ),
        ),
    ]
