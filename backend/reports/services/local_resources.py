"""PDF rendering never fetches the network or arbitrary local files."""

import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlsplit

from django.conf import settings


def fetch_local_resource(url, *args, **kwargs):
    parsed = urlsplit(url)
    if parsed.scheme not in ('', 'file') or parsed.netloc:
        raise ValueError('В PDF разрешены только локальные ресурсы')
    value = unquote(parsed.path)
    media_root = Path(settings.MEDIA_ROOT).resolve()
    static_root = (Path(settings.BASE_DIR) / 'reports' / 'static').resolve()
    if value.startswith('/media/'):
        candidate = media_root / value[len('/media/'):]
    elif value.startswith('/static/reports/'):
        candidate = static_root / 'reports' / value[len('/static/reports/'):]
    else:
        candidate = Path(value)
    candidate = candidate.resolve()
    if not any(candidate.is_relative_to(root) and candidate != root for root in (media_root, static_root)):
        raise ValueError('Ресурс PDF находится вне разрешённых каталогов')
    limit = getattr(settings, 'REPORT_MAX_RESOURCE_BYTES', 20 * 1024 * 1024)
    with candidate.open('rb') as source:
        content = source.read(limit + 1)
    if len(content) > limit:
        raise ValueError('Ресурс PDF слишком большой')
    return {'string': content, 'mime_type': mimetypes.guess_type(candidate.name)[0] or 'application/octet-stream'}
