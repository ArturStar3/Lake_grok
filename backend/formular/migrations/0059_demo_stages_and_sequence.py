import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0058_demo_mosaic_presets'),
    ]

    operations = [
        migrations.CreateModel(
            name='DemoScenarioStage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, verbose_name='Уникальный идентификатор')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Порядок')),
                ('title', models.CharField(blank=True, default='', max_length=255, verbose_name='Название этапа')),
                ('scenario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stages', to='formular.demoscenario', verbose_name='Сценарий')),
            ],
            options={
                'verbose_name': 'Этап сценария демонстрации',
                'verbose_name_plural': 'Этапы сценария демонстрации',
                'ordering': ['scenario_id', 'order'],
            },
        ),
        migrations.AddConstraint(
            model_name='demoscenariostage',
            constraint=models.UniqueConstraint(fields=('scenario', 'order'), name='uniq_demo_scenario_stage_order'),
        ),
        migrations.AddIndex(
            model_name='demoscenariostage',
            index=models.Index(fields=['scenario', 'order'], name='formular_de_scenari_stage_ord_idx'),
        ),
        migrations.AddField(
            model_name='demoscenario',
            name='sequence',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='[{type, stage_id|preset_id, duration_ms, wait_for_presenter, enter, exit}]',
                verbose_name='Программа показа (JSON)',
            ),
        ),
        migrations.AlterField(
            model_name='demoscenario',
            name='mosaic',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='presets[{id, title, layout, reveal, screens[{id, label, loop, stage_id}]}], active_preset_id',
                verbose_name='Мультиэкран (JSON)',
            ),
        ),
        migrations.AddField(
            model_name='demoscenariostep',
            name='stage',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='steps',
                to='formular.demoscenariostage',
                verbose_name='Этап',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='demoscenariostep',
            name='uniq_demo_scenario_step_order',
        ),
        migrations.AlterModelOptions(
            name='demoscenariostep',
            options={
                'ordering': ['scenario_id', 'stage_id', 'order'],
                'verbose_name': 'Шаг сценария демонстрации',
                'verbose_name_plural': 'Шаги сценария демонстрации',
            },
        ),
        migrations.AlterField(
            model_name='demoscenariostep',
            name='start_mode',
            field=models.CharField(
                choices=[
                    ('on_click', 'Новый такт'),
                    ('after_previous', 'После предыдущего'),
                    ('with_previous', 'Вместе с предыдущим'),
                ],
                default='on_click',
                max_length=20,
                verbose_name='Начало',
            ),
        ),
    ]
