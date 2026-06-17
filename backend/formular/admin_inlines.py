from django.contrib import admin
from django.db.models import Q

from .models import (
    Target,
    TargetAction,
    CountryInfo,
    Formular,
    CountrySections
) 

class TargetInlineAdmin(admin.TabularInline):
    """Вложенная админка по объектам разведки"""

    model = Target
    fields = (
        'title',
        'lat',
        'lng'
    )
    readonly_fields = (
                'title',
                'lat',
                'lng'
    )
    extra = 0
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


class TargetInlineAdmin_2(admin.TabularInline):
    """
    Вложенная админка по объектам разведки
    с полем Страна
    """

    model = Target
    fields = (
        'title',
        'lat',
        'lng',
        'country'
    )
    readonly_fields = (
                'title',
                'lat',
                'lng',
                'country'
    )
    extra = 0
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False
    
class TargetActionInlineAdmin(admin.TabularInline):
    """Вложенная админка по действиям объектов"""

    model = TargetAction
    fields = (
        'action_type',
        'radius'
    )
    raw_id_fields = ('action_type',)
    extra = 1
    show_change_link = True

class CountryInfoInlineAdmin(admin.TabularInline):
    """Вложенная админка по информации по стране"""

    model = CountryInfo
    fields = (
        'section',
        'content'
    )
    raw_id_fields = ('country', 'section')
    extra = 0
    show_change_link = True

class FormularInlineAdmin(admin.TabularInline):
    """Вложенная админка по формулярам"""

    model = Formular
    fields = (
        'section',
        'content'
    )
    raw_id_fields = ('section',)
    extra = 0
    show_change_link = True


class TargetChildrenInline(admin.TabularInline):
    """Вложенная админка для просмотра непосредственно подчинённых объектов (по parent)"""

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
    readonly_fields = (
        'title',
        'label',
        'type',
        'marker',
        'lat',
        'lng',
        'action_radius',
    )
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
