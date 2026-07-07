from django import forms
from django.contrib.auth.forms import UserCreationForm
from unfold.widgets import UnfoldAdminTextInputWidget, UnfoldBooleanWidget


class ChangePasswordForm(forms.Form):
    new_password = forms.CharField(
        label='Новый пароль',
        required=False,
        widget=UnfoldAdminTextInputWidget(attrs={
            'type': 'password',
            'autocomplete': 'new-password',
            'placeholder': 'Оставьте пустым для автогенерации',
        }),
        help_text='Оставьте пустым — пароль будет сгенерирован автоматически.',
    )
    must_change_password = forms.BooleanField(
        label='Требуется смена пароля',
        required=False,
        initial=True,
        widget=UnfoldBooleanWidget(),
        help_text='Пользователь обязан сменить пароль при следующем входе.',
    )


class UserAdminCreationForm(UserCreationForm):
    must_change_password = forms.BooleanField(
        label='Требуется смена пароля',
        required=False,
        initial=True,
        widget=UnfoldBooleanWidget(),
    )

    def save(self, commit=True):
        user = super().save(commit=commit)
        if commit and user.pk:
            profile = user.profile
            profile.must_change_password = self.cleaned_data.get('must_change_password', True)
            profile.save(update_fields=['must_change_password'])
        return user
