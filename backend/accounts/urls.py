from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetRequestViewSet,
    RegisterView,
    SecurityGroupViewSet,
    UserAdminViewSet,
)

router = DefaultRouter()
router.register(r'groups', SecurityGroupViewSet, basename='security-groups')
router.register(r'users', UserAdminViewSet, basename='auth-users')
router.register(r'password-reset-requests', PasswordResetRequestViewSet, basename='password-reset-requests')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    *router.urls,
]
