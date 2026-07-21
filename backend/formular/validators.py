import os
import mimetypes

import re

from django.core.exceptions import ValidationError

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
    
    mime_type, _ = mimetypes.guess_type(file_obj.name)
    if mime_type != "image/svg+xml":
        raise ValidationError(
            "Файл не является корректным SVG-изображением(скыдыщ!)"
        )