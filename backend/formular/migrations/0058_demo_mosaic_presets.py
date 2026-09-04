# Библиотека пресетов мультиэкрана: миграция legacy enabled/slots → presets

from django.db import migrations, models

from api.demo_scenario_utils import normalize_scenario_mosaic


def forwards(apps, schema_editor):
    DemoScenario = apps.get_model('formular', 'DemoScenario')
    for scenario in DemoScenario.objects.all().iterator():
        raw = scenario.mosaic if isinstance(scenario.mosaic, dict) else {}
        normalized = normalize_scenario_mosaic(raw)
        if normalized != raw:
            scenario.mosaic = normalized
            scenario.save(update_fields=['mosaic'])


def backwards(apps, schema_editor):
    DemoScenario = apps.get_model('formular', 'DemoScenario')
    for scenario in DemoScenario.objects.all().iterator():
        raw = scenario.mosaic if isinstance(scenario.mosaic, dict) else {}
        presets = raw.get('presets') if isinstance(raw.get('presets'), list) else []
        if not presets:
            scenario.mosaic = {
                'enabled': False,
                'layout': '2x2',
                'transition_ms': 700,
                'slots': [
                    {'id': 'a', 'label': ''},
                    {'id': 'b', 'label': ''},
                    {'id': 'c', 'label': ''},
                    {'id': 'd', 'label': ''},
                ],
            }
            scenario.save(update_fields=['mosaic'])
            continue
        preset = presets[0]
        scenario.mosaic = {
            'enabled': True,
            'layout': preset.get('layout') or '2x2',
            'transition_ms': preset.get('transition_ms') or 700,
            'slots': [
                {'id': screen.get('id'), 'label': screen.get('label') or ''}
                for screen in (preset.get('screens') or [])
                if isinstance(screen, dict)
            ],
        }
        scenario.save(update_fields=['mosaic'])


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0057_demo_mosaic'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='demoscenario',
            name='mosaic',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='presets[{id, title, layout, reveal, screens}], active_preset_id',
                verbose_name='Мультиэкран (JSON)',
            ),
        ),
    ]
