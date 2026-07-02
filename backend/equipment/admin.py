from django.contrib import admin

from infolake.admin_base import ModelAdmin

from .admin_inlines import EquipmentParameterValueInlineAdmin, EquipmentImageInlineAdmin
from .models import (
    Equipment,
    EquipmentCategory,
    EquipmentParameterDefinition,
    UnitOfMeasure,
)


@admin.register(EquipmentCategory)
class EquipmentCategoryAdmin(ModelAdmin):
    list_display = ('title', 'parent', 'order')
    list_editable = ('order',)
    autocomplete_fields = ('parent',)
    search_fields = ('title',)
    list_per_page = 50


@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(ModelAdmin):
    list_display = ('title', 'symbol')
    search_fields = ('title', 'symbol')
    list_per_page = 50


@admin.register(EquipmentParameterDefinition)
class EquipmentParameterDefinitionAdmin(ModelAdmin):
    list_display = ('title', 'code', 'unit', 'action_type')
    list_filter = ('categories',)
    autocomplete_fields = ('unit', 'action_type', 'categories')
    search_fields = ('title', 'code')
    list_select_related = ('unit', 'action_type')
    list_per_page = 50


@admin.register(Equipment)
class EquipmentAdmin(ModelAdmin):
    list_display = ('designation', 'title', 'category', 'origin_country')
    list_filter = ('category', 'origin_country')
    autocomplete_fields = ('category', 'origin_country')
    search_fields = ('title', 'designation')
    list_select_related = ('category', 'origin_country')
    list_per_page = 50
    inlines = (EquipmentParameterValueInlineAdmin, EquipmentImageInlineAdmin)
