"""Заглушки для ImageField/FileField при демо-заполнении БД."""

import base64

from django.core.files.base import ContentFile

# 1×1 PNG (серый пиксель)
_PLACEHOLDER_PNG_B64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'
    'YMPw38BwDQAJRgG0Yr2k5AAAAABJRU5ErkJggg=='
)

PLACEHOLDER_SVG = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
    'viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#6b7280"/>'
    '</svg>'
)


def placeholder_png(name='placeholder.png'):
    return ContentFile(base64.b64decode(_PLACEHOLDER_PNG_B64), name=name)


def placeholder_svg(name='placeholder.svg'):
    return ContentFile(PLACEHOLDER_SVG.encode('utf-8'), name=name)


def save_placeholder_image(image_field, filename):
    """Сохраняет PNG-заглушку в ImageField (перезаписывает при повторном вызове)."""
    if image_field and image_field.name:
        image_field.delete(save=False)
    image_field.save(filename, placeholder_png(filename), save=False)
