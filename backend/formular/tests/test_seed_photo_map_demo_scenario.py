import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings

from formular.management.commands.seed_photo_map_demo_scenario import (
    COLLAPSE_MS,
    EXPAND_MS,
    GRID_MS,
    PRESET_ID,
    SCENARIO_TITLE,
)
from formular.models import DemoScenario, DemoTableauMedia


class SeedPhotoMapDemoScenarioTests(TestCase):
    def test_command_creates_two_screen_cover_expand_program(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_photo_map_demo_scenario')

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        mosaic = scenario.mosaic
        preset = mosaic['presets'][0]
        photo, map_screen = preset['screens']
        actions = [item['mosaic_action'] for item in scenario.sequence if item['type'] == 'mosaic']

        self.assertEqual(preset['id'], PRESET_ID)
        self.assertEqual(preset['layout'], '1x2')
        self.assertEqual(preset['expand_animation'], 'cover')
        self.assertEqual(preset['expandable_slots'], ['b'])
        self.assertEqual(photo['content_type'], 'image')
        self.assertTrue(photo['image_url'])
        self.assertEqual(photo['image_fit'], 'cover')
        self.assertEqual(photo['id'], 'a')
        self.assertEqual(map_screen['id'], 'b')
        self.assertEqual(map_screen['content_type'], 'stage')
        self.assertTrue(map_screen['stage_id'])
        self.assertEqual(actions, ['show_grid', 'expand', 'collapse'])
        self.assertEqual(scenario.sequence[1]['duration_ms'], GRID_MS)
        expand = scenario.sequence[2]
        self.assertEqual(expand['slot'], 'b')
        self.assertEqual(expand['expand_animation'], 'cover')
        self.assertEqual(expand['duration_ms'], EXPAND_MS)
        self.assertEqual(scenario.sequence[3]['duration_ms'], COLLAPSE_MS)
        self.assertEqual(DemoTableauMedia.objects.count(), 1)

    def test_replace_updates_existing_scenario(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_photo_map_demo_scenario')
                first_id = DemoScenario.objects.get(title=SCENARIO_TITLE).id
                call_command('seed_photo_map_demo_scenario', replace=True)

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        self.assertEqual(scenario.id, first_id)
        self.assertEqual(DemoScenario.objects.filter(title=SCENARIO_TITLE).count(), 1)
        self.assertEqual(scenario.mosaic['presets'][0]['layout'], '1x2')
        self.assertEqual(scenario.sequence[2]['slot'], 'b')
