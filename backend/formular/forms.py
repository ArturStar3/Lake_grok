from django import forms

from .models import Country, ActionType, Colors, ZoneGeometryModes
from .widgets import ColorRadioSelect, HexColorInput


class CountryForm(forms.ModelForm):
    class Meta:
        model = Country
        fields = '__all__'
        widgets = {
            'color': ColorRadioSelect(enum_cls=Colors),
        }


class ActionTypeForm(forms.ModelForm):
    class Meta:
        model = ActionType
        fields = '__all__'
        widgets = {
            'color': HexColorInput(),
        }

    class Media:
        js = ('admin/js/action_type_zone_mode.js',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['min_elevation_deg'].widget.attrs['data-zone-mode-field'] = 'min_elevation_deg'

    def clean(self):
        cleaned = super().clean()
        zone_mode = cleaned.get('zone_mode')
        if zone_mode == ZoneGeometryModes.LOS_RADAR:
            if cleaned.get('min_elevation_deg') is None:
                self.add_error(
                    'min_elevation_deg',
                    'Укажите минимальный угол места для режима с учётом рельефа',
                )
        else:
            cleaned['min_elevation_deg'] = None
        if cleaned.get('is_inundation_zone') and zone_mode != ZoneGeometryModes.POLYGON:
            self.add_error(
                'is_inundation_zone',
                'Зона затопления возможна только при режиме «Полигон»',
            )
        return cleaned
