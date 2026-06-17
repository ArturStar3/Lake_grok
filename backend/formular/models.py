import uuid

from django.db import models
from django.core.validators import (
    MaxValueValidator,
    MinValueValidator
)
from django.core.exceptions import ValidationError

from .enums import (
    Colors,
    ActionAnimations
)
from .validators import (
    validate_svg
)


class Country(models.Model):
    """Список стран"""

    title = models.CharField(
        max_length=150,
        verbose_name="Страна",
        unique=True
    )
    title_short = models.CharField(
        max_length=10,
        verbose_name = 'Сокращение'
    )
    iso_code = models.CharField(
        max_length=3,
        # unique=True,
        verbose_name='ISO код страны',
    )
    color = models.CharField(
        max_length=20,
        choices=Colors.choices(),
        verbose_name = 'Цвет маркера',
        default = Colors.blue.name
    )


    class Meta:
        verbose_name = 'Страна'
        verbose_name_plural = 'Страны'
        indexes = [
            models.Index(fields=('title',)),
            models.Index(fields=('title_short',))
        ]
    
    def __str__(self):
        return self.title
    
class CountrySections(models.Model):
    """Разделы для информации по странам"""

    title = models.CharField(
        max_length=250,
        verbose_name='Название раздела'
    )
    order = models.PositiveSmallIntegerField(
        verbose_name='Порядок',
        default=1,
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        verbose_name='Родительский раздел',
        related_name='children',
        null=True,
        blank=True
    )
    is_hidden = models.BooleanField(
        verbose_name='Скрыть раздел',
        default=False
    )

    def clean(self):
        if self.parent == self:
            raise ValidationError(
                {'parent': 'Раздел не может быть родителем самого себя'}
            )

    def __str__(self):
        return self.title
    
    class Meta:
        verbose_name = 'Раздел информации по стране'
        verbose_name_plural = 'Разделы информации по странам'
        indexes = [
            models.Index(fields=('title',)),
        ]
        ordering = ['order',]

class CountryInfo(models.Model):
    """Информация по странам"""

    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        verbose_name='Страна',
        related_name='country_infos'
    )
    section = models.ForeignKey(
        CountrySections,
        on_delete=models.CASCADE,
        verbose_name='Раздел',
        related_name='country_sections'
    )
    content = models.TextField(
        verbose_name='Содержание',
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.country.title} - {self.section.title}"
    
    class Meta:
        verbose_name = 'Информация по стране'
        verbose_name_plural = 'Информация по странам'
        indexes = [
            models.Index(fields=('country',)),
            models.Index(fields=('section',))
        ]


class CountryAttachment(models.Model):
    """Изображения для информации по стране"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор'
    )
    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        related_name='country_attachments',
        verbose_name='Страна'
    )
    section = models.ForeignKey(
        CountrySections,
        on_delete=models.CASCADE,
        related_name='country_attachments',
        verbose_name='Раздел информации по стране'
    )
    title = models.CharField(
        max_length=250,
        verbose_name='Название'
    )
    description = models.TextField(
        verbose_name='Описание',
        null=True,
        blank=True
    )
    image = models.ImageField(
        upload_to='country_attachments',
        verbose_name='Изображение'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Создано'
    )

    class Meta:
        verbose_name = 'Изображение информации по стране'
        verbose_name_plural = 'Изображения информации по стране'
        indexes = [
            models.Index(fields=('country',)),
            models.Index(fields=('section',))
        ]

    def __str__(self):
        return f"{self.country.title} - {self.section.title} - {self.title}"

class Marker(models.Model):
    """Маркеры карты"""

    title = models.CharField(
        max_length=250,
        verbose_name='Название'
    )
    path = models.FileField(
        upload_to='markers',
        validators=[validate_svg],
        verbose_name='SVG-файл маркера',
        help_text='Загрузка маркеров в хранилище'
    )
    top = models.IntegerField(
        validators=[
            MaxValueValidator(
                100,
                message='Значение не может превышать 100'
            ),
            MinValueValidator(
                0,
                message='Значение не может быть отрицательным'
            )
        ],
        verbose_name='Оступ сверху для строки подписи, %',
        default=0
    )
    width = models.IntegerField(
        validators=[
            MaxValueValidator(
                100,
                message='Значение не может превышать 100'
            ),
            MinValueValidator(
                0,
                message='Значение не может быть отрицательным'
            )
        ],
        default=100,
        verbose_name='Ширина строки подписи, %'
    )
    height = models.IntegerField(
        validators=[
            MaxValueValidator(
                100,
                message='Значение не может превышать 100'
            ),
            MinValueValidator(
                0,
                message='Значение не может быть отрицательным'
            )
        ],
        default=50,
        verbose_name='Высота строки подписи, %'
    )
    scale = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        verbose_name='Масштаб флажка',
        validators=[
            MaxValueValidator(
                1,
                message='Значение не иожет быть больше 1'
            ),
            MinValueValidator(
                0.1,
                message='Значение не может быть меньше 0.1'
            )
        ],
        default=1
    )
    order = models.PositiveSmallIntegerField(
        verbose_name='Порядок',
        default=1,
    )
    is_flag = models.BooleanField(
        verbose_name='Является ли флагом',
        default=True
    )

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = 'Маркер'
        verbose_name_plural = 'Маркеры'
        indexes = [
            models.Index(fields=('title',)),
        ]
        ordering = ['order', 'title']

class EventMarker(models.Model):
    """Маркеры событий"""

    title = models.CharField(
        max_length=250,
        verbose_name='Название'
    )
    path = models.FileField(
        upload_to='event_markers',
        validators=[validate_svg],
        verbose_name='SVG-файл маркера события',
        help_text='Загрузка маркеров событий в хранилище'
    )

    def __str__(self):
        return self.title
    
    class Meta:
        verbose_name = 'Маркер события'
        verbose_name_plural = 'Маркеры событий'
        indexes = [
            models.Index(fields=('title',)),
        ]
    

class ActionType(models.Model):
    """Тип действия"""

    title = models.CharField(
        max_length=150,
        verbose_name='Тип действия'
    )
    animation = models.CharField(
        max_length=20,
        choices=ActionAnimations.choices,
        default=ActionAnimations.WAVE,
        verbose_name='Анимация действия'
    )

    class Meta:
        verbose_name = 'Тип действия'
        verbose_name_plural = 'Типы действий'
        indexes = [
            models.Index(fields=('title',)),
        ]
    
    def __str__(self):
        return self.title
    
class TargetType(models.Model):
    """Тип объекта разведки"""

    title = models.CharField(
        max_length=150,
        verbose_name='Тип объекта разведки'
    )

    class Meta:
        verbose_name = 'Тип объекта разведки'
        verbose_name_plural = 'Типы объектов разведки'
        indexes = [
            models.Index(fields=('title',)),
        ]
    
    def __str__(self):
        return self.title


class Target(models.Model):
    '''Объект разведки'''
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        unique=True,
        verbose_name='Уникальный идентификатор'
    )
    country = models.ForeignKey(
        Country,
        on_delete=models.CASCADE,
        verbose_name='Страна',
        related_name='contries'
    )
    title = models.CharField(
        max_length=250,
        verbose_name='Наименование объекта разведки'
    )
    label = models.CharField(
        max_length=250,
        verbose_name='Метка',
        blank=True,
        null=True
    )
    marker = models.ForeignKey(
        Marker,
        on_delete=models.SET_NULL,
        related_name='markers',
        verbose_name='Маркер',
        null=True
    )
    action_radius = models.FloatField(
        verbose_name='Радиус действия, км',
        default=0.0,
        validators=[
            MinValueValidator(
                0.0,
                message='Значение не может быть отрицательным'
            )
        ],
        null=True
    )

    type = models.ForeignKey(
        TargetType,
        on_delete=models.SET_NULL,
        verbose_name='Тип объекта разведки',
        related_name='target_types',
        null=True
    )

    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        verbose_name='Вышестоящий объект'
    )

    lat = models.FloatField(
        verbose_name='Долгота'
    )
    lng = models.FloatField(
        verbose_name='Широта'
    )

    class Meta:
        verbose_name = 'Объект'
        verbose_name_plural = 'Объекты'
        indexes = [
            models.Index(fields=('title',)),
            models.Index(fields=('label',)),
            models.Index(fields=('parent',)),
        ]

    def __str__(self):
        return self.title
    
class EventType(models.Model):
    """Тип события"""

    title = models.CharField(
        max_length=150,
        verbose_name='Тип события'
    )

    class Meta:
        verbose_name = 'Тип события'
        verbose_name_plural = 'Типы событий'
        indexes = [
            models.Index(fields=('title',)),
        ]
    
    def __str__(self):
        return self.title


class Event(models.Model):
    """Событие"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        unique=True,
        verbose_name='Уникальный идентификатор'
    )
    title = models.CharField(
        max_length=255,
        verbose_name='Название события'
    )
    object_name = models.CharField(
        max_length=255,
        verbose_name='Объект',
        blank=True
    )
    description = models.TextField(
        verbose_name='Описание',
        blank=True
    )
    event_type = models.ForeignKey(
        EventType,
        on_delete=models.SET_NULL,
        verbose_name='Тип события',
        related_name='event_types',
        null=True
    )
    date_start = models.DateField(
        verbose_name='Дата начала',
        null=True,
        blank=True
    )
    date_end = models.DateField(
        verbose_name='Дата завершения',
        null=True,
        blank=True
    )
    time_start = models.TimeField(
        verbose_name='Время начала',
        null=True,
        blank=True
    )
    time_end = models.TimeField(
        verbose_name='Время завершения',
        null=True,
        blank=True
    )
    country = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        verbose_name='Страна',
        related_name='events',
        null=True,
        blank=True
    )
    marker = models.ForeignKey(
        EventMarker,
        on_delete=models.SET_NULL,
        verbose_name='Маркер события',
        related_name='events',
        null=True,
        blank=True
    )
    color = models.CharField(
        max_length=7,
        verbose_name='Цвет события',
        default='#2f80ed'
    )
    shape = models.JSONField(
        verbose_name='Геометрия',
        default=dict,
        blank=True
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Создано'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Обновлено'
    )

    class Meta:
        verbose_name = 'Событие'
        verbose_name_plural = 'События'
        indexes = [
            models.Index(fields=('date_start',)),
            models.Index(fields=('date_end',)),
            models.Index(fields=('country',))
        ]

    def __str__(self):
        return self.title
    
class TargetAction(models.Model):
    """Действия объектов"""
    
    target = models.ForeignKey(
        Target,
        on_delete=models.CASCADE,
        verbose_name='Объект',
        related_name='actions'
    )
    action_type = models.ForeignKey(
        ActionType,
        on_delete=models.SET_NULL,
        verbose_name='Тип действия',
        null=True
    )
    radius = models.FloatField(
        verbose_name='Радиус действия, км',
        validators=[
            MinValueValidator(
                0.0,
                message='Значение не может быть отрицательным'
            )
        ],
        null=True
    )

    def __str__(self):
        return f"{self.target.title} - {self.action_type.title}"
    
    class Meta:
        verbose_name = 'Радиус действия объекта'
        verbose_name_plural = 'Радиус действия объектов'


class FormularSections(models.Model):
    """Разделы формуляра"""

    title = models.CharField(
        max_length=250,
        verbose_name='Название раздела'
    )
    order = models.PositiveSmallIntegerField(
        verbose_name='Порядок',
        default=1,
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        verbose_name='Родительский раздел',
        related_name='children',
        null=True,
        blank=True
    )
    is_hidden = models.BooleanField(
        verbose_name='Скрыть раздел в формуляре',
        default=False
    )


    def __str__(self):
        return self.title
    
    class Meta:
        verbose_name = 'Раздел формуляра'
        verbose_name_plural = 'Разделы формуляра'
        indexes = [
            models.Index(fields=('title',)),
        ]
        ordering = ['order', 'title']

class Formular(models.Model):
    """Пункты формуляра"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор'
    )
    target = models.ForeignKey(
        Target,
        on_delete=models.CASCADE,
        verbose_name='Объект разведки'
    )
    section = models.ForeignKey(
        FormularSections,
        on_delete=models.CASCADE,
        verbose_name='Раздел формуляра',
        related_name='formular_sections'
    )
    content = models.TextField(
        verbose_name='Содержание пункта',
        null=True,
        blank=True
    )

    def __str__(self):
        return f"{self.target.title} - {self.section.title}"
    
    class Meta:
        verbose_name = 'Пункт формуляра'
        verbose_name_plural = 'Пункты формуляра'
        indexes = [
            models.Index(fields=('target',)),
            models.Index(fields=('section',))
        ]


class FormularAttachment(models.Model):
    """Изображения для разделов формуляра"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор'
    )
    target = models.ForeignKey(
        Target,
        on_delete=models.CASCADE,
        related_name='formular_attachments',
        verbose_name='Объект разведки'
    )
    section = models.ForeignKey(
        FormularSections,
        on_delete=models.CASCADE,
        related_name='formular_attachments',
        verbose_name='Раздел формуляра'
    )
    title = models.CharField(
        max_length=250,
        verbose_name='Название'
    )
    description = models.TextField(
        verbose_name='Описание',
        null=True,
        blank=True
    )
    image = models.ImageField(
        upload_to='formular_attachments',
        verbose_name='Изображение'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Создано'
    )

    class Meta:
        verbose_name = 'Изображение формуляра'
        verbose_name_plural = 'Изображения формуляра'
        indexes = [
            models.Index(fields=('target',)),
            models.Index(fields=('section',))
        ]

    def __str__(self):
        return f"{self.target.title} - {self.section.title} - {self.title}"
# Create your models here.
