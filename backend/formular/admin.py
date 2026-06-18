import os
import re

from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.db.models import Prefetch, Count
from django.conf import settings

from .forms import CountryForm
from .models import (
    Country,
    Target,
    Marker,
    EventType,
    EventMarker,
    ActionType,
    TargetAction,
    CountrySections,
    CountryAttachment,
    FormularSections,
    TargetType,
    FormularAttachment,
    MilitaryBranch
)
from .admin_inlines import (
    TargetInlineAdmin,
    TargetInlineAdmin_2,
    TargetActionInlineAdmin,
    CountryInfoInlineAdmin,
    FormularInlineAdmin,
    TargetChildrenInline,
)

admin.site.site_header = 'Администрирование электронной разведывательной сводки'
EMPTY_VALUE_DISPLAY = '<пусто>'

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    form = CountryForm
    list_display = (
        'title',
        'color_display'
    )
    list_filer = ('color',)
    inlines = (
        TargetInlineAdmin,
        CountryInfoInlineAdmin
    )

    @admin.display(description='Цвет')
    def color_display(self, obj):
        return format_html(
            '<span style="display:inline-block; width:20px; height:20px;'
            'background:{}; border:1px solid #000; margin-right:6px;"></span>',
            obj.color,
        )


class ChildrenCountFilter(admin.SimpleListFilter):
    """Фильтр по количеству непосредственно подчинённых объектов (прямых детей)."""

    title = 'Количество прямых подчинённых'
    parameter_name = 'children_count'

    def lookups(self, request, model_admin):
        return (
            ('0', '0'),
            ('1-5', '1-5'),
            ('6-10', '6-10'),
            ('11+', '11 и больше'),
        )

    def queryset(self, request, queryset):
        value = self.value()
        if value == '0':
            return queryset.filter(direct_children_count=0)
        elif value == '1-5':
            return queryset.filter(
                direct_children_count__gte=1,
                direct_children_count__lte=5
            )
        elif value == '6-10':
            return queryset.filter(
                direct_children_count__gte=6,
                direct_children_count__lte=10
            )
        elif value == '11+':
            return queryset.filter(direct_children_count__gte=11)
        return queryset


@admin.register(Target)
class TargetAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'label',
        'country',
        'branch',
        'type',
        'lat',
        'lng',
        'action_radius',
        'direct_children_count',
    )
    raw_id_fields = (
        'country',
        'marker',
        'type',
        'branch',
        'parent',
    )
    search_fields = (
        'title',
        'country__title',
        'label'
    )
    list_filter = (
        'country__title',
        'branch__title',
        ChildrenCountFilter,
    )
    list_editable = (
        'lat',
        'lng',
        'action_radius'
    )
    inlines = (
        TargetActionInlineAdmin,
        FormularInlineAdmin,
        TargetChildrenInline,
    )

    def get_queryset(self, request):
        return super().get_queryset(
            request
        ).select_related(
                'country'
        ).prefetch_related(
            Prefetch(
                'actions',
                queryset=TargetAction.objects.select_related(
                    'action_type'
                )
            )
        ).annotate(
            direct_children_count=Count('children')
        )

    def direct_children_count(self, obj):
        return getattr(obj, 'direct_children_count', 0)
    direct_children_count.short_description = 'Прямых подчинённых'
    direct_children_count.admin_order_field = 'direct_children_count'
    
@admin.register(ActionType)
class ActionTypeAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'animation'
    )
    list_editable = ('animation',)
    
@admin.register(Marker)
class MarkerAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'svg_thumbnail',
        'top',
        'width',
        'height',
        'scale',
        'order',
        'is_flag'
    )
    list_editable = (
        'top',
        'width',
        'height',
        'scale',
        'order',
        'is_flag'
    )
    inlines = (TargetInlineAdmin_2,)

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related(
            Prefetch(
                'markers',
                queryset=Target.objects.select_related('country')
            )
        )
    
    def svg_thumbnail(self, obj):
        file_url = obj.path.url
        file_path = getattr(obj.path, 'path', None)
        if file_path and os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as svg_file:
                    svg_content = svg_file.read()
                ids = re.findall(r'\bid="([^"]+)"', svg_content)
                if ids:
                    id_map = {}
                    for original_id in ids:
                        if original_id not in id_map:
                            id_map[original_id] = f"{original_id}-{obj.id}"

                    def replace_id_attr(match):
                        original_id = match.group(1)
                        return f'id="{id_map.get(original_id, original_id)}"'

                    svg_content = re.sub(r'\bid="([^"]+)"', replace_id_attr, svg_content)

                    for original_id, new_id in id_map.items():
                        svg_content = re.sub(
                            rf'url\(#\s*{re.escape(original_id)}\s*\)',
                            f'url(#{new_id})',
                            svg_content
                        )
                        svg_content = re.sub(
                            rf'(^|[\"\'\s])#{re.escape(original_id)}(?!-)',
                            rf'\1#{new_id}',
                            svg_content
                        )
                if '<svg' in svg_content:
                    svg_content = svg_content.replace('<svg', '<svg class="marker-admin__svg"', 1)
                return format_html(
                    '<div class="marker-admin__svg-wrap" style="width:85px;height:85px;">{}</div>',
                    mark_safe(svg_content)
                )
            except OSError:
                pass
        return format_html(
            '<img src="{}" width="40" height="40" style="object-fit:contain" alt="icon">',
            file_url
        )
    svg_thumbnail.short_description = "Флажок"
    svg_thumbnail.allow_tags = True

    class Media:
        css = {
            'all': ('admin/css/marker_admin.css',)
        }

@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ('title',)

@admin.register(EventMarker)
class EventMarkerAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'path'
    )

@admin.register(CountrySections)
class CountrySectionsAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'parent',
        'order'
    )
    list_editable = ('order',)
    raw_id_fields = ('parent',)

@admin.register(FormularSections)
class FormularSectionsAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'parent',
        'order'
    )
    list_editable = ('order',)
    raw_id_fields = ('parent',)


@admin.register(FormularAttachment)
class FormularAttachmentAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'target',
        'section',
        'created_at'
    )
    search_fields = (
        'title',
        'target__title',
        'section__title'
    )
    list_filter = (
        'section',
    )


@admin.register(CountryAttachment)
class CountryAttachmentAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'country',
        'section',
        'created_at'
    )
    search_fields = (
        'title',
        'country__title',
        'section__title'
    )
    list_filter = (
        'section',
    )

@admin.register(TargetType)
class TargetTypeAdmin(admin.ModelAdmin):
    list_display = (
        'title',
    )


@admin.register(MilitaryBranch)
class MilitaryBranchAdmin(admin.ModelAdmin):
    list_display = (
        'title',
    )
    filter_horizontal = ('countries',)  # удобный виджет для ManyToMany
    search_fields = ('title',)
