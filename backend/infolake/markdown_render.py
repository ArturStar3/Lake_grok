"""Серверный рендеринг Markdown для админки (совместим с фронтендом: GFM-таблицы, списки)."""

import markdown
from django.utils.safestring import SafeString, mark_safe

_EXTENSIONS = ('extra', 'nl2br', 'sane_lists', 'tables')


def render_markdown(text: str) -> SafeString:
    if not text or not str(text).strip():
        return mark_safe('')
    html = markdown.markdown(
        str(text),
        extensions=_EXTENSIONS,
        output_format='html5',
    )
    return mark_safe(html)
