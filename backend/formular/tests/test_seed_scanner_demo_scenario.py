import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings

from formular.management.commands.seed_scanner_demo_scenario import (
    DOCUMENT_NAME,
    PRESET_ID,
    SCENARIO_TITLE,
)
from formular.models import DemoScenario, DemoTableauMedia


class SeedScannerDemoScenarioTests(TestCase):
    def test_command_creates_scanner_preset_with_document_and_ten_images(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_scanner_demo_scenario')

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        preset = scenario.tableau['presets'][0]

        self.assertEqual(preset['id'], PRESET_ID)
        self.assertEqual(preset['variant'], 'scanner')
        self.assertEqual(len(preset['scanner']['images']), 10)
        self.assertEqual(preset['scanner']['document']['name'], DOCUMENT_NAME)
        self.assertTrue(preset['scanner']['document']['blocks'])
        self.assertEqual(scenario.sequence[0]['preset_id'], PRESET_ID)
        self.assertEqual(DemoTableauMedia.objects.count(), 10)
