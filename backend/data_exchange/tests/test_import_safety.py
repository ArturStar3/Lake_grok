import io
import json
from pathlib import Path
import stat
import tempfile
from unittest.mock import patch
import uuid
import zipfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from accounts.tests.base import create_admin_group, create_country, create_user
from data_exchange.models import ImportSession
from data_exchange.services import bundle_import, bundle_schema
from data_exchange.services.bundle_files import contained_path, extract_bundle
from formular.models import Marker, Target


def bundle(data=None, files=()):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        archive.writestr('manifest.json', json.dumps({'format_version': 1}))
        archive.writestr('data.json', json.dumps(data or {}))
        for name, payload in files:
            archive.writestr(name, payload)
    return SimpleUploadedFile('bundle.zip', output.getvalue(), content_type='application/zip')


class ImportSafetyTests(APITestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        config = override_settings(MEDIA_ROOT=self.media.name)
        config.enable()
        self.addCleanup(config.disable)
        self.country = create_country(title='Доступная страна', iso_code='AAA')
        self.other_country = create_country(title='Другая страна', iso_code='BBB')
        self.group = create_admin_group(name='Importers', can_manage_reference=False)
        self.group.countries.add(self.country)
        self.user = create_user('importer', groups=[self.group])
        self.other = create_user('other', groups=[self.group])
        self.admin = create_user('root', superuser=True)
        self.client.force_authenticate(self.user)

    def test_rejects_archive_paths_and_cleans_staging(self):
        for name in ('../outside', '/absolute', 'C:/drive', 'media/../../outside', '..\\outside'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                extract_bundle(bundle(files=[(name, b'x')]), uuid.uuid4())
        self.assertEqual(list((Path(self.media.name) / 'import_sessions').iterdir()), [])

    def test_rejects_duplicate_entries_and_symlinks(self):
        with self.assertRaises(ValueError):
            extract_bundle(bundle(files=[('data.json', b'{}')]), uuid.uuid4())
        link = zipfile.ZipInfo('media/link')
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaises(ValueError):
            extract_bundle(bundle(files=[(link, b'outside')]), uuid.uuid4())

    @override_settings(IMPORT_MAX_EXPANDED_BYTES=10)
    def test_rejects_expanded_size_limit(self):
        with self.assertRaises(ValueError):
            extract_bundle(bundle(), uuid.uuid4())

    @override_settings(IMPORT_MAX_JSON_BYTES=10)
    def test_rejects_large_json_and_cleans_failed_analysis(self):
        with self.assertRaises(ValueError):
            bundle_import.analyze_bundle(bundle(), self.admin)
        session = ImportSession.objects.get()
        self.assertEqual(session.status, ImportSession.Status.FAILED)
        self.assertFalse(bundle_import._staging_root(session.pk).exists())

    @override_settings(IMPORT_MAX_UPLOAD_BYTES=10)
    def test_rejects_upload_size_before_creating_staging(self):
        session_id = uuid.uuid4()
        with self.assertRaises(ValueError):
            extract_bundle(bundle(), session_id)
        self.assertFalse(bundle_import._staging_root(session_id).exists())

    @override_settings(IMPORT_MAX_ARCHIVE_ENTRIES=1)
    def test_rejects_archive_entry_limit(self):
        with self.assertRaises(ValueError):
            extract_bundle(bundle(), uuid.uuid4())

    @override_settings(IMPORT_MAX_COMPRESSION_RATIO=2)
    def test_rejects_compression_bomb(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('data.json', 'x' * 10000)
        with self.assertRaises(ValueError):
            extract_bundle(SimpleUploadedFile('bomb.zip', output.getvalue()), uuid.uuid4())

    def test_rejects_invalid_zip(self):
        with self.assertRaises(ValueError):
            extract_bundle(SimpleUploadedFile('bad.zip', b'not a zip'), uuid.uuid4())

    def test_manifest_media_path_is_checked_independently(self):
        data = {'markers': [{'natural_key': 'Bad', 'title': 'Bad', 'path': '../outside.svg'}]}
        with self.assertRaises(ValueError):
            bundle_import.analyze_bundle(bundle(data), self.admin)

    def test_existing_symlink_cannot_escape_staging(self):
        root = Path(self.media.name) / 'root'
        root.mkdir()
        outside = Path(self.media.name) / 'outside'
        outside.mkdir()
        try:
            (root / 'link').symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest('Symlinks unavailable on this platform')
        with self.assertRaises(ValueError):
            contained_path(root, 'link/secret')

    def test_scope_is_checked_before_loading_local_snapshots(self):
        data = {'countries': [bundle_schema.serialize_country(self.other_country)]}
        with patch.object(bundle_import, '_lookup_entity') as lookup:
            with self.assertRaises(PermissionDenied):
                bundle_import.analyze_bundle(bundle(data), self.user)
            lookup.assert_not_called()

    def test_cannot_move_foreign_target_into_allowed_country(self):
        target = Target.objects.create(country=self.other_country, title='Private', lat=0, lng=0)
        rec = bundle_schema.serialize_target(target)
        rec['country_key'] = self.country.title
        data = {'countries': [bundle_schema.serialize_country(self.country)], 'targets': [rec]}
        with self.assertRaises(PermissionDenied):
            bundle_import.analyze_bundle(bundle(data), self.user)

    def test_owner_only_session_api(self):
        session = bundle_import.analyze_bundle(bundle(), self.other)
        url = f'/api/v1/data-exchange/sessions/{session.pk}/'
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.post(url + 'resolve/', {}, format='json').status_code, 404)
        session.refresh_from_db()
        self.assertEqual(session.status, ImportSession.Status.READY)

    def test_superuser_can_inspect_another_users_session(self):
        session = bundle_import.analyze_bundle(bundle(), self.other)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f'/api/v1/data-exchange/sessions/{session.pk}/').status_code, 200)

    def test_country_access_is_rechecked_at_apply(self):
        data = {'countries': [bundle_schema.serialize_country(self.country)]}
        session = bundle_import.analyze_bundle(bundle(data), self.user)
        self.group.countries.clear()
        with self.assertRaises(PermissionDenied):
            bundle_import.apply_import_session(session, user=self.user)

    def test_reference_changes_require_reference_permission(self):
        data = {'markers': [{'natural_key': 'New', 'title': 'New'}]}
        session = bundle_import.analyze_bundle(bundle(data), self.user)
        with self.assertRaises(PermissionDenied):
            bundle_import.apply_import_session(session, user=self.user)
        self.assertFalse(Marker.objects.filter(title='New').exists())
        session.refresh_from_db()
        self.assertEqual(session.status, ImportSession.Status.READY)

    def test_valid_target_import_and_idempotent_apply(self):
        target_id = str(uuid.uuid4())
        data = {
            'countries': [bundle_schema.serialize_country(self.country)],
            'targets': [{'natural_key': target_id, 'id': target_id, 'country_key': self.country.title,
                         'title': 'Нулевые координаты', 'lat': 0, 'lng': 0, 'antenna_height_m': 0}],
        }
        session = bundle_import.analyze_bundle(bundle(data), self.user)
        staging = bundle_import._staging_root(session.pk)
        with self.captureOnCommitCallbacks(execute=True):
            summary = bundle_import.apply_import_session(session, user=self.user)
        self.assertFalse(staging.exists())
        self.assertEqual(bundle_import.apply_import_session(session, user=self.user), summary)
        self.assertEqual(Target.objects.filter(pk=target_id).count(), 1)
        target = Target.objects.get(pk=target_id)
        self.assertEqual((target.lat, target.lng, target.antenna_height_m), (0, 0, 0))

    def test_reference_permission_is_rechecked_at_apply(self):
        session = bundle_import.analyze_bundle(bundle(), self.user)
        self.group.data_exchange = 'read'
        self.group.save(update_fields=['data_exchange'])
        with self.assertRaises(PermissionDenied):
            bundle_import.apply_import_session(session, user=self.user)

    def test_rejects_decision_from_another_session(self):
        session = bundle_import.analyze_bundle(bundle(), self.user)
        with self.assertRaises(ValueError):
            bundle_import.apply_import_session(session, {'99999': 'merge'}, user=self.user)

    def test_media_compensated_but_staging_kept_after_rollback(self):
        data = {'markers': [{'natural_key': 'Uploaded', 'title': 'Uploaded', 'path': 'marker.svg'}]}
        upload = bundle(data, [('media/marker.svg', b'<svg xmlns="http://www.w3.org/2000/svg"/>')])
        session = bundle_import.analyze_bundle(upload, self.admin)
        staging = bundle_import._staging_root(session.pk)
        with patch.object(bundle_import, '_apply_children', side_effect=RuntimeError('injected')):
            with self.assertRaises(RuntimeError):
                bundle_import.apply_import_session(session, user=self.admin)
        self.assertTrue(staging.exists())
        self.assertFalse(Marker.objects.filter(title='Uploaded').exists())
        saved = [p for p in Path(self.media.name).rglob('*.svg') if not p.is_relative_to(staging)]
        self.assertEqual(saved, [])
        session.refresh_from_db()
        self.assertEqual(session.status, ImportSession.Status.READY)

    def test_children_have_their_own_local_snapshot(self):
        target = Target.objects.create(country=self.country, title='T', lat=1, lng=2)
        data = {'target_actions': [{'natural_key': 'action', 'target_id': str(target.pk)}]}
        session = bundle_import.analyze_bundle(bundle(data), self.user)
        self.assertEqual(session.items.get().local_snapshot, {})

    def test_cancel_after_commit_and_applied_session_protected(self):
        session = bundle_import.analyze_bundle(bundle(), self.user)
        with self.captureOnCommitCallbacks(execute=True):
            bundle_import.cancel_import_session(session, user=self.user)
        self.assertFalse(bundle_import._staging_root(session.pk).exists())
        applied = bundle_import.analyze_bundle(bundle(), self.user)
        bundle_import.apply_import_session(applied, user=self.user)
        with self.assertRaises(ValueError):
            bundle_import.cancel_import_session(applied, user=self.user)
