# Generated manually for map demonstration scenarios

import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('formular', '0053_rename_targetvulnerability_index'),
    ]

    operations = [
        migrations.CreateModel(
            name='DemoScenario',
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
                ('title', models.CharField(max_length=255, verbose_name='Название')),
                ('description', models.TextField(blank=True, default='', verbose_name='Описание')),
                (
                    'is_default',
                    models.BooleanField(
                        default=False,
                        help_text='Запускается кнопкой быстрого старта демонстрации',
                        verbose_name='Сценарий по умолчанию',
                    ),
                ),
                ('loop', models.BooleanField(default=True, verbose_name='Зацикливать показ')),
                (
                    'default_step_duration_ms',
                    models.PositiveIntegerField(
                        default=6000,
                        verbose_name='Длительность шага по умолчанию, мс',
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Дата изменения')),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='demo_scenarios_created',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Автор',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Сценарий демонстрации',
                'verbose_name_plural': 'Сценарии демонстрации',
                'ordering': ['title'],
            },
        ),
        migrations.CreateModel(
            name='DemoScenarioStep',
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
                ('order', models.PositiveIntegerField(default=0, verbose_name='Порядок')),
                (
                    'title',
                    models.CharField(blank=True, default='', max_length=255, verbose_name='Название шага'),
                ),
                (
                    'tool',
                    models.CharField(
                        choices=[
                            ('camera', 'Камера'),
                            ('objects', 'Объекты'),
                            ('events', 'События'),
                            ('zones', 'Зоны действия'),
                            ('inundation', 'Зоны затопления'),
                            ('situations', 'Оперативная обстановка'),
                            ('layers', 'Слои карты'),
                        ],
                        default='camera',
                        max_length=20,
                        verbose_name='Инструмент',
                    ),
                ),
                ('duration_ms', models.PositiveIntegerField(default=6000, verbose_name='Длительность, мс')),
                (
                    'start_mode',
                    models.CharField(
                        choices=[
                            ('after_previous', 'После предыдущего'),
                            ('with_previous', 'Вместе с предыдущим'),
                        ],
                        default='after_previous',
                        max_length=20,
                        verbose_name='Начало',
                    ),
                ),
                (
                    'hold_previous',
                    models.BooleanField(
                        default=False,
                        verbose_name='Сохранять содержимое предыдущего шага',
                    ),
                ),
                (
                    'camera',
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='mode, lat, lng, zoom, duration_ms, ease_linearity, padding',
                        verbose_name='Камера (JSON)',
                    ),
                ),
                (
                    'selection',
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='target_ids, event_ids, situation_ids, zone_leaves, overlay_layer_ids',
                        verbose_name='Выбранные элементы (JSON)',
                    ),
                ),
                (
                    'animation',
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='effect, direction, duration_ms, delay_ms, easing, repeat, state_cycle',
                        verbose_name='Анимация (JSON)',
                    ),
                ),
                (
                    'scenario',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='steps',
                        to='formular.demoscenario',
                        verbose_name='Сценарий',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Шаг сценария демонстрации',
                'verbose_name_plural': 'Шаги сценария демонстрации',
                'ordering': ['scenario_id', 'order'],
            },
        ),
        migrations.AddIndex(
            model_name='demoscenariostep',
            index=models.Index(fields=('scenario', 'order'), name='formular_de_scenari_9bb215_idx'),
        ),
        migrations.AddConstraint(
            model_name='demoscenariostep',
            constraint=models.UniqueConstraint(
                fields=('scenario', 'order'),
                name='uniq_demo_scenario_step_order',
            ),
        ),
    ]
