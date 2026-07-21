from django import forms
from django.contrib.auth.forms import AdminUserCreationForm
from unfold.widgets import UnfoldAdminTextInputWidget, UnfoldBooleanWidget

from .enums import UserStatus
from .models import UserProfile


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


class UserAdminCreationForm(AdminUserCreationForm):
    username = forms.CharField(
        widget=UnfoldAdminTextInputWidget(attrs={'autocomplete': 'username'}),
    )
    password1 = forms.CharField(
        label='Пароль',
        widget=UnfoldAdminTextInputWidget(attrs={
            'type': 'password',
            'autocomplete': 'new-password',
        }),
    )
    password2 = forms.CharField(
        label='Подтверждение пароля',
        widget=UnfoldAdminTextInputWidget(attrs={
            'type': 'password',
            'autocomplete': 'new-password',
        }),
    )
    must_change_password = forms.BooleanField(
        label='Требуется смена пароля',
        required=False,
        initial=True,
        widget=UnfoldBooleanWidget(),
    )

    def save(self, commit=True):
        user = super().save(commit=commit)
        if commit and user.pk:
            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'status': UserStatus.ACTIVE if user.is_superuser else UserStatus.PENDING,
                    'full_name': user.get_full_name() or '',
                },
            )
            profile.must_change_password = self.cleaned_data.get('must_change_password', True)
            profile.save(update_fields=['must_change_password'])
        return user
