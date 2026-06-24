from django import forms
from django.utils.html import format_html

from .models import Country, ActionType, Colors
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