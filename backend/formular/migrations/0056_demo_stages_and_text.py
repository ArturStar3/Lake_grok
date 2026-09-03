# Этапы демонстрации (start_mode=on_click) и инструмент «Текст на карте»

from django.db import migrations, models


def after_previous_to_on_click(apps, schema_editor):
    """
    До появления этапов каждый шаг с «После предыдущего» был отдельной сценой,
    между которыми переключался плеер. Чтобы существующие сценарии сохранили
    прежнюю гранулярность переключения, такие шаги становятся началом этапа.
    """
    DemoScenarioStep = apps.get_model('formular', 'DemoScenarioStep')
    DemoScenarioStep.objects.filter(start_mode='after_previous').update(start_mode='on_click')


def on_click_to_after_previous(apps, schema_editor):
    DemoScenarioStep = apps.get_model('formular', 'DemoScenarioStep')
    DemoScenarioStep.objects.filter(start_mode='on_click').update(start_mode='after_previous')


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0055_demo_content_tools'),
    ]

    operations = [
        migrations.AddField(
            model_name='demoscenario',
            name='auto_advance',
            field=models.BooleanField(
                default=True,
                help_text='Если выключено, переход к следующему этапу выполняет докладчик',
                verbose_name='Автоматически переключать этапы',
            ),
        ),
        migrations.AddField(
            model_name='demoscenariostep',
            name='text',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='content, anchor, lat, lng, screen, offset, width, style, enter, exit',
                verbose_name='Текст на карте (JSON)',
            ),
        ),
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
                    ('text', 'Текст на карте'),
                ],
                default='camera',
                max_length=20,
                verbose_name='Инструмент',
            ),
        ),
        migrations.AlterField(
            model_name='demoscenariostep',
            name='animation',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='effect, direction, duration_ms, delay_ms, easing, repeat, continuous, state_cycle',
                verbose_name='Анимация (JSON)',
            ),
        ),
        migrations.AlterField(
            model_name='demoscenariostep',
            name='start_mode',
            field=models.CharField(
                choices=[
                    ('on_click', 'По щелчку (новый этап)'),
                    ('after_previous', 'После предыдущего'),
                    ('with_previous', 'Вместе с предыдущим'),
                ],
                default='on_click',
                max_length=20,
                verbose_name='Начало',
            ),
        ),
        migrations.RunPython(after_previous_to_on_click, on_click_to_after_previous),
    ]
