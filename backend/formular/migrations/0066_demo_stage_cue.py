from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('formular', '0065_demo_mosaic_expand_stage'),
    ]

    operations = [
        migrations.AddField(
            model_name='demoscenariostage',
            name='cue',
            field=models.PositiveSmallIntegerField(
                blank=True,
                help_text='Цифра в углу экрана для докладчика (1–99). Пусто — не показывать.',
                null=True,
                verbose_name='Номер позиции',
            ),
        ),
        migrations.AlterField(
            model_name='demoscenario',
            name='mosaic',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'presets[{id, title, layout, reveal, screens[{id, label, cue, loop, stage_id, '
                    'expand_stage_id, content_type, video_url}]}], active_preset_id'
                ),
                verbose_name='Мультиэкран (JSON)',
            ),
        ),
    ]
