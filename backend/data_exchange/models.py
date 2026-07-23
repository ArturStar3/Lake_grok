import uuid

from django.conf import settings
from django.db import models


class ImportSession(models.Model):
    class Status(models.TextChoices):
        ANALYZING = 'analyzing', 'Анализ'
        READY = 'ready', 'Готово к применению'
        APPLYING = 'applying', 'Применение'
        APPLIED = 'applied', 'Применено'
        CANCELLED = 'cancelled', 'Отменено'
        FAILED = 'failed', 'Ошибка'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ANALYZING)
    manifest = models.JSONField(default=dict, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    bundle_path = models.CharField(max_length=500, blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='data_exchange_sessions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Сессия импорта'
        verbose_name_plural = 'Сессии импорта'
        ordering = ['-created_at']

    def __str__(self):
        return f'ImportSession {self.id} ({self.status})'


class ImportItem(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'Новая'
        UNCHANGED = 'unchanged', 'Без изменений'
        CONFLICT = 'conflict', 'Конфликт'
        AMBIGUOUS = 'ambiguous', 'Неоднозначно'

    class Decision(models.TextChoices):
        PENDING = 'pending', 'Ожидает'
        KEEP_LOCAL = 'keep_local', 'Оставить локальное'
        USE_IMPORTED = 'use_imported', 'Использовать импортированное'
        MERGE = 'merge', 'Объединить'

    session = models.ForeignKey(
        ImportSession,
        on_delete=models.CASCADE,
        related_name='items',
    )
    entity_type = models.CharField(max_length=64)
    natural_key = models.CharField(max_length=500)
    status = models.CharField(max_length=16, choices=Status.choices)
    decision = models.CharField(
        max_length=16,
        choices=Decision.choices,
        default=Decision.PENDING,
    )
    local_snapshot = models.JSONField(default=dict, blank=True)
    imported_snapshot = models.JSONField(default=dict, blank=True)
    label = models.CharField(max_length=500, blank=True, default='')

    class Meta:
        verbose_name = 'Элемент импорта'
        verbose_name_plural = 'Элементы импорта'
        indexes = [
            models.Index(fields=('session', 'entity_type')),
            models.Index(fields=('session', 'status')),
        ]

    def __str__(self):
        return f'{self.entity_type}:{self.natural_key} ({self.status})'
