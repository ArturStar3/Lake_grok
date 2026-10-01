"""Bounded ZIP input and media writes owned by one import session."""

from contextvars import ContextVar
import json
import logging
from pathlib import Path, PurePosixPath
import shutil
import stat
import uuid
import zipfile

from django.conf import settings

logger = logging.getLogger(__name__)
_media_writes = ContextVar('import_media_writes', default=None)


def relative_path(value):
    if not isinstance(value, str) or not value or '\x00' in value:
        raise ValueError('Некорректный путь в бандле')
    value = value.replace('\\', '/')
    path = PurePosixPath(value)
    if path.is_absolute() or ':' in value or '..' in path.parts or not path.parts:
        raise ValueError('Путь в бандле должен оставаться внутри сессии импорта')
    return path


def contained_path(root, value):
    root = Path(root).resolve()
    candidate = root.joinpath(*relative_path(value).parts).resolve()
    if not candidate.is_relative_to(root) or candidate == root:
        raise ValueError('Путь выходит за пределы сессии импорта')
    return candidate


def staging_root(session_id):
    parent = Path(settings.MEDIA_ROOT) / 'import_sessions'
    if parent.is_symlink():
        raise ValueError('Каталог сессий импорта не может быть ссылкой')
    root = parent / str(uuid.UUID(str(session_id)))
    if root.is_symlink():
        raise ValueError('Каталог сессии импорта не может быть ссылкой')
    return root


def remove_staging(session_id):
    root = staging_root(session_id)
    if root.exists():
        shutil.rmtree(root)


def cleanup_staging(session_id):
    """Cleanup failure must not turn a committed import into a failed import."""
    try:
        remove_staging(session_id)
    except (OSError, ValueError):
        logger.exception('Cannot clean staging for import %s', session_id)


def extract_bundle(uploaded_file, session_id):
    max_upload = getattr(settings, 'IMPORT_MAX_UPLOAD_BYTES', 100 * 1024 * 1024)
    max_bytes = getattr(settings, 'IMPORT_MAX_EXPANDED_BYTES', 1024 * 1024 * 1024)
    max_entries = getattr(settings, 'IMPORT_MAX_ARCHIVE_ENTRIES', 10000)
    max_ratio = getattr(settings, 'IMPORT_MAX_COMPRESSION_RATIO', 1000)
    if getattr(uploaded_file, 'size', 0) > max_upload:
        raise ValueError('Архив превышает допустимый размер')
    root = staging_root(session_id)
    if root.exists():
        raise ValueError('Каталог сессии уже существует')
    root.mkdir(parents=True)
    try:
        with zipfile.ZipFile(uploaded_file) as archive:
            entries = archive.infolist()
            if len(entries) > max_entries:
                raise ValueError('Слишком много файлов в архиве')
            total = 0
            seen = set()
            for entry in entries:
                name = str(relative_path(entry.filename))
                contained_path(root, name)
                if name in seen or stat.S_ISLNK(entry.external_attr >> 16):
                    raise ValueError('Повторяющиеся имена или ссылки в архиве')
                seen.add(name)
                total += entry.file_size
                if total > max_bytes or entry.file_size > max_ratio * max(1, entry.compress_size):
                    raise ValueError('Распакованный архив превышает допустимые лимиты')
                if entry.flag_bits & 1:
                    raise ValueError('Зашифрованные архивы не поддерживаются')
            actual_total = 0
            for entry in entries:
                dest = contained_path(root, entry.filename)
                if entry.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                copied = 0
                with archive.open(entry) as source, dest.open('xb') as target:
                    while chunk := source.read(1024 * 1024):
                        copied += len(chunk)
                        actual_total += len(chunk)
                        if copied > entry.file_size or actual_total > max_bytes:
                            raise ValueError('Распакованный архив превышает допустимые лимиты')
                        target.write(chunk)
        return root
    except Exception as exc:
        cleanup_staging(session_id)
        if isinstance(exc, (zipfile.BadZipFile, RuntimeError)):
            raise ValueError('Некорректный ZIP-архив') from exc
        raise


def load_bundle_json(path):
    limit = getattr(settings, 'IMPORT_MAX_JSON_BYTES', 64 * 1024 * 1024)
    with Path(path).open('rb') as source:
        payload = source.read(limit + 1)
    if len(payload) > limit:
        raise ValueError('JSON в бандле превышает допустимый размер')
    try:
        return json.loads(payload.decode('utf-8'))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError('Некорректный JSON в бандле') from exc


class MediaWriteJournal:
    """Compensate only newly stored files if the import transaction fails."""

    def __enter__(self):
        self.files = []
        self.token = _media_writes.set(self.files)
        return self

    def __exit__(self, exc_type, exc, tb):
        _media_writes.reset(self.token)
        if exc_type is not None:
            for storage, name in reversed(self.files):
                try:
                    storage.delete(name)
                except OSError:
                    logger.exception('Cannot compensate imported media %s', name)
        return False


def record_media_write(field):
    writes = _media_writes.get()
    if writes is not None:
        writes.append((field.storage, field.name))
