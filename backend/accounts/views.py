from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.enums import UserStatus
from accounts.models import SecurityGroup
from accounts.permissions import CanApproveRegistrations, CanManageUsers, get_client_ip
from accounts.serializers import (
    AdminResetPasswordSerializer,
    ApproveUserSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    MeSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    SecurityGroupSerializer,
    UserAdminSerializer,
    UserAdminUpdateSerializer,
)
from accounts.password_utils import generate_compliant_password
from accounts.services.audit import log_auth_event
from accounts.services.password_reset import is_forgot_password_rate_limited, register_forgot_password_attempt
from accounts.services.password_reset_requests import (
    create_or_refresh_password_reset_request,
    resolve_password_reset_requests,
)
from accounts.services.rate_limit import clear_login_attempts, is_login_rate_limited, register_failed_login
from accounts.models import PasswordResetRequest, PasswordResetRequestStatus

User = get_user_model()


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_auth_event(request, 'register', user=user, details=user.username)
        return Response(
            {
                'detail': 'Заявка на регистрацию отправлена. Ожидайте одобрения администратором.',
                'username': user.username,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        ip_address = get_client_ip(request)

        if not username or not password:
            return Response({'detail': 'Укажите логин и пароль'}, status=status.HTTP_400_BAD_REQUEST)

        if is_login_rate_limited(ip_address, username):
            return Response(
                {'detail': 'Слишком много попыток входа. Попробуйте позже.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            candidate = (
                User.objects.select_related('profile')
                .prefetch_related('profile__security_groups')
                .get(username__iexact=username)
            )
        except User.DoesNotExist:
            candidate = None

        if candidate and not candidate.check_password(password):
            candidate = None

        if candidate is None:
            register_failed_login(ip_address, username)
            log_auth_event(request, 'login_failed', details=username)
            return Response({'detail': 'Неверный логин или пароль'}, status=status.HTTP_401_UNAUTHORIZED)

        user = candidate
        profile = getattr(user, 'profile', None)
        if user.is_superuser:
            pass
        elif not profile or profile.status == UserStatus.PENDING:
            return Response(
                {'detail': 'Учётная запись ожидает одобрения администратором', 'status': 'pending'},
                status=status.HTTP_403_FORBIDDEN,
            )
        elif profile.status == UserStatus.BLOCKED or not user.is_active:
            return Response(
                {'detail': 'Учётная запись заблокирована', 'status': 'blocked'},
                status=status.HTTP_403_FORBIDDEN,
            )

        clear_login_attempts(ip_address, username)
        if profile:
            profile.last_login_ip = ip_address
            profile.save(update_fields=['last_login_ip'])

        tokens = _tokens_for_user(user)
        log_auth_event(request, 'login_success', user=user)
        return Response({
            **tokens,
            'user': MeSerializer().to_representation(user),
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        log_auth_event(request, 'logout', user=request.user)
        return Response({'detail': 'Выход выполнен'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = (
            User.objects.select_related('profile')
            .prefetch_related('profile__security_groups')
            .get(pk=request.user.pk)
        )
        return Response(MeSerializer().to_representation(user))


class ForgotPasswordView(APIView):
    """Офлайн-запрос на сброс пароля: администратор обрабатывает вручную."""
    permission_classes = [AllowAny]

    GENERIC_SUCCESS = (
        'Если учётная запись существует и активна, запрос отправлен администратору. '
        'Вам сообщат временный пароль.'
    )

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ip_address = get_client_ip(request)

        if is_forgot_password_rate_limited(ip_address):
            return Response(
                {'detail': 'Слишком много запросов. Попробуйте позже.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        register_forgot_password_attempt(ip_address)
        username = serializer.validated_data['username'].strip()
        note = serializer.validated_data.get('note', '')

        try:
            user = User.objects.select_related('profile').get(username__iexact=username)
        except User.DoesNotExist:
            user = None

        if user and (user.is_superuser or (
            user.is_active
            and getattr(user, 'profile', None)
            and user.profile.status == UserStatus.ACTIVE
        )):
            create_or_refresh_password_reset_request(user, note)
            log_auth_event(request, 'password_reset_requested', user=user, details=note[:200])

        return Response({'detail': self.GENERIC_SUCCESS})


class PasswordResetRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [CanManageUsers]

    def get_queryset(self):
        qs = PasswordResetRequest.objects.select_related('user', 'user__profile').order_by('-created_at')
        status_filter = self.request.query_params.get('status', PasswordResetRequestStatus.PENDING)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        reset_request = self.get_object()
        if reset_request.status != PasswordResetRequestStatus.PENDING:
            return Response({'detail': 'Запрос уже обработан'}, status=status.HTTP_400_BAD_REQUEST)
        resolve_password_reset_requests(
            reset_request.user,
            request.user,
            status=PasswordResetRequestStatus.REJECTED,
        )
        reset_request.refresh_from_db()
        return Response(PasswordResetRequestSerializer(reset_request).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        profile = getattr(user, 'profile', None)
        if profile:
            profile.must_change_password = False
            profile.save(update_fields=['must_change_password'])
        log_auth_event(request, 'password_change', user=user)
        return Response({'detail': 'Пароль успешно изменён'})


class SecurityGroupViewSet(viewsets.ModelViewSet):
    queryset = SecurityGroup.objects.prefetch_related('countries').all()
    serializer_class = SecurityGroupSerializer
    permission_classes = [CanManageUsers]


class UserAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.select_related('profile').prefetch_related('profile__security_groups').order_by('-date_joined')
    serializer_class = UserAdminSerializer
    permission_classes = [CanManageUsers]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(profile__status=status_filter)
        return qs

    @action(detail=True, methods=['post'], url_path='approve', permission_classes=[CanApproveRegistrations])
    @transaction.atomic
    def approve(self, request, pk=None):
        user = self.get_object()
        profile = user.profile
        serializer = ApproveUserSerializer(data=request.data, context={'user': user})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        groups = SecurityGroup.objects.filter(id__in=data['security_group_ids'])
        if groups.count() != len(set(data['security_group_ids'])):
            return Response({'detail': 'Некорректные группы безопасности'}, status=status.HTTP_400_BAD_REQUEST)

        temp_password = data.get('temporary_password')
        if temp_password:
            user.set_password(temp_password)
            user.save()

        profile.security_groups.set(groups)
        profile.status = UserStatus.ACTIVE
        profile.approved_by = request.user
        profile.approved_at = timezone.now()
        profile.must_change_password = data.get('must_change_password', True)
        user.is_active = True
        user.save(update_fields=['is_active'])
        profile.save()

        log_auth_event(request, 'user_approved', user=user, details=f'groups={list(groups.values_list("name", flat=True))}')
        return Response(UserAdminSerializer(user).data)

    @action(detail=True, methods=['post'], url_path='reset-password', permission_classes=[CanManageUsers])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminResetPasswordSerializer(data=request.data, context={'user': user})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        new_password = data.get('new_password')
        if not new_password:
            new_password = generate_compliant_password()

        user.set_password(new_password)
        user.save()
        profile = user.profile
        if 'must_change_password' in data:
            profile.must_change_password = data['must_change_password']
        else:
            profile.must_change_password = True
        profile.save(update_fields=['must_change_password'])
        resolve_password_reset_requests(user, request.user)
        log_auth_event(request, 'password_reset', user=user, details='admin reset')
        return Response({
            'detail': 'Пароль сброшен',
            'temporary_password': new_password,
            'must_change_password': profile.must_change_password,
        })

    @action(detail=True, methods=['patch'], url_path='manage')
    @transaction.atomic
    def manage(self, request, pk=None):
        user = self.get_object()
        serializer = UserAdminUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile = user.profile

        if 'status' in data:
            profile.status = data['status']
            user.is_active = data['status'] == UserStatus.ACTIVE
            user.save(update_fields=['is_active'])
            if data['status'] == UserStatus.BLOCKED:
                log_auth_event(request, 'user_blocked', user=user)

        if 'security_group_ids' in data:
            groups = SecurityGroup.objects.filter(id__in=data['security_group_ids'])
            profile.security_groups.set(groups)

        if 'must_change_password' in data:
            profile.must_change_password = data['must_change_password']

        profile.save()
        return Response(UserAdminSerializer(user).data)
