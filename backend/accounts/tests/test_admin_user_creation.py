"""Создание пользователя через Django Admin не ломает API и профиль."""

import re

from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import UserProfile
from accounts.tests.base import ADMIN_PASSWORD, TEST_PASSWORD, auth_header, create_user

User = get_user_model()


def _admin_add_user_post_data(get_response, username, password=TEST_PASSWORD):
    """Минимальный набор полей для admin auth user add (+ inline formset)."""
    html = get_response.content.decode()
    csrf_match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', html)
    if not csrf_match:
        raise AssertionError('CSRF token not found on admin add user page')
    data = {
        'csrfmiddlewaretoken': csrf_match.group(1),
        'username': username,
        'usable_password': 'true',
        'password1': password,
        'password2': password,
        'must_change_password': 'on',
    }
    prefix = 'profile'
    for name in (
        f'{prefix}-TOTAL_FORMS',
        f'{prefix}-INITIAL_FORMS',
        f'{prefix}-MIN_NUM_FORMS',
        f'{prefix}-MAX_NUM_FORMS',
    ):
        match = re.search(rf'name="{re.escape(name)}" value="([^"]*)"', html)
        if match:
            data[name] = match.group(1)
    return data


class AdminUserCreationStabilityTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser('admin_stability', '', ADMIN_PASSWORD)
        create_user('api_parallel_user')

    def test_admin_create_user_then_api_me_still_works(self):
        admin = Client(enforce_csrf_checks=True)
        admin.force_login(self.superuser)

        add_url = reverse('admin:auth_user_add')
        get_resp = admin.get(add_url)
        self.assertEqual(get_resp.status_code, 200)

        post_data = _admin_add_user_post_data(get_resp, 'created_via_admin')
        post_resp = admin.post(add_url, post_data, follow=True)
        self.assertEqual(post_resp.status_code, 200)
        self.assertTrue(User.objects.filter(username='created_via_admin').exists())

        profiles = UserProfile.objects.filter(user__username='created_via_admin')
        self.assertEqual(profiles.count(), 1)

        api_headers = auth_header(self.client, 'api_parallel_user', TEST_PASSWORD)
        me = self.client.get('/api/v1/auth/me/', **api_headers)
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data['username'], 'api_parallel_user')

    def test_user_admin_creation_form_save_idempotent_profile(self):
        from accounts.admin_forms import UserAdminCreationForm

        form = UserAdminCreationForm(data={
            'username': 'form_created',
            'usable_password': 'true',
            'password1': TEST_PASSWORD,
            'password2': TEST_PASSWORD,
            'must_change_password': True,
        })
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertEqual(UserProfile.objects.filter(user=user).count(), 1)
