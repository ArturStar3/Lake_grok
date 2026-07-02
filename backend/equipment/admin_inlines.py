from infolake.admin_base import TabularInline

from .models import EquipmentParameterValue, EquipmentImage


class EquipmentParameterValueInlineAdmin(TabularInline):
    """Значения ТТХ образца техники"""

    model = EquipmentParameterValue
    fields = (
        'parameter',
        'value',
    )
    autocomplete_fields = ('parameter',)
    extra = 1
    show_change_link = True
    tab = True


class EquipmentImageInlineAdmin(TabularInline):
    """Изображения образца техники"""

    model = EquipmentImage
    fields = ('title', 'image', 'order')
    extra = 1
    show_change_link = True
    tab = True
