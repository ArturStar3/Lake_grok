from django.core.exceptions import ValidationError
from django.db import models

from formular.models import ActionType, Country


class EquipmentCategory(models.Model):
    """Категория техники (ВВС, истребители, танки, …)"""

    title = models.CharField(
        max_length=150,
        verbose_name='Название',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        verbose_name='Родительская категория',
    )
    order = models.PositiveSmallIntegerField(
        verbose_name='Порядок',
        default=1,
    )

    class Meta:
        db_table = 'formular_equipmentcategory'
        verbose_name = 'Категория техники'
        verbose_name_plural = 'Категории техники'
        ordering = ['order', 'title']
        indexes = [
            models.Index(fields=('title',)),
        ]

    def __str__(self):
        return self.title


class UnitOfMeasure(models.Model):
    """Единица измерения ТТХ"""

    title = models.CharField(
        max_length=100,
        verbose_name='Название',
    )
    symbol = models.CharField(
        max_length=20,
        verbose_name='Обозначение',
        unique=True,
    )

    class Meta:
        db_table = 'formular_unitofmeasure'
        verbose_name = 'Единица измерения'
        verbose_name_plural = 'Единицы измерения'
        ordering = ['title']

    def __str__(self):
        return self.symbol


class EquipmentParameterDefinition(models.Model):
    """Шаблон числовой характеристики техники"""

    title = models.CharField(
        max_length=200,
        verbose_name='Название',
    )
    code = models.CharField(
        max_length=80,
        verbose_name='Код',
        unique=True,
        help_text='Уникальный идентификатор параметра (латиница, snake_case)',
    )
    unit = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Единица измерения',
    )
    categories = models.ManyToManyField(
        EquipmentCategory,
        blank=True,
        related_name='parameter_definitions',
        verbose_name='Категории техники',
        db_table='formular_equipmentparameterdefinition_categories',
    )
    action_type = models.ForeignKey(
        ActionType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Тип зоны действия',
        help_text='Если задано, значение (км) отображается как зона на карте',
    )
    help_text = models.CharField(
        max_length=250,
        blank=True,
        verbose_name='Подсказка',
    )

    class Meta:
        db_table = 'formular_equipmentparameterdefinition'
        verbose_name = 'Параметр техники'
        verbose_name_plural = 'Параметры техники'
        ordering = ['title']
        indexes = [
            models.Index(fields=('code',)),
            models.Index(fields=('title',)),
        ]

    def clean(self):
        if self.action_type_id:
            if not self.unit_id:
                raise ValidationError(
                    {'unit': 'Для параметра зоны нужна единица измерения'}
                )
            unit = self.unit
            if unit and unit.symbol.lower() not in ('км', 'km'):
                raise ValidationError(
                    {'unit': 'Тип зоны допустим только для единицы «км»'}
                )

    def __str__(self):
        return self.title


class Equipment(models.Model):
    """Образец техники в каталоге"""

    title = models.CharField(
        max_length=200,
        verbose_name='Наименование',
    )
    designation = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Обозначение',
    )
    category = models.ForeignKey(
        EquipmentCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='equipment',
        verbose_name='Категория',
    )
    origin_country = models.ForeignKey(
        Country,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='equipment',
        verbose_name='Страна происхождения',
    )
    description = models.TextField(
        blank=True,
        verbose_name='Описание',
    )

    class Meta:
        db_table = 'formular_equipment'
        verbose_name = 'Образец техники'
        verbose_name_plural = 'Каталог техники'
        ordering = ['title']
        indexes = [
            models.Index(fields=('title',)),
            models.Index(fields=('designation',)),
        ]

    def __str__(self):
        return self.designation or self.title

    def catalog_zone_values(self):
        """Параметры каталога с типом зоны и числовым значением."""
        return self.parameter_values.filter(
            parameter__action_type__isnull=False,
            value__gt=0,
        ).select_related('parameter', 'parameter__action_type')


class EquipmentParameterValue(models.Model):
    """Числовое значение ТТХ для образца техники"""

    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.CASCADE,
        related_name='parameter_values',
        verbose_name='Образец техники',
    )
    parameter = models.ForeignKey(
        EquipmentParameterDefinition,
        on_delete=models.CASCADE,
        related_name='values',
        verbose_name='Параметр',
    )
    value = models.FloatField(
        verbose_name='Значение',
    )

    class Meta:
        db_table = 'formular_equipmentparametervalue'
        verbose_name = 'Значение ТТХ'
        verbose_name_plural = 'Значения ТТХ'
        unique_together = [('equipment', 'parameter')]
        indexes = [
            models.Index(fields=('equipment',)),
            models.Index(fields=('parameter',)),
        ]

    def __str__(self):
        return f"{self.equipment} — {self.parameter.title}: {self.value}"
