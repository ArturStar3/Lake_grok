# Медиа для блоков художественного режима + обновление help_text tableau

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('formular', '0062_demo_tableau'),
    ]

    operations = [
        migrations.AlterField(
            model_name='demoscenario',
            name='tableau',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'blocks[{id,title,width,height,elements}], '
                    'presets[{id,title,stage_id,tilt,placements,arrows}], active_preset_id'
                ),
                verbose_name='Художественный режим (JSON)',
            ),
        ),
        migrations.CreateModel(
            name='DemoTableauMedia',
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
                    'image',
                    models.ImageField(upload_to='demo_tableau/', verbose_name='Изображение'),
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
                        related_name='demo_tableau_media',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Автор',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Медиа художественного режима',
                'verbose_name_plural': 'Медиа художественного режима',
                'ordering': ['-created_at'],
            },
        ),
    ]
