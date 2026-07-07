from django.core.cache import cache

LOGIN_ATTEMPT_LIMIT = 5
LOGIN_ATTEMPT_WINDOW = 15 * 60


def _cache_key(ip_address, username):
    return f'login_attempts:{ip_address}:{username}'


def is_login_rate_limited(ip_address, username):
    if not ip_address:
        return False
    attempts = cache.get(_cache_key(ip_address, username), 0)
    return attempts >= LOGIN_ATTEMPT_LIMIT


def register_failed_login(ip_address, username):
    if not ip_address:
        return
    key = _cache_key(ip_address, username)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, LOGIN_ATTEMPT_WINDOW)


def clear_login_attempts(ip_address, username):
    if not ip_address:
        return
    cache.delete(_cache_key(ip_address, username))
