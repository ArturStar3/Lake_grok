from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.core.exceptions import ValidationError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils.translation import gettext_lazy as _
from unfold.decorators import action

from infolake.admin_base import ModelAdmin, TabularInline

from .admin_forms import ChangePasswordForm, UserAdminCreationForm
from .models import AuthAuditLog, PasswordResetRequest, SecurityGroup, UserProfile
from .password_utils import generate_compliant_password, validate_password_for_user
from .services.audit import log_auth_event
from .services.password_reset_requests import resolve_password_reset_requests

User = get_user_model()


class UserProfileInline(TabularInline):
    model = UserProfile
    fk_name = 'user'
    extra = 0
    filter_horizontal = ('security_groups',)
    fields = (
        'status',
        'full_name',
        'security_groups',
        'registration_note',
        'approved_by',
        'approved_at',
        'last_login_ip',
    )
    readonly_fields = ('approved_by', 'approved_at', 'last_login_ip')


@admin.register(SecurityGroup)
class SecurityGroupAdmin(ModelAdmin):
    list_display = (
        'name',
        'targets',
        'events',
        'operational_situations',
        'formular',
        'country_dossier',
        'can_manage_users',
    )
    filter_horizontal = ('countries',)
    search_fields = ('name',)


@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_display = ('user', 'full_name', 'status', 'must_change_password', 'approved_at')
    list_filter = ('status', 'must_change_password')
    filter_horizontal = ('security_groups',)
    search_fields = ('user__username', 'full_name')
    autocomplete_fields = ('user', 'approved_by')
    readonly_fields = ('approved_by', 'approved_at', 'last_login_ip')
    fields = (
        'user',
        'full_name',
        'status',
        'must_change_password',
        'security_groups',
        'registration_note',
        'approved_by',
        'approved_at',
        'last_login_ip',
    )

@admin.register(PasswordResetRequest)
class PasswordResetRequestAdmin(ModelAdmin):
    list_display = ('user', 'status', 'note_preview', 'created_at', 'resolved_at', 'resolved_by')
    list_filter = ('status',)
    list_filter_submit = True
    search_fields = ('user__username', 'note')
    readonly_fields = ('user', 'note', 'status', 'created_at', 'resolved_at', 'resolved_by')

    @admin.display(description='Комментарий')
    def note_preview(self, obj):
        if not obj.note:
            return '—'
        return obj.note if len(obj.note) <= 80 else f'{obj.note[:77]}…'


@admin.register(AuthAuditLog)
class AuthAuditLogAdmin(ModelAdmin):
    list_display = ('created_at', 'action', 'user', 'actor', 'ip_address')
    list_filter = ('action',)
    list_filter_submit = True
    search_fields = ('user__username', 'details')
    readonly_fields = ('created_at', 'action', 'user', 'actor', 'ip_address', 'details')


class UserAdmin(DjangoUserAdmin, ModelAdmin):
    add_form = UserAdminCreationForm
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'usable_password', 'password1', 'password2', 'must_change_password'),
        }),
    )
    inlines = [UserProfileInline]
    actions_detail = ['change_password']
    compressed_fields = True
    warn_unsaved_form = False

    def get_fieldsets(self, request, obj=None):
        if not obj:
            return super().get_fieldsets(request, obj)

        fieldsets = []
        for name, options in super().get_fieldsets(request, obj):
            fields = tuple(f for f in options.get('fields', ()) if f != 'password')
            if not fields:
                continue
            fieldsets.append((name, {**options, 'fields': fields}))
        return fieldsets

    @action(
        description=_('Изменить пароль'),
        url_path='change-password',
        icon='lock_reset',
    )
    def change_password(self, request: HttpRequest, object_id: str) -> HttpResponse:
        user = get_object_or_404(User.objects.select_related('profile'), pk=object_id)
        profile = user.profile
        generated_password = None
        must_change_password = bool(profile.must_change_password)

        if request.method == 'GET':
            form = ChangePasswordForm(initial={'must_change_password': True})
        else:
            form = ChangePasswordForm(request.POST)

        if request.method == 'POST' and form.is_valid():
            password = form.cleaned_data['new_password'] or generate_compliant_password()
            must_change_password = form.cleaned_data['must_change_password']
            try:
                validate_password_for_user(password, user=user)
            except ValidationError as exc:
                form.add_error('new_password', ' '.join(exc.messages))
            else:
                user.set_password(password)
                user.save(update_fields=['password'])
                profile.must_change_password = must_change_password
                profile.save(update_fields=['must_change_password'])
                resolve_password_reset_requests(user, request.user)
                log_auth_event(
                    request,
                    'password_reset',
                    user=user,
                    actor=request.user,
                    details='must_change' if must_change_password else 'permanent',
                )
                generated_password = password
                form = ChangePasswordForm(initial={'must_change_password': must_change_password})

        return render(
            request,
            'admin/accounts/change_password.html',
            {
                'form': form,
                'user': user,
                'must_change_password': must_change_password,
                'generated_password': generated_password,
                'title': _('Изменить пароль: %(username)s') % {'username': user.username},
                **self.admin_site.each_context(request),
            },
        )


admin.site.unregister(User)
admin.site.register(User, UserAdmin)
