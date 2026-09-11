import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings

from formular.management.commands.seed_network_demo_scenario import (
    NODES,
    PRESET_ID,
    SCENARIO_TITLE,
    SCENE_DURATION_MS,
)
from formular.models import DemoScenario, DemoTableauMedia


class SeedNetworkDemoScenarioTests(TestCase):
    def test_command_creates_network_preset_with_three_logos(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_network_demo_scenario')

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        preset = scenario.tableau['presets'][0]
        logos = preset['network']['logos']

        self.assertEqual(preset['id'], PRESET_ID)
        self.assertEqual(preset['variant'], 'network')
        self.assertEqual(len(logos), 3)
        self.assertEqual([logo['title'] for logo in logos], [title for title, *_ in NODES])
        for logo in logos:
            self.assertTrue(logo['src'])
        self.assertEqual(scenario.sequence[0]['preset_id'], PRESET_ID)
        self.assertEqual(scenario.sequence[0]['duration_ms'], SCENE_DURATION_MS)
        self.assertEqual(DemoTableauMedia.objects.count(), 3)

    def test_replace_updates_existing_scenario(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_network_demo_scenario')
                first_id = DemoScenario.objects.get(title=SCENARIO_TITLE).id
                call_command('seed_network_demo_scenario', replace=True)

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        self.assertEqual(scenario.id, first_id)
        self.assertEqual(DemoScenario.objects.filter(title=SCENARIO_TITLE).count(), 1)
        self.assertEqual(len(scenario.tableau['presets'][0]['network']['logos']), 3)
