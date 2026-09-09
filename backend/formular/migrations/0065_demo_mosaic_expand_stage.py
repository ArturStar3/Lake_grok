from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('formular', '0064_demo_mosaic_media'),
    ]

    operations = [
        migrations.AlterField(
            model_name='demoscenario',
            name='mosaic',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'presets[{id, title, layout, reveal, screens[{id, label, loop, stage_id, '
                    'expand_stage_id, content_type, video_url}]}], active_preset_id'
                ),
                verbose_name='Мультиэкран (JSON)',
            ),
        ),
    ]
