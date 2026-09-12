import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings

from formular.management.commands.seed_video_demo_scenario import (
    ASSET_DIR,
    PRESET_ID,
    SCENARIO_TITLE,
    SCENE_DURATION_MS,
    VIDEO_NAME,
)
from formular.models import DemoMosaicMedia, DemoScenario


class SeedVideoDemoScenarioTests(TestCase):
    def test_command_creates_fullscreen_video_preset(self):
        self.assertTrue((ASSET_DIR / VIDEO_NAME).is_file())
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_video_demo_scenario')

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        preset = scenario.tableau['presets'][0]
        video = preset['video']

        self.assertEqual(preset['id'], PRESET_ID)
        self.assertEqual(preset['variant'], 'video')
        self.assertTrue(video['video_url'])
        self.assertTrue(video['video_media_id'])
        self.assertEqual(video['object_fit'], 'cover')
        self.assertTrue(video['loop'])
        self.assertEqual(preset['caption']['content'], 'Полноэкранное видео')
        self.assertEqual(scenario.sequence[0]['type'], 'tableau')
        self.assertEqual(scenario.sequence[0]['preset_id'], PRESET_ID)
        self.assertEqual(scenario.sequence[0]['duration_ms'], SCENE_DURATION_MS)
        self.assertEqual(DemoMosaicMedia.objects.count(), 1)

    def test_replace_updates_existing_scenario(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                call_command('seed_video_demo_scenario')
                first_id = DemoScenario.objects.get(title=SCENARIO_TITLE).id
                call_command('seed_video_demo_scenario', replace=True)

        scenario = DemoScenario.objects.get(title=SCENARIO_TITLE)
        self.assertEqual(scenario.id, first_id)
        self.assertEqual(DemoScenario.objects.filter(title=SCENARIO_TITLE).count(), 1)
        self.assertEqual(scenario.tableau['presets'][0]['variant'], 'video')
        self.assertTrue(scenario.tableau['presets'][0]['video']['video_url'])
