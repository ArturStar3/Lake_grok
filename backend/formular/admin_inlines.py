from infolake.admin_base import TabularInline

from .models import (
    Target,
    TargetEquipment,
    TargetAction,
    CountryInfo,
    Formular,
    Person,
)


class TargetInlineAdmin(TabularInline):
    """Вложенная админка по объектам разведки"""

    model = Target
    fields = (
        'title',
        'lat',
        'lng',
    )
    readonly_fields = fields
    extra = 0
    show_change_link = True
    tab = True

    def has_add_permission(self, request, obj=None):
        return False


class TargetInlineAdmin_2(TabularInline):
    """Вложенная админка по объектам разведки с полем Страна"""

    model = Target
    fields = (
        'title',
        'lat',
        'lng',
        'country',
    )
    readonly_fields = fields
    extra = 0
    show_change_link = True
    tab = True

    def has_add_permission(self, request, obj=None):
        return False


class TargetEquipmentInlineAdmin(TabularInline):
    """Вооружение и техника на объекте"""

    model = TargetEquipment
    fk_name = 'target'
    fields = (
        'equipment',
        'quantity',
    )
    autocomplete_fields = ('equipment',)
    extra = 1
    show_change_link = False
    hide_title = True
    tab = True
    verbose_name = 'Вооружение и техника'
    verbose_name_plural = 'Вооружение и техника'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('equipment')


class TargetActionInlineAdmin(TabularInline):
    """Вложенная админка по действиям объектов"""

    model = TargetAction
    fields = (
        'action_type',
        'radius',
    )
    autocomplete_fields = ('action_type',)
    extra = 1
    show_change_link = True
    tab = True


class CountryInfoInlineAdmin(TabularInline):
    """Вложенная админка по информации по стране"""

    model = CountryInfo
    fields = (
        'section',
        'content',
    )
    autocomplete_fields = ('section',)
    extra = 0
    show_change_link = True
    tab = True


class FormularInlineAdmin(TabularInline):
    """Вложенная админка по формулярам"""

    model = Formular
    fields = (
        'section',
        'content',
    )
    autocomplete_fields = ('section',)
    extra = 0
    show_change_link = True
    tab = True


class TargetChildrenInline(TabularInline):
    """Просмотр непосредственно подчинённых объектов"""

    model = Target
    fk_name = 'parent'
    fields = (
        'title',
        'label',
        'type',
        'marker',
        'lat',
        'lng',
        'action_radius',
    )
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True
    tab = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class PersonInlineAdmin(TabularInline):
    """Персоналии объекта"""

    model = Person
    fields = (
        'full_name',
        'position',
    )
    extra = 0
    show_change_link = True
    tab = True
    verbose_name = 'Лицо'
    verbose_name_plural = 'Персоналии'
