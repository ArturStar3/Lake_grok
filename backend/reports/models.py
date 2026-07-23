from django.conf import settings
from django.db import models


class ReportTemplate(models.Model):
    """Сохраняемый шаблон PDF-отчёта."""

    name = models.CharField(max_length=200, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='report_templates',
        verbose_name='Автор',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Шаблон отчёта'
        verbose_name_plural = 'Шаблоны отчётов'
        ordering = ['-updated_at', 'name']

    def __str__(self):
        return self.name


class ReportSection(models.Model):
    """Раздел шаблона отчёта с собственной выборкой данных."""

    class SectionType(models.TextChoices):
        COUNTRIES = 'countries', 'Страны'
        TARGETS = 'targets', 'Объекты'
        EQUIPMENT = 'equipment', 'Вооружение и техника'
        EVENTS = 'events', 'События'
        SITUATIONS = 'situations', 'Оперативная обстановка'
        ZONES = 'zones', 'Зоны действия'
        VULNERABILITIES = 'vulnerabilities', 'Уязвимости'
        COUNTRY_FULL = 'country_full', 'Полный отчёт по стране'
        OBJECTS_FULL = 'objects_full', 'Полный отчёт по объектам'

    template = models.ForeignKey(
        ReportTemplate,
        on_delete=models.CASCADE,
        related_name='sections',
        verbose_name='Шаблон',
    )
    section_type = models.CharField(
        max_length=32,
        choices=SectionType.choices,
        verbose_name='Тип раздела',
    )
    title = models.CharField(max_length=200, verbose_name='Заголовок раздела')
    order = models.PositiveIntegerField(default=0, verbose_name='Порядок')
    filters = models.JSONField(default=dict, blank=True, verbose_name='Фильтры выборки')
    page_break_before = models.BooleanField(default=True, verbose_name='Разрыв страницы перед разделом')

    class Meta:
        verbose_name = 'Раздел отчёта'
        verbose_name_plural = 'Разделы отчёта'
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.title} ({self.get_section_type_display()})'
