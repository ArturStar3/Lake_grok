import uuid

from django.db import models
from django.core.validators import (
    MaxValueValidator,
    MinValueValidator
)
from django.core.exceptions import ValidationError

from .enums import (
    Colors,
    ActionLineTypes,
    ZoneGeometryModes,
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
    color = models.CharField(
        max_length=7,
        verbose_name='Цвет зоны',
        default='#3388ff',
        help_text='Цвет контура и заливки зоны (формат #RRGGBB)',
    )
    line_type = models.CharField(
        max_length=20,
        choices=ActionLineTypes.choices,
        default=ActionLineTypes.SOLID,
        verbose_name='Тип линии',
    )
    zone_mode = models.CharField(
        max_length=20,
        choices=ZoneGeometryModes.choices,
        default=ZoneGeometryModes.FLAT,
        verbose_name='Режим геометрии зоны',
    )
    is_inundation_zone = models.BooleanField(
        default=False,
        verbose_name='Зона затопления',
        help_text='Тип относится к сценариям затопления',
    )
    min_elevation_deg = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Мин. угол места, °',
        help_text='Для зоны с учётом рельефа: луч ниже этого угла считается заблокированным',
    )

    class Meta:
        verbose_name = 'Тип действия'
        verbose_name_plural = 'Типы действий'
        indexes = [
            models.Index(fields=('title',)),
        ]

    def clean(self):
        super().clean()
        if self.zone_mode == ZoneGeometryModes.LOS_RADAR:
            if self.min_elevation_deg is None:
                raise ValidationError({
                    'min_elevation_deg': 'Укажите минимальный угол места для режима с учётом рельефа',
                })
        else:
            self.min_elevation_deg = None
        if self.is_inundation_zone and self.zone_mode != ZoneGeometryModes.POLYGON:
            raise ValidationError({
                'is_inundation_zone': 'Зона затопления возможна только при режиме «Полигон»',
            })

    def __str__(self):
        return self.title
    
class TargetType(models.Model):
    """Тип объекта разведки"""

    title = models.CharField(
        max_length=150,
        verbose_name='Тип объекта разведки'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        verbose_name='Родительский тип',
    )
    order = models.PositiveSmallIntegerField(
        verbose_name='Порядок',
        default=1,
    )
    countries = models.ManyToManyField(
        Country,
        blank=True,
        related_name='applicable_target_types',
        verbose_name='Применимо к странам',
        help_text='Если список пуст — тип применим ко всем странам'
    )

    class Meta:
        verbose_name = 'Тип объекта разведки'
        verbose_name_plural = 'Типы объектов разведки'
        indexes = [
            models.Index(fields=('title',)),
        ]
        ordering = ['order', 'title']

    def clean(self):
        if self.parent_id:
            if self.parent_id == self.pk:
                raise ValidationError(
                    {'parent': 'Тип не может быть родителем самого себя'}
                )
            cursor = self.parent
            while cursor is not None:
                if cursor.pk == self.pk:
                    raise ValidationError(
                        {'parent': 'Циклическая иерархия типов объектов'}
                    )
                cursor = cursor.parent

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
        null=True,
        blank=True
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
    antenna_height_m = models.FloatField(
        default=10.0,
        validators=[
            MinValueValidator(0.0, message='Высота не может быть отрицательной'),
        ],
        verbose_name='Высота антенны, м',
        help_text='Над уровнем земли в точке объекта (для расчёта покрытия РЛС)',
    )
    crest_elevation_m = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Отметка гребня, м',
        help_text='Для гидротехнических сооружений',
    )
    normal_pool_level_m = models.FloatField(
        null=True,
        blank=True,
        verbose_name='НПУ, м',
        help_text='Нормальный подпорный уровень',
    )
    max_pool_level_m = models.FloatField(
        null=True,
        blank=True,
        verbose_name='ПМУ, м',
        help_text='Проектный максимальный / аварийный уровень',
    )
    equipment = models.ManyToManyField(
        'equipment.Equipment',
        through='TargetEquipment',
        blank=True,
        related_name='targets',
        verbose_name='Техника на объекте',
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


class TargetEquipment(models.Model):
    """Связь объекта разведки с образцом техники и количеством."""

    target = models.ForeignKey(
        Target,
        on_delete=models.CASCADE,
        related_name='equipment_links',
        verbose_name='Объект разведки',
    )
    equipment = models.ForeignKey(
        'equipment.Equipment',
        on_delete=models.CASCADE,
        related_name='target_links',
        verbose_name='Образец техники',
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[
            MinValueValidator(1, message='Количество должно быть не меньше 1'),
        ],
        verbose_name='Количество',
    )

    class Meta:
        db_table = 'formular_target_equipment'
        verbose_name = 'Техника на объекте'
        verbose_name_plural = 'Вооружение и техника'
        constraints = [
            models.UniqueConstraint(
                fields=('target', 'equipment'),
                name='formular_target_equipment_unique',
            ),
        ]
        indexes = [
            models.Index(fields=('target',)),
            models.Index(fields=('equipment',)),
        ]

    def __str__(self):
        label = self.equipment.designation or self.equipment.title
        if self.quantity > 1:
            return f'{label} × {self.quantity}'
        return label

    
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
    zone_geometry = models.JSONField(
        verbose_name='Геометрия зоны (GeoJSON)',
        null=True,
        blank=True,
        default=None,
    )
    zone_geometry_computed_at = models.DateTimeField(
        verbose_name='Зона рассчитана',
        null=True,
        blank=True,
    )
    zone_metadata = models.JSONField(
        verbose_name='Метаданные сценария зоны',
        null=True,
        blank=True,
        default=None,
        help_text='Для затопления: water_level_m, scenario_label, notes',
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


class PersonSections(models.Model):
    """Разделы информации по персоналиям"""

    title = models.CharField(
        max_length=250,
        verbose_name='Название раздела',
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
        blank=True,
    )
    is_hidden = models.BooleanField(
        verbose_name='Скрыть раздел',
        default=False,
    )

    class Meta:
        verbose_name = 'Раздел персоналий'
        verbose_name_plural = 'Разделы персоналий'
        ordering = ['order', 'title']
        indexes = [
            models.Index(fields=('title',)),
        ]

    def __str__(self):
        return self.title


class RelationType(models.Model):
    """Характер связи между лицами"""

    title = models.CharField(
        max_length=150,
        verbose_name='Название (прямое)',
    )
    reverse_title = models.CharField(
        max_length=150,
        blank=True,
        verbose_name='Название (обратное)',
        help_text='Если пусто — совпадает с прямым (симметричная связь)',
    )

    class Meta:
        verbose_name = 'Характер связи'
        verbose_name_plural = 'Характеры связей'
        ordering = ['title']

    def __str__(self):
        return self.title

    @property
    def effective_reverse_title(self):
        return self.reverse_title.strip() or self.title


class Person(models.Model):
    """Лицо (персона), привязанное к объекту"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    target = models.ForeignKey(
        Target,
        on_delete=models.CASCADE,
        related_name='persons',
        verbose_name='Объект',
    )
    full_name = models.CharField(
        max_length=250,
        verbose_name='ФИО',
    )
    position = models.CharField(
        max_length=250,
        blank=True,
        verbose_name='Должность',
    )

    class Meta:
        verbose_name = 'Лицо'
        verbose_name_plural = 'Список лиц'
        indexes = [
            models.Index(fields=('target',)),
        ]

    def __str__(self):
        return self.full_name


class PersonInfo(models.Model):
    """Данные по лицу и разделу"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name='info',
        verbose_name='Лицо',
    )
    section = models.ForeignKey(
        PersonSections,
        on_delete=models.CASCADE,
        related_name='person_sections',
        verbose_name='Раздел',
    )
    content = models.TextField(
        verbose_name='Содержание',
        null=True,
        blank=True,
    )

    class Meta:
        verbose_name = 'Данные по лицу'
        verbose_name_plural = 'Данные по лицам'
        indexes = [
            models.Index(fields=('person',)),
            models.Index(fields=('section',)),
        ]

    def __str__(self):
        return f"{self.person.full_name} - {self.section.title}"


class PersonAttachment(models.Model):
    """Изображения по разделам персоналий"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Лицо',
    )
    section = models.ForeignKey(
        PersonSections,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='Раздел',
    )
    title = models.CharField(
        max_length=250,
        verbose_name='Название',
    )
    description = models.TextField(
        verbose_name='Описание',
        null=True,
        blank=True,
    )
    image = models.ImageField(
        upload_to='person_attachments',
        verbose_name='Изображение',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Создано',
    )

    class Meta:
        verbose_name = 'Изображение персоналии'
        verbose_name_plural = 'Изображения персоналий'
        indexes = [
            models.Index(fields=('person',)),
            models.Index(fields=('section',)),
        ]

    def __str__(self):
        return f"{self.person.full_name} - {self.section.title} - {self.title}"


class PersonPhoto(models.Model):
    """Фотографии лица (order=1 — аватар)"""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name='photos',
        verbose_name='Лицо',
    )
    title = models.CharField(
        max_length=250,
        blank=True,
        default='',
        verbose_name='Название',
    )
    image = models.ImageField(
        upload_to='person_photos',
        verbose_name='Изображение',
    )
    order = models.PositiveIntegerField(
        default=1,
        verbose_name='Порядок',
        help_text='Фото с order=1 используется как аватар',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Создано',
    )

    class Meta:
        verbose_name = 'Фото лица'
        verbose_name_plural = 'Фото лиц'
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=('person', 'order')),
        ]

    def __str__(self):
        label = self.title or f'Фото #{self.order}'
        return f"{self.person.full_name} - {label}"


class PersonRelation(models.Model):
    """Связь между двумя лицами"""

    person_from = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name='relations_from',
        verbose_name='Лицо (от)',
    )
    person_to = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name='relations_to',
        verbose_name='Лицо (к)',
    )
    relation_type = models.ForeignKey(
        RelationType,
        on_delete=models.PROTECT,
        related_name='relations',
        verbose_name='Характер связи',
    )
    notes = models.CharField(
        max_length=250,
        blank=True,
        verbose_name='Примечание',
    )

    class Meta:
        verbose_name = 'Связь между лицами'
        verbose_name_plural = 'Связи между лицами'
        unique_together = ('person_from', 'person_to', 'relation_type')
        indexes = [
            models.Index(fields=('person_from',)),
            models.Index(fields=('person_to',)),
        ]

    def clean(self):
        if self.person_from_id and self.person_to_id and self.person_from_id == self.person_to_id:
            raise ValidationError('Лицо не может быть связано само с собой')

    def __str__(self):
        return f"{self.person_from} → {self.relation_type} → {self.person_to}"


class OperationalSituationRevisionChangeKind(models.TextChoices):
    INITIAL = 'initial', 'Создание'
    CORRECTION = 'correction', 'Исправление'
    NEW_STATE = 'new_state', 'Новое состояние'
    FORK = 'fork', 'На основе другой обстановки'


class OperationalSituation(models.Model):
    """Серия оперативной обстановки (логическая сущность с версиями)."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    current_revision = models.OneToOneField(
        'OperationalSituationRevision',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        verbose_name='Текущая ревизия',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Дата создания серии',
    )
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operational_situations_created',
        verbose_name='Автор',
    )

    class Meta:
        verbose_name = 'Оперативная обстановка'
        verbose_name_plural = 'Оперативные обстановки'
        ordering = ['-created_at']

    def __str__(self):
        rev = self.current_revision
        return rev.title if rev else str(self.id)


class OperationalSituationRevision(models.Model):
    """Снимок состояния оперативной обстановки."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name='Уникальный идентификатор',
    )
    situation = models.ForeignKey(
        OperationalSituation,
        on_delete=models.CASCADE,
        related_name='revisions',
        verbose_name='Обстановка',
    )
    version = models.PositiveIntegerField(verbose_name='Версия')
    title = models.CharField(max_length=255, verbose_name='Название')
    description = models.TextField(verbose_name='Описание', blank=True)
    situation_date = models.DateField(verbose_name='Дата обстановки', null=True, blank=True)
    situation_time = models.TimeField(verbose_name='Время обстановки', null=True, blank=True)
    color = models.CharField(max_length=7, verbose_name='Цвет', default='#2f80ed')
    geometry = models.JSONField(verbose_name='Геометрия (GeoJSON)', default=dict, blank=True)
    countries = models.ManyToManyField(
        Country,
        blank=True,
        related_name='operational_situation_revisions',
        verbose_name='Затронутые страны',
    )
    change_kind = models.CharField(
        max_length=20,
        choices=OperationalSituationRevisionChangeKind.choices,
        default=OperationalSituationRevisionChangeKind.INITIAL,
        verbose_name='Тип изменения',
    )
    change_note = models.TextField(verbose_name='Комментарий к изменению', blank=True)
    parent_revision = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_revisions',
        verbose_name='Предыдущая ревизия',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата фиксации')
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operational_situation_revisions_created',
        verbose_name='Автор',
    )

    class Meta:
        verbose_name = 'Ревизия оперативной обстановки'
        verbose_name_plural = 'Ревизии оперативной обстановки'
        ordering = ['situation_id', 'version']
        constraints = [
            models.UniqueConstraint(
                fields=('situation', 'version'),
                name='uniq_operational_situation_version',
            ),
        ]
        indexes = [
            models.Index(fields=('situation_date',)),
            models.Index(fields=('created_at',)),
        ]

    def __str__(self):
        return f'{self.title} (v{self.version})'

