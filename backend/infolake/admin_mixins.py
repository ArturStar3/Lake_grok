from django.db import models

from infolake.widgets import MarkdownTextarea

# Поля, в которых хранится Markdown (как на фронтенде).
MARKDOWN_FIELD_NAMES = frozenset({'content', 'description'})


class MarkdownAdminMixin:
    """Подключает MarkdownTextarea для полей content и description."""

    markdown_field_names = MARKDOWN_FIELD_NAMES

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if (
            db_field.name in self.markdown_field_names
            and isinstance(db_field, models.TextField)
        ):
            rows = 4 if getattr(self, '_is_tabular_inline', False) else 12
            kwargs['widget'] = MarkdownTextarea(attrs={'rows': rows})
        return super().formfield_for_dbfield(db_field, request, **kwargs)


class MarkdownTabularInline(MarkdownAdminMixin):
    """TabularInline с компактным Markdown-виджетом."""

    _is_tabular_inline = True
