from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from accounts.enums import UserStatus
from accounts.models import PasswordResetRequest, SecurityGroup, UserProfile
from accounts.password_utils import validate_password_for_user
from accounts.services.permissions import build_permissions_payload
from formular.models import Country

User = get_user_model()


class SecurityGroupSerializer(serializers.ModelSerializer):
    country_ids = serializers.PrimaryKeyRelatedField(
        source='countries',
        many=True,
        queryset=Country.objects.all(),
        required=False,
    )

    class Meta:
        model = SecurityGroup
        fields = (
            'id',
            'name',
            'description',
            'country_ids',
            'targets',
            'events',
            'operational_situations',
            'formular',
            'country_dossier',
            'persons',
            'equipment',
            'reports',
            'data_exchange',
            'can_manage_reference',
            'can_manage_users',
            'can_approve_registrations',
        )


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    registration_note = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Пользователь с таким логином уже существует')
        return value

    def validate_password(self, value):
        username = (self.initial_data.get('username') or '').strip()
        validate_password_for_user(value, username=username)
        return value

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            is_active=False,
        )
        profile = user.profile
        profile.status = UserStatus.PENDING
        profile.full_name = validated_data.get('full_name', '')
        profile.registration_note = validated_data.get('registration_note', '')
        profile.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Неверный текущий пароль')
        return value

    def validate_new_password(self, value):
        validate_password_for_user(value, user=self.context['request'].user)
        return value


class ForgotPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class PasswordResetRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.profile.full_name', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_status = serializers.CharField(source='user.profile.status', read_only=True)

    class Meta:
        model = PasswordResetRequest
        fields = (
            'id',
            'user_id',
            'username',
            'full_name',
            'user_status',
            'note',
            'status',
            'created_at',
        )
        read_only_fields = fields


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)
    must_change_password = serializers.BooleanField(required=False)

    def validate_new_password(self, value):
        if value:
            validate_password_for_user(value, user=self.context.get('user'))
        return value


class ApproveUserSerializer(serializers.Serializer):
    security_group_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )
    temporary_password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    must_change_password = serializers.BooleanField(default=True)

    def validate_temporary_password(self, value):
        if value:
            user = self.context.get('user')
            validate_password_for_user(value, user=user)
        return value


class UserAdminSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='profile.full_name', required=False, allow_blank=True)
    status = serializers.CharField(source='profile.status', required=False)
    must_change_password = serializers.BooleanField(source='profile.must_change_password', required=False)
    registration_note = serializers.CharField(source='profile.registration_note', read_only=True)
    security_group_ids = serializers.SerializerMethodField()
    approved_at = serializers.DateTimeField(source='profile.approved_at', read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'full_name',
            'status',
            'must_change_password',
            'registration_note',
            'security_group_ids',
            'is_active',
            'date_joined',
            'approved_at',
        )
        read_only_fields = ('id', 'username', 'date_joined', 'approved_at', 'registration_note')

    def get_security_group_ids(self, obj):
        return list(obj.profile.security_groups.values_list('id', flat=True))


class UserAdminUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=UserStatus.choices, required=False)
    security_group_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    must_change_password = serializers.BooleanField(required=False)


class MeSerializer(serializers.Serializer):
    def to_representation(self, user):
        profile = getattr(user, 'profile', None)
        groups = []
        if profile:
            prefetched = getattr(profile, '_prefetched_objects_cache', {}).get('security_groups')
            if prefetched is not None:
                group_iter = prefetched
            else:
                group_iter = profile.security_groups.all()
            groups = [{'id': g.id, 'name': g.name} for g in group_iter]
        perms = build_permissions_payload(user)
        return {
            'id': user.id,
            'username': user.username,
            'full_name': profile.full_name if profile else '',
            'status': profile.status if profile else UserStatus.PENDING,
            'must_change_password': profile.must_change_password if profile else False,
            'is_superuser': user.is_superuser,
            'security_groups': groups,
            'permissions': perms,
        }
