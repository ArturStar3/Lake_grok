import os

import re

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from infolake.safe_content import safe_svg

_HEX_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')


def validate_hex_color(value):
    if not isinstance(value, str) or not _HEX_COLOR_RE.match(value):
        raise ValidationError('Цвет должен быть в формате #RRGGBB')


def validate_svg(file_obj):
    """Валидация на соответствие формату *.svg"""

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext != ".svg":
        raise ValidationError(
            "Разрешена загрузка только svg файлов"
        )
    
    position = file_obj.tell()
    try:
        file_obj.seek(0)
        content = safe_svg(file_obj.read(2 * 1024 * 1024 + 1)).encode('utf-8')
        if isinstance(file_obj, UploadedFile):
            file_obj.file = ContentFile(content, name=file_obj.name)
            file_obj.size = len(content)
    finally:
        file_obj.seek(position)
