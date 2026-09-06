# Художественный режим демонстрации: библиотека пресетов на сценарии

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0061_demo_stage_step_order_constraint'),
    ]

    operations = [
        migrations.AddField(
            model_name='demoscenario',
            name='tableau',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='presets[{id, title, stage_id, tilt, cards[{id, title, items, x, y, target_ids}]}], active_preset_id',
                verbose_name='Художественный режим (JSON)',
            ),
        ),
    ]
