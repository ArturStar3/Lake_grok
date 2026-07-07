"""Базовые классы админки на django-unfold (без внешних CDN)."""

from unfold.admin import ModelAdmin as UnfoldModelAdmin
from unfold.admin import TabularInline as UnfoldTabularInline

from infolake.admin_mixins import MarkdownAdminMixin, MarkdownTabularInline


class ModelAdmin(MarkdownAdminMixin, UnfoldModelAdmin):
    pass


class InlineOnlyModelAdmin(ModelAdmin):
    """Модель редактируется через инлайны родителя — скрыть из списка приложений."""

    def has_module_permission(self, request):
        return False


class TabularInline(MarkdownTabularInline, UnfoldTabularInline):
    pass


__all__ = ('ModelAdmin', 'InlineOnlyModelAdmin', 'TabularInline')
