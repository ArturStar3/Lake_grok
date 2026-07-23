from django.contrib import admin

from infolake.admin_base import ModelAdmin, TabularInline

from .models import ReportSection, ReportTemplate


class ReportSectionInline(TabularInline):
    model = ReportSection
    extra = 0
    fields = ('order', 'section_type', 'title', 'page_break_before', 'filters')


@admin.register(ReportTemplate)
class ReportTemplateAdmin(ModelAdmin):
    list_display = ('name', 'created_by', 'sections_count', 'updated_at', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('updated_at',)
    readonly_fields = ('created_at', 'updated_at')
    inlines = [ReportSectionInline]

    @admin.display(description='Разделов')
    def sections_count(self, obj):
        return obj.sections.count()
