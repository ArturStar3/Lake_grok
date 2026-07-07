"""Тесты стабильности: повторные запросы, отсутствие деградации и утечек сессий."""

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from accounts.tests.base import TEST_PASSWORD, auth_header, create_user


class AuthStabilityTests(APITestCase):
    def test_repeated_login_logout_cycles(self):
        create_user('stable_user')
        for _ in range(25):
            headers = auth_header(self.client, 'stable_user', TEST_PASSWORD)
            me = self.client.get('/api/v1/auth/me/', **headers)
            self.assertEqual(me.status_code, 200)
            logout = self.client.post('/api/v1/auth/logout/', **headers)
            self.assertEqual(logout.status_code, 200)

    def test_me_endpoint_query_budget(self):
        create_user('query_user')
        headers = auth_header(self.client, 'query_user', TEST_PASSWORD)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/v1/auth/me/', **headers)
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(
            len(ctx.captured_queries),
            8,
            msg='Слишком много SQL-запросов на /auth/me/',
        )

    def test_parallel_me_reads(self):
        create_user('parallel_user')
        headers = auth_header(self.client, 'parallel_user', TEST_PASSWORD)
        for _ in range(50):
            response = self.client.get('/api/v1/auth/me/', **headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['username'], 'parallel_user')

    def test_login_response_time_budget(self):
        create_user('perf_user')
        import time

        started = time.perf_counter()
        response = self.client.post(
            '/api/v1/auth/login/',
            {'username': 'perf_user', 'password': TEST_PASSWORD},
            format='json',
        )
        elapsed_ms = (time.perf_counter() - started) * 1000
        self.assertEqual(response.status_code, 200, response.data)
        self.assertLess(elapsed_ms, 3000, f'login слишком медленный: {elapsed_ms:.0f} ms')

    def test_login_sql_query_budget(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        create_user('query_login')
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.post(
                '/api/v1/auth/login/',
                {'username': 'query_login', 'password': TEST_PASSWORD},
                format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(ctx.captured_queries), 12, msg='Слишком много SQL на login')
