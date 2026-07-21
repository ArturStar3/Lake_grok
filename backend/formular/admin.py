import os
import re

from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.db.models import Prefetch, Count

from infolake.admin_base import InlineOnlyModelAdmin, ModelAdmin

from .forms import CountryForm, ActionTypeForm, MarkerColorPaletteForm
from .models import (
    Country,
    CountryInfo,
    Target,
    TargetEquipment,
    Marker,
    MarkerColorPalette,
    Event,
    EventType,
    EventMarker,
    OperationalSituation,
    OperationalSituationRevision,
    ActionType,
    TargetAction,
    CountrySections,
    CountryAttachment,
    FormularSections,
    Formular,
    TargetType,
    FormularAttachment,
    PersonSections,
    RelationType,
    Person,
    PersonInfo,
    PersonAttachment,
    PersonPhoto,
    PersonRelation,
    MapDisplaySettings,
    TargetVulnerability,
)
from .admin_inlines import (
    TargetInlineAdmin,
    TargetInlineAdmin_2,
    TargetActionInlineAdmin,
    TargetEquipmentInlineAdmin,
    CountryInfoInlineAdmin,
    FormularInlineAdmin,
    TargetChildrenInline,
    PersonInlineAdmin,
    PersonInfoInlineAdmin,
    PersonPhotoInlineAdmin,
    PersonAttachmentInlineAdmin,
    PersonRelationFromInlineAdmin,
)

EMPTY_VALUE_DISPLAY = '<пусто>'


@admin.register(MarkerColorPalette)
class MarkerColorPaletteAdmin(ModelAdmin):
    form = MarkerColorPaletteForm
    list_display = ('title', 'swatch_first', 'swatch_second', 'swatch_third', 'swatch_forth')
    search_fields = ('title',)
    list_per_page = 50

    def _swatch(self, hex_color):
        return format_html(
            '<span style="display:inline-block;width:20px;height:20px;background:{};'
            'border:1px solid #000;"></span>',
            hex_color,
        )

    @admin.display(description='1')
    def swatch_first(self, obj):
        return self._swatch(obj.color_first)

    @admin.display(description='2')
    def swatch_second(self, obj):
        return self._swatch(obj.color_second)

    @admin.display(description='3')
    def swatch_third(self, obj):
        return self._swatch(obj.color_third)

    @admin.display(description='4')
    def swatch_forth(self, obj):
        return self._swatch(obj.color_forth)


@admin.register(Country)
class CountryAdmin(ModelAdmin):
    form = CountryForm
    list_display = ('title', 'palette_display')
    list_filter = ('marker_palette',)
    search_fields = ('title', 'title_short', 'iso_code')
    list_per_page = 50
    inlines = (
        TargetInlineAdmin,
        CountryInfoInlineAdmin,
    )

    @admin.display(description='Палитра')
    def palette_display(self, obj):
        p = obj.marker_palette
        if not p:
            return EMPTY_VALUE_DISPLAY
        return format_html(
            '{}<span style="margin-left:8px;">{}</span>',
            mark_safe(''.join(
                f'<span style="display:inline-block;width:14px;height:14px;background:{c};'
                f'border:1px solid #000;margin-right:2px;"></span>'
                for c in (p.color_first, p.color_second, p.color_third, p.color_forth)
            )),
            p.title,
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
                direct_children_count__lte=5,
            )
        elif value == '6-10':
            return queryset.filter(
                direct_children_count__gte=6,
                direct_children_count__lte=10,
            )
        elif value == '11+':
            return queryset.filter(direct_children_count__gte=11)
        return queryset


@admin.register(Target)
class TargetAdmin(ModelAdmin):
    list_display = (
        'title',
        'label',
        'country',
        'type',
        'lat',
        'lng',
        'action_radius',
        'direct_children_count',
    )
    autocomplete_fields = (
        'country',
        'marker',
        'type',
        'parent',
    )
    exclude = ('equipment',)
    search_fields = ('title', 'label', 'country__title')
    list_filter = ('country', ChildrenCountFilter)
    list_editable = ('lat', 'lng', 'action_radius')
    list_select_related = ('country', 'type', 'marker')
    list_per_page = 50
    show_full_result_count = False
    inlines = (
        TargetActionInlineAdmin,
        TargetEquipmentInlineAdmin,
        FormularInlineAdmin,
        PersonInlineAdmin,
        TargetChildrenInline,
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related('country', 'type', 'marker')
            .prefetch_related(
                Prefetch(
                    'actions',
                    queryset=TargetAction.objects.select_related('action_type'),
                ),
                Prefetch(
                    'equipment_links',
                    queryset=TargetEquipment.objects.select_related('equipment'),
                ),
            )
            .annotate(direct_children_count=Count('children'))
        )

    @admin.display(description='Прямых подчинённых', ordering='direct_children_count')
    def direct_children_count(self, obj):
        return getattr(obj, 'direct_children_count', 0)


@admin.register(ActionType)
class ActionTypeAdmin(ModelAdmin):
    form = ActionTypeForm
    list_display = ('title', 'color_display', 'line_type', 'zone_mode', 'is_inundation_zone')
    list_editable = ('line_type', 'zone_mode', 'is_inundation_zone')
    search_fields = ('title',)
    list_per_page = 50

    @admin.display(description='Цвет зоны')
    def color_display(self, obj):
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:8px;">'
            '<span style="display:inline-block;width:22px;height:22px;'
            'background:{};border:1px solid #333;border-radius:4px;'
            'box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25);" '
            'title="{}"></span>'
            '<span style="color:#666;font-size:12px;">{}</span>'
            '</span>',
            obj.color,
            obj.color,
            obj.color,
        )


@admin.register(Marker)
class MarkerAdmin(ModelAdmin):
    list_display = (
        'title',
        'svg_thumbnail',
        'top',
        'width',
        'height',
        'scale',
        'order',
        'is_flag',
    )
    list_editable = ('top', 'width', 'height', 'scale', 'order', 'is_flag')
    search_fields = ('title',)
    list_per_page = 50
    inlines = (TargetInlineAdmin_2,)

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related(
            Prefetch(
                'markers',
                queryset=Target.objects.select_related('country'),
            ),
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

                    svg_content = re.sub(
                        r'\bid="([^"]+)"',
                        replace_id_attr,
                        svg_content,
                    )

                    for original_id, new_id in id_map.items():
                        svg_content = re.sub(
                            rf'url\(#\s*{re.escape(original_id)}\s*\)',
                            f'url(#{new_id})',
                            svg_content,
                        )
                        svg_content = re.sub(
                            rf'(^|[\"\'\s])#{re.escape(original_id)}(?!-)',
                            rf'\1#{new_id}',
                            svg_content,
                        )
                if '<svg' in svg_content:
                    svg_content = svg_content.replace(
                        '<svg',
                        '<svg class="marker-admin__svg"',
                        1,
                    )
                return format_html(
                    '<div class="marker-admin__svg-wrap" style="width:85px;height:85px;">{}</div>',
                    mark_safe(svg_content),
                )
            except OSError:
                pass
        return format_html(
            '<img src="{}" width="40" height="40" style="object-fit:contain" alt="icon">',
            file_url,
        )

    svg_thumbnail.short_description = 'Флажок'

    class Media:
        css = {
            'all': ('admin/css/marker_admin.css',),
        }


@admin.register(EventType)
class EventTypeAdmin(ModelAdmin):
    list_display = ('title',)
    search_fields = ('title',)
    list_per_page = 50


@admin.register(EventMarker)
class EventMarkerAdmin(ModelAdmin):
    list_display = ('title', 'path')
    search_fields = ('title',)
    list_per_page = 50


@admin.register(Event)
class EventAdmin(ModelAdmin):
    list_display = ('title', 'event_type', 'country', 'date_start', 'date_end')
    list_filter = ('event_type', 'country')
    search_fields = ('title', 'object_name', 'description')
    autocomplete_fields = ('event_type', 'country', 'marker')
    list_select_related = ('event_type', 'country', 'marker')
    date_hierarchy = 'date_start'
    list_per_page = 50


class OperationalSituationRevisionInline(admin.TabularInline):
    model = OperationalSituationRevision
    extra = 0
    fields = ('version', 'title', 'situation_date', 'situation_time', 'change_kind', 'created_at')
    readonly_fields = ('version', 'title', 'situation_date', 'situation_time', 'change_kind', 'created_at')
    can_delete = False
    show_change_link = True


@admin.register(OperationalSituationRevision)
class OperationalSituationRevisionAdmin(ModelAdmin):
    list_display = ('title', 'situation', 'version', 'situation_date', 'situation_time', 'change_kind', 'created_at')
    search_fields = ('title', 'situation__id')
    list_select_related = ('situation', 'created_by')
    autocomplete_fields = ('situation', 'parent_revision', 'countries', 'created_by')
    list_per_page = 50


@admin.register(OperationalSituation)
class OperationalSituationAdmin(ModelAdmin):
    list_display = ('id', 'revision_title', 'created_at', 'created_by')
    search_fields = ('id', 'revisions__title')
    list_select_related = ('current_revision', 'created_by')
    inlines = [OperationalSituationRevisionInline]
    list_per_page = 50

    @admin.display(description='Название')
    def revision_title(self, obj):
        return obj.current_revision.title if obj.current_revision else '—'


@admin.register(CountrySections)
class CountrySectionsAdmin(ModelAdmin):
    list_display = ('title', 'parent', 'order')
    list_editable = ('order',)
    autocomplete_fields = ('parent',)
    search_fields = ('title',)
    list_per_page = 50


@admin.register(FormularSections)
class FormularSectionsAdmin(ModelAdmin):
    list_display = ('title', 'parent', 'order', 'is_hidden')
    list_editable = ('order',)
    autocomplete_fields = ('parent',)
    search_fields = ('title',)
    list_per_page = 50


@admin.register(FormularAttachment)
class FormularAttachmentAdmin(ModelAdmin):
    list_display = ('title', 'target', 'section', 'created_at')
    search_fields = ('title', 'target__title', 'section__title')
    list_filter = ('section',)
    autocomplete_fields = ('target', 'section')
    list_select_related = ('target', 'section')
    list_per_page = 50


@admin.register(CountryAttachment)
class CountryAttachmentAdmin(ModelAdmin):
    list_display = ('title', 'country', 'section', 'created_at')
    search_fields = ('title', 'country__title', 'section__title')
    list_filter = ('section',)
    autocomplete_fields = ('country', 'section')
    list_select_related = ('country', 'section')
    list_per_page = 50


@admin.register(CountryInfo)
class CountryInfoAdmin(InlineOnlyModelAdmin):
    list_display = ('country', 'section')
    search_fields = ('country__title', 'section__title', 'content')
    autocomplete_fields = ('country', 'section')
    list_select_related = ('country', 'section')
    list_per_page = 50


@admin.register(Formular)
class FormularAdmin(InlineOnlyModelAdmin):
    list_display = ('target', 'section')
    search_fields = ('target__title', 'section__title', 'content')
    autocomplete_fields = ('target', 'section')
    list_select_related = ('target', 'section')
    list_per_page = 50


@admin.register(TargetType)
class TargetTypeAdmin(ModelAdmin):
    list_display = ('title', 'parent', 'order')
    list_editable = ('order',)
    autocomplete_fields = ('parent', 'countries')
    search_fields = ('title',)
    list_per_page = 50


@admin.register(PersonSections)
class PersonSectionsAdmin(ModelAdmin):
    list_display = ('title', 'parent', 'order', 'is_hidden')
    list_editable = ('order',)
    autocomplete_fields = ('parent',)
    search_fields = ('title',)
    list_per_page = 50


@admin.register(RelationType)
class RelationTypeAdmin(ModelAdmin):
    list_display = ('title', 'reverse_title')
    search_fields = ('title', 'reverse_title')
    list_per_page = 50


@admin.register(Person)
class PersonAdmin(ModelAdmin):
    list_display = ('full_name', 'position', 'target')
    search_fields = ('full_name', 'position', 'target__title')
    autocomplete_fields = ('target',)
    list_select_related = ('target',)
    list_per_page = 50
    inlines = (
        PersonInfoInlineAdmin,
        PersonPhotoInlineAdmin,
        PersonAttachmentInlineAdmin,
        PersonRelationFromInlineAdmin,
    )


@admin.register(PersonInfo)
class PersonInfoAdmin(InlineOnlyModelAdmin):
    list_display = ('person', 'section')
    search_fields = ('person__full_name', 'section__title', 'content')
    autocomplete_fields = ('person', 'section')
    list_select_related = ('person', 'section')
    list_per_page = 50


@admin.register(PersonAttachment)
class PersonAttachmentAdmin(InlineOnlyModelAdmin):
    list_display = ('title', 'person', 'section', 'created_at')
    search_fields = ('title', 'person__full_name', 'section__title')
    list_filter = ('section',)
    autocomplete_fields = ('person', 'section')
    list_select_related = ('person', 'section')
    list_per_page = 50


@admin.register(PersonPhoto)
class PersonPhotoAdmin(InlineOnlyModelAdmin):
    list_display = ('person', 'title', 'order', 'created_at')
    search_fields = ('title', 'person__full_name')
    list_filter = ('order',)
    autocomplete_fields = ('person',)
    list_select_related = ('person',)
    list_per_page = 50


@admin.register(PersonRelation)
class PersonRelationAdmin(InlineOnlyModelAdmin):
    list_display = ('person_from', 'relation_type', 'person_to', 'notes')
    search_fields = ('person_from__full_name', 'person_to__full_name', 'relation_type__title')
    autocomplete_fields = ('person_from', 'person_to', 'relation_type')
    list_select_related = ('person_from', 'person_to', 'relation_type')
    list_per_page = 50


class TargetVulnerabilityInline(admin.TabularInline):
    model = TargetVulnerability
    extra = 0
    fields = ('title', 'lat', 'lng', 'order', 'image')
    show_change_link = True


TargetAdmin.inlines = TargetAdmin.inlines + (TargetVulnerabilityInline,)


@admin.register(MapDisplaySettings)
class MapDisplaySettingsAdmin(ModelAdmin):
    list_display = ('__str__',)
    fields = ('zoom_rules',)

    def has_add_permission(self, request):
        return not MapDisplaySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        from formular.map_display_utils import validate_map_display_zoom_rules

        obj.zoom_rules = validate_map_display_zoom_rules(obj.zoom_rules)
        super().save_model(request, obj, form, change)
