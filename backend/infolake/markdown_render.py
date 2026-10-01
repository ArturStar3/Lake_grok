"""Серверный рендеринг Markdown для админки (совместим с фронтендом: GFM-таблицы, списки)."""

import markdown
from django.utils.safestring import SafeString, mark_safe
from .safe_content import sanitize_html

_EXTENSIONS = ('extra', 'nl2br', 'sane_lists', 'tables')


def render_markdown(text: str) -> SafeString:
    if not text or not str(text).strip():
        return mark_safe('')
    html = markdown.markdown(
        str(text),
        extensions=_EXTENSIONS,
        output_format='html5',
    )
    return mark_safe(sanitize_html(html))
