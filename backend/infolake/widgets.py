from django import forms
from django.urls import reverse


class MarkdownTextarea(forms.Textarea):
    """Textarea с панелью форматирования и предпросмотром Markdown."""

    template_name = 'admin/widgets/markdown_textarea.html'

    def __init__(self, attrs=None):
        default_attrs = {
            'class': 'markdown-widget__textarea',
            'rows': 12,
            'data-markdown-field': 'true',
        }
        if attrs:
            default_attrs.update(attrs)
        super().__init__(default_attrs)
        self.inline_mode = int(default_attrs.get('rows', 12)) <= 5

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        context['widget']['preview_url'] = reverse('admin_markdown_preview')
        context['widget']['inline_mode'] = self.inline_mode
        return context
