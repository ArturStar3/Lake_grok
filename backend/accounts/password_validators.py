import re

from django.core.exceptions import ValidationError

class PasswordComplexityValidator:
    """Стандартные требования: регистр и цифра."""

    def validate(self, password, user=None):
        errors = []
        if not re.search(r'[A-ZА-ЯЁ]', password):
            errors.append('заглавную букву')
        if not re.search(r'[a-zа-яё]', password):
            errors.append('строчную букву')
        if not re.search(r'\d', password):
            errors.append('цифру')
        if errors:
            raise ValidationError(
                'Пароль должен содержать: ' + ', '.join(errors) + '.',
                code='password_too_simple',
            )

    def get_help_text(self):
        return (
            'Пароль должен быть не короче 8 символов и содержать заглавные и строчные '
            'буквы и цифру.'
        )
