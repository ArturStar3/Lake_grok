from pathlib import Path
import tempfile
from types import SimpleNamespace

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, override_settings

from formular.validators import validate_svg
from infolake.markdown_render import render_markdown
from infolake.safe_content import safe_svg
from reports.services.local_resources import fetch_local_resource
from reports.services.pdf_builder import build_pdf_bytes


class SafeRenderingTests(SimpleTestCase):
    def test_markdown_removes_active_html_and_external_images(self):
        html = str(render_markdown('<script>alert(1)</script>\n\n<a href="javascript:alert(1)" onclick="bad()">link</a>\n\n![bad](https://example.com/image.png)'))
        self.assertNotIn('<script', html)
        self.assertNotIn('javascript:', html)
        self.assertNotIn('onclick', html)
        self.assertNotIn('example.com', html)

    def test_russian_tables_and_local_images_preserved(self):
        html = str(render_markdown('| Имя | Значение |\n| --- | --- |\n| Объект | 0 |\n\n![Фото](/media/photo.png)'))
        self.assertIn('<table>', html)
        self.assertIn('Объект', html)
        self.assertIn('src="/media/photo.png"', html)

    def test_svg_rejects_active_elements_attributes_and_external_resources(self):
        for body in ('<script/>', '<foreignObject/>', '<circle onload="bad()"/>',
                     '<use href="https://example.com/icon"/>', '<use HREF="javascript:bad()"/>',
                     '<path fill="url(file:///secret)"/>', '<path fill="url/**/(https://example.com)"/>',
                     '<path fill="u\\72l(https://example.com)"/>'):
            with self.subTest(body=body), self.assertRaises(ValidationError):
                safe_svg(f'<svg xmlns="http://www.w3.org/2000/svg">{body}</svg>')

    def test_svg_keeps_gradients_and_inlines_class_styles(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>.color__first { fill: url(#grad); }</style><defs><linearGradient id="grad"><stop stop-color="#008DD2"/></linearGradient></defs><path class="color__first" d="M0 0"/></svg>'
        cleaned = safe_svg(svg)
        self.assertNotIn('<style', cleaned)
        self.assertIn('linearGradient', cleaned)
        self.assertIn('url(#grad)', cleaned)
        uploaded = SimpleUploadedFile('marker.svg', svg.encode())
        validate_svg(uploaded)
        self.assertNotIn(b'<style', uploaded.read())

    def test_svg_rejects_entities(self):
        with self.assertRaises(ValidationError):
            safe_svg('<!DOCTYPE svg [<!ENTITY x "expanded">]><svg>&x;</svg>')

    def test_svg_normalizes_namespace_and_drops_editor_metadata(self):
        cleaned = safe_svg('<svg><metadata><document/></metadata><path d="M0 0"/></svg>')
        self.assertIn('xmlns="http://www.w3.org/2000/svg"', cleaned)
        self.assertNotIn('metadata', cleaned)

    def test_malformed_link_does_not_break_markdown_rendering(self):
        html = str(render_markdown('<a href="http://[invalid">text</a>'))
        self.assertIn('text', html)
        self.assertNotIn('href=', html)

    def test_pdf_smoke_with_local_stylesheet_and_russian_text(self):
        pdf = build_pdf_bytes(template_name='Проверка отчёта', template_description='Офлайн',
                              sections=[], user=SimpleNamespace(username='report-test'))
        self.assertTrue(pdf.startswith(b'%PDF-'))
        self.assertGreater(len(pdf), 1000)

    def test_pdf_resource_loader_blocks_network_and_arbitrary_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            media = root / 'media'
            media.mkdir()
            (media / 'photo.png').write_bytes(b'png')
            (root / 'secret').write_bytes(b'secret')
            with override_settings(BASE_DIR=root, MEDIA_ROOT=media):
                self.assertEqual(fetch_local_resource('/media/photo.png')['string'], b'png')
                self.assertEqual(fetch_local_resource((media / 'photo.png').as_uri())['string'], b'png')
                for url in ('https://example.com', 'http://127.0.0.1/', (root / 'secret').as_uri(), '/media/../secret'):
                    with self.subTest(url=url), self.assertRaises(ValueError):
                        fetch_local_resource(url)
