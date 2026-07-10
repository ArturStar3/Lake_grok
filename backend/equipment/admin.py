from django.contrib import admin
from django.db.models import Q
from django.utils.html import format_html

from infolake.admin_base import ModelAdmin

from .admin_inlines import EquipmentParameterValueInlineAdmin, EquipmentImageInlineAdmin
from .forms import EquipmentParameterDefinitionForm
from .models import (
    Equipment,
    EquipmentCategory,
    EquipmentParameterDefinition,
    UnitOfMeasure,
)


class MissingZoneActionTypeFilter(admin.SimpleListFilter):
    title = 'тип зоны'
    parameter_name = 'zone_action_type'

    def lookups(self, request, model_admin):
        return (
            ('missing_km', 'км без типа зоны'),
            ('has_type', 'С типом зоны'),
        )

    def queryset(self, request, queryset):
        km_q = Q(unit__symbol__iexact='км') | Q(unit__symbol__iexact='km')
        if self.value() == 'missing_km':
            return queryset.filter(km_q, action_type__isnull=True)
        if self.value() == 'has_type':
            return queryset.filter(action_type__isnull=False)
        return queryset


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
    form = EquipmentParameterDefinitionForm
    list_display = (
        'title',
        'code',
        'unit',
        'action_type',
        'zone_color_display',
        'zone_line_type_display',
    )
    list_filter = ('categories', 'action_type', MissingZoneActionTypeFilter)
    autocomplete_fields = ('unit', 'action_type', 'categories')
    search_fields = ('title', 'code')
    list_select_related = ('unit', 'action_type')
    list_per_page = 50
    fieldsets = (
        (None, {
            'fields': ('title', 'code', 'unit', 'action_type', 'help_text', 'categories'),
        }),
        ('Оформление зоны', {
            'classes': ('equipment-parameter-zone-style',),
            'fields': (
                'inherit_zone_color',
                'zone_color',
                'inherit_zone_line_type',
                'zone_line_type',
            ),
            'description': (
                'Снимите галочку «Наследовать…», чтобы задать своё оформление. '
                'При включённой галочке в базе сохраняется пустое значение.'
            ),
        }),
    )

    @admin.display(description='Тип линии')
    def zone_line_type_display(self, obj):
        if obj.zone_line_type:
            return obj.zone_line_type
        if obj.action_type_id:
            return f'{obj.get_effective_zone_line_type()} (из типа)'
        return '—'

    @admin.display(description='Цвет зоны')
    def zone_color_display(self, obj):
        color = obj.get_effective_zone_color()
        override = obj.zone_color or ''
        label = override if override else f'{color} (из типа)'
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:8px;">'
            '<span style="display:inline-block;width:22px;height:22px;'
            'background:{};border:1px solid #333;border-radius:4px;'
            'box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25);" '
            'title="{}"></span>'
            '<span style="color:#666;font-size:12px;">{}</span>'
            '</span>',
            color,
            color,
            label,
        )


@admin.register(Equipment)
class EquipmentAdmin(ModelAdmin):
    list_display = ('designation', 'title', 'category', 'origin_country')
    list_filter = ('category', 'origin_country')
    autocomplete_fields = ('category', 'origin_country')
    search_fields = ('title', 'designation')
    list_select_related = ('category', 'origin_country')
    list_per_page = 50
    inlines = (EquipmentParameterValueInlineAdmin, EquipmentImageInlineAdmin)
