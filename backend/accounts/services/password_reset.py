from django.core.cache import cache

FORGOT_PASSWORD_LIMIT = 5
FORGOT_PASSWORD_WINDOW_SECONDS = 3600


def _cache_key(ip_address):
    return f'forgot_password:{ip_address}'


def is_forgot_password_rate_limited(ip_address):
    if not ip_address:
        return False
    return cache.get(_cache_key(ip_address), 0) >= FORGOT_PASSWORD_LIMIT


def register_forgot_password_attempt(ip_address):
    if not ip_address:
        return
    key = _cache_key(ip_address)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, FORGOT_PASSWORD_WINDOW_SECONDS)
