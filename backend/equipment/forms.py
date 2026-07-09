from django import forms

from formular.enums import ActionLineTypes
from formular.widgets import HexColorInput

from .models import EquipmentParameterDefinition


class EquipmentParameterDefinitionForm(forms.ModelForm):
    inherit_zone_color = forms.BooleanField(
        required=False,
        label='Наследовать цвет от типа действия',
        help_text='Если включено, цвет зоны берётся из типа действия (в БД пусто).',
    )
    inherit_zone_line_type = forms.BooleanField(
        required=False,
        label='Наследовать тип линии от типа действия',
        help_text='Если включено, тип линии берётся из типа действия (в БД пусто).',
    )

    class Meta:
        model = EquipmentParameterDefinition
        fields = '__all__'
        widgets = {
            'zone_color': HexColorInput(),
        }

    class Media:
        js = ('admin/js/parameter_zone_style.js',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['zone_color'].required = False
        self.fields['zone_line_type'].required = False
        self.fields['zone_line_type'].choices = [
            ('', '— выберите тип линии —'),
            *ActionLineTypes.choices,
        ]

        if self.instance.pk:
            self.fields['inherit_zone_color'].initial = not bool(self.instance.zone_color)
            self.fields['inherit_zone_line_type'].initial = not bool(self.instance.zone_line_type)
            if self.instance.zone_color:
                self.initial.setdefault('zone_color', self.instance.zone_color)
            elif self.instance.action_type_id:
                self.initial.setdefault(
                    'zone_color',
                    self.instance.get_effective_zone_color(),
                )
        else:
            self.fields['inherit_zone_color'].initial = True
            self.fields['inherit_zone_line_type'].initial = True

    def clean(self):
        cleaned = super().clean()

        action_type = cleaned.get('action_type')
        if not action_type:
            cleaned['zone_color'] = None
            cleaned['zone_line_type'] = None
            return cleaned

        if cleaned.get('inherit_zone_color'):
            cleaned['zone_color'] = None
        elif not cleaned.get('zone_color'):
            self.add_error(
                'zone_color',
                'Укажите цвет зоны или включите наследование от типа действия.',
            )

        if cleaned.get('inherit_zone_line_type'):
            cleaned['zone_line_type'] = None
        elif not cleaned.get('zone_line_type'):
            self.add_error(
                'zone_line_type',
                'Укажите тип линии или включите наследование от типа действия.',
            )

        return cleaned
