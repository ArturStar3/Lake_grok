"""API-тесты аутентификации и управления пользователями."""

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.enums import UserStatus
from accounts.models import AuthAuditLog, PasswordResetRequest
from accounts.tests.base import (
    ADMIN_PASSWORD,
    TEST_PASSWORD,
    auth_header,
    create_admin_group,
    create_country,
    create_user,
)

User = get_user_model()


class AuthApiTests(APITestCase):
    def test_register_pending_user(self):
        response = self.client.post(
            '/api/v1/auth/register/',
            {
                'username': 'newuser',
                'password': TEST_PASSWORD,
                'full_name': 'Новый Пользователь',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='newuser')
        self.assertFalse(user.is_active)
        self.assertEqual(user.profile.status, UserStatus.PENDING)
        self.assertTrue(AuthAuditLog.objects.filter(action='register', user=user).exists())

    def test_login_rejects_pending_user(self):
        create_user('pending1', active=False)
        response = self.client.post(
            '/api/v1/auth/login/',
            {'username': 'pending1', 'password': TEST_PASSWORD},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['status'], 'pending')

    def test_login_success_and_me(self):
        create_user('active1')
        headers = auth_header(self.client, 'active1', TEST_PASSWORD)
        response = self.client.get('/api/v1/auth/me/', **headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'active1')
        self.assertEqual(response.data['status'], UserStatus.ACTIVE)
        self.assertIn('permissions', response.data)

    def test_change_password(self):
        create_user('chpass')
        headers = auth_header(self.client, 'chpass', TEST_PASSWORD)
        response = self.client.post(
            '/api/v1/auth/change-password/',
            {'current_password': TEST_PASSWORD, 'new_password': 'NewPass2x'},
            format='json',
            **headers,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(username='chpass')
        self.assertTrue(user.check_password('NewPass2x'))
        self.assertFalse(user.profile.must_change_password)

    def test_forgot_password_creates_request(self):
        create_user('forgot1')
        response = self.client.post(
            '/api/v1/auth/forgot-password/',
            {'username': 'forgot1', 'note': 'Забыл пароль'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(username='forgot1')
        self.assertTrue(
            PasswordResetRequest.objects.filter(user=user, status='pending').exists()
        )

    def test_admin_approve_registration_flow(self):
        country = create_country()
        admin_group = create_admin_group()
        admin_group.countries.add(country)
        admin = create_user('admin1', password=ADMIN_PASSWORD, groups=[admin_group])

        self.client.post(
            '/api/v1/auth/register/',
            {'username': 'approve_me', 'password': TEST_PASSWORD},
            format='json',
        )
        pending = User.objects.get(username='approve_me')

        admin_headers = auth_header(self.client, 'admin1', ADMIN_PASSWORD)
        response = self.client.post(
            f'/api/v1/auth/users/{pending.id}/approve/',
            {
                'security_group_ids': [admin_group.id],
                'must_change_password': True,
            },
            format='json',
            **admin_headers,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending.refresh_from_db()
        self.assertTrue(pending.is_active)
        self.assertEqual(pending.profile.status, UserStatus.ACTIVE)

        login = self.client.post(
            '/api/v1/auth/login/',
            {'username': 'approve_me', 'password': TEST_PASSWORD},
            format='json',
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_security_groups_crud_requires_permission(self):
        create_user('regular')
        admin_group = create_admin_group()
        admin = create_user('sg_admin', password=ADMIN_PASSWORD, groups=[admin_group])

        regular_headers = auth_header(self.client, 'regular', TEST_PASSWORD)
        denied = self.client.get('/api/v1/auth/groups/', **regular_headers)
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        admin_headers = auth_header(self.client, 'sg_admin', ADMIN_PASSWORD)
        allowed = self.client.get('/api/v1/auth/groups/', **admin_headers)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(allowed.data), 1)
