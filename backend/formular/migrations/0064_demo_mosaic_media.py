# Видео для слотов мультиэкрана + help_text mosaic/tableau

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('formular', '0063_demo_tableau_media'),
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
                    'content_type, video_url}]}], active_preset_id'
                ),
                verbose_name='Мультиэкран (JSON)',
            ),
        ),
        migrations.AlterField(
            model_name='demoscenario',
            name='tableau',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'blocks[{id,title,width,height,elements}], '
                    'presets[{id,title,variant,stage_id,tilt,gallery,placements,arrows}], '
                    'active_preset_id'
                ),
                verbose_name='Художественный режим (JSON)',
            ),
        ),
        migrations.CreateModel(
            name='DemoMosaicMedia',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        verbose_name='Уникальный идентификатор',
                    ),
                ),
                (
                    'video',
                    models.FileField(upload_to='demo_mosaic/', verbose_name='Видео'),
                ),
                (
                    'created_at',
                    models.DateTimeField(auto_now_add=True, verbose_name='Создано'),
                ),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='demo_mosaic_media',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Автор',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Видео мультиэкрана',
                'verbose_name_plural': 'Видео мультиэкрана',
                'ordering': ['-created_at'],
            },
        ),
    ]
