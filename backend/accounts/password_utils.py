import secrets
import string

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

_PASSWORD_POOL = string.ascii_lowercase + string.ascii_uppercase + string.digits


def validate_password_for_user(password, user=None, username=None):
    """Проверка пароля с учётом логина (для регистрации до создания User)."""
    if user is None and username:
        user = User(username=username)
    validate_password(password, user)


def generate_compliant_password(length=12):
    """Временный пароль, удовлетворяющий политике сложности."""
    if length < 8:
        length = 8
    required = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
    ]
    extra = [secrets.choice(_PASSWORD_POOL) for _ in range(length - len(required))]
    chars = required + extra
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)
