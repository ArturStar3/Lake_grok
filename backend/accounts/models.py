from django.conf import settings
from django.db import models

from .enums import ModuleLevel, UserStatus


class SecurityGroup(models.Model):
    """Группа безопасности: страны и права на модули."""

    name = models.CharField(max_length=150, unique=True, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    countries = models.ManyToManyField(
        'formular.Country',
        blank=True,
        related_name='security_groups',
        verbose_name='Доступные страны',
        help_text='Пустой список — нет доступа к данным стран',
    )
    targets = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE, verbose_name='Объекты',
    )
    events = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE, verbose_name='События',
    )
    formular = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE, verbose_name='Формуляр',
    )
    country_dossier = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE, verbose_name='Досье страны',
    )
    persons = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE, verbose_name='Персоналии',
    )
    equipment = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE, verbose_name='Техника',
    )
    operational_situations = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE,
        verbose_name='Оперативная обстановка',
    )
    reports = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE,
        verbose_name='Отчёты',
    )
    data_exchange = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE,
        verbose_name='Импорт/экспорт данных',
    )
    demo_scenarios = models.CharField(
        max_length=16, choices=ModuleLevel.choices, default=ModuleLevel.NONE,
        verbose_name='Сценарии демонстрации',
    )
    can_manage_reference = models.BooleanField(default=False, verbose_name='Справочники')
    can_manage_users = models.BooleanField(default=False, verbose_name='Управление пользователями')
    can_approve_registrations = models.BooleanField(default=False, verbose_name='Одобрение регистраций')

    class Meta:
        verbose_name = 'Группа безопасности'
        verbose_name_plural = 'Группы безопасности'
        ordering = ['name']

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    """Профиль пользователя приложения."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name='Пользователь',
    )
    status = models.CharField(
        max_length=20,
        choices=UserStatus.choices,
        default=UserStatus.PENDING,
        verbose_name='Статус',
    )
    security_groups = models.ManyToManyField(
        SecurityGroup,
        blank=True,
        related_name='users',
        verbose_name='Группы безопасности',
    )
    must_change_password = models.BooleanField(default=False, verbose_name='Требуется смена пароля')
    full_name = models.CharField(max_length=200, blank=True, verbose_name='ФИО')
    registration_note = models.TextField(blank=True, verbose_name='Комментарий при регистрации')
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_users',
        verbose_name='Одобрил',
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата одобрения')
    last_login_ip = models.GenericIPAddressField(null=True, blank=True, verbose_name='Последний IP')

    class Meta:
        verbose_name = 'Профиль пользователя'
        verbose_name_plural = 'Профили пользователей'

    def __str__(self):
        return self.full_name or self.user.username


class PasswordResetRequestStatus(models.TextChoices):
    PENDING = 'pending', 'Ожидает'
    RESOLVED = 'resolved', 'Выполнен'
    REJECTED = 'rejected', 'Отклонён'


class PasswordResetRequest(models.Model):
    """Запрос пользователя на сброс пароля (офлайн, без email)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_requests',
        verbose_name='Пользователь',
    )
    note = models.TextField(blank=True, verbose_name='Комментарий пользователя')
    status = models.CharField(
        max_length=20,
        choices=PasswordResetRequestStatus.choices,
        default=PasswordResetRequestStatus.PENDING,
        verbose_name='Статус',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='Обработан')
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='handled_password_reset_requests',
        verbose_name='Обработал',
    )

    class Meta:
        verbose_name = 'Запрос сброса пароля'
        verbose_name_plural = 'Запросы сброса пароля'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} ({self.get_status_display()})'


class AuthAuditLog(models.Model):
    """Журнал событий аутентификации и управления доступом."""

    class Action(models.TextChoices):
        LOGIN_SUCCESS = 'login_success', 'Успешный вход'
        LOGIN_FAILED = 'login_failed', 'Неудачный вход'
        LOGOUT = 'logout', 'Выход'
        REGISTER = 'register', 'Регистрация'
        PASSWORD_CHANGE = 'password_change', 'Смена пароля'
        PASSWORD_RESET = 'password_reset', 'Сброс пароля'
        PASSWORD_RESET_REQUESTED = 'password_reset_requested', 'Запрос сброса пароля'
        USER_APPROVED = 'user_approved', 'Одобрение пользователя'
        USER_BLOCKED = 'user_blocked', 'Блокировка пользователя'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='auth_audit_logs',
        verbose_name='Пользователь',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='auth_actions',
        verbose_name='Инициатор',
    )
    action = models.CharField(max_length=30, choices=Action.choices, verbose_name='Действие')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP')
    details = models.TextField(blank=True, verbose_name='Детали')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Время')

    class Meta:
        verbose_name = 'Запись аудита'
        verbose_name_plural = 'Журнал аудита'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} ({self.created_at})'


class MapFavoriteKind(models.TextChoices):
    OBJECT = 'object', 'Объект'
    EVENT = 'event', 'Событие'
    FORMULAR = 'formular', 'Формуляр'
    SITUATION = 'situation', 'Обстановка'


MAP_FAVORITES_MAX = 24


class MapFavorite(models.Model):
    """Персональное избранное карты: объект, событие, пункт формуляра или обстановка."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='map_favorites',
        verbose_name='Пользователь',
    )
    kind = models.CharField(
        max_length=16,
        choices=MapFavoriteKind.choices,
        verbose_name='Тип',
    )
    entity_id = models.CharField(max_length=128, verbose_name='Идентификатор сущности')
    card_id = models.CharField(max_length=128, blank=True, default='', verbose_name='Раздел формуляра')
    title = models.CharField(max_length=160, verbose_name='Подпись')
    source_title = models.CharField(max_length=160, blank=True, default='', verbose_name='Исходное название')
    subtitle = models.CharField(max_length=160, blank=True, default='', verbose_name='Подзаголовок')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Избранное карты'
        verbose_name_plural = 'Избранное карты'
        ordering = ['created_at', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=('user', 'kind', 'entity_id', 'card_id'),
                name='uniq_map_favorite_user_entity',
            ),
        ]

    def __str__(self):
        return f'{self.user_id}: {self.title}'
