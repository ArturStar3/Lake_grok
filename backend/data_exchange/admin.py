from django.contrib import admin
from unfold.admin import ModelAdmin

from data_exchange.models import ImportItem, ImportSession


class ImportItemInline(admin.TabularInline):
    model = ImportItem
    extra = 0
    can_delete = False
    readonly_fields = (
        'entity_type', 'natural_key', 'status', 'decision', 'label',
        'local_snapshot', 'imported_snapshot',
    )
    fields = ('entity_type', 'natural_key', 'status', 'decision', 'label')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ImportSession)
class ImportSessionAdmin(ModelAdmin):
    list_display = ('id', 'status', 'created_by', 'created_at', 'updated_at')
    list_filter = ('status',)
    search_fields = ('id', 'error_message')
    readonly_fields = (
        'id', 'status', 'manifest', 'summary', 'bundle_path',
        'error_message', 'created_by', 'created_at', 'updated_at',
    )
    inlines = [ImportItemInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
