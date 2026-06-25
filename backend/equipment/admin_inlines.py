from infolake.admin_base import TabularInline

from .models import EquipmentParameterValue


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
