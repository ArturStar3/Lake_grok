# Перенос моделей техники в отдельное приложение (только состояние, таблицы БД не меняются).

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


STATE_OPERATIONS = [
    migrations.CreateModel(
        name='UnitOfMeasure',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('title', models.CharField(max_length=100, verbose_name='Название')),
            ('symbol', models.CharField(max_length=20, unique=True, verbose_name='Обозначение')),
        ],
        options={
            'verbose_name': 'Единица измерения',
            'verbose_name_plural': 'Единицы измерения',
            'db_table': 'formular_unitofmeasure',
            'ordering': ['title'],
        },
    ),
    migrations.CreateModel(
        name='EquipmentCategory',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('title', models.CharField(max_length=150, verbose_name='Название')),
            ('order', models.PositiveSmallIntegerField(default=1, verbose_name='Порядок')),
            ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='equipment.equipmentcategory', verbose_name='Родительская категория')),
        ],
        options={
            'verbose_name': 'Категория техники',
            'verbose_name_plural': 'Категории техники',
            'db_table': 'formular_equipmentcategory',
            'ordering': ['order', 'title'],
        },
    ),
    migrations.CreateModel(
        name='Equipment',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('title', models.CharField(max_length=200, verbose_name='Наименование')),
            ('designation', models.CharField(blank=True, max_length=100, verbose_name='Обозначение')),
            ('description', models.TextField(blank=True, verbose_name='Описание')),
            ('origin_country', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='equipment', to='formular.country', verbose_name='Страна происхождения')),
            ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='equipment', to='equipment.equipmentcategory', verbose_name='Категория')),
        ],
        options={
            'verbose_name': 'Образец техники',
            'verbose_name_plural': 'Каталог техники',
            'db_table': 'formular_equipment',
            'ordering': ['title'],
        },
    ),
    migrations.CreateModel(
        name='EquipmentParameterDefinition',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('title', models.CharField(max_length=200, verbose_name='Название')),
            ('code', models.CharField(help_text='Уникальный идентификатор параметра (латиница, snake_case)', max_length=80, unique=True, verbose_name='Код')),
            ('data_type', models.CharField(choices=[('float', 'Дробное число'), ('int', 'Целое число'), ('text', 'Текст'), ('bool', 'Да/Нет')], default='float', max_length=10, verbose_name='Тип данных')),
            ('order', models.PositiveSmallIntegerField(default=1, verbose_name='Порядок')),
            ('help_text', models.CharField(blank=True, max_length=250, verbose_name='Подсказка')),
            ('action_type', models.ForeignKey(blank=True, help_text='Если задано, числовое значение (км) отображается как зона на карте', null=True, on_delete=django.db.models.deletion.SET_NULL, to='formular.actiontype', verbose_name='Тип зоны действия')),
            ('categories', models.ManyToManyField(blank=True, db_table='formular_equipmentparameterdefinition_categories', related_name='parameter_definitions', to='equipment.equipmentcategory', verbose_name='Категории техники')),
            ('unit', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='equipment.unitofmeasure', verbose_name='Единица измерения')),
        ],
        options={
            'verbose_name': 'Параметр техники',
            'verbose_name_plural': 'Параметры техники',
            'db_table': 'formular_equipmentparameterdefinition',
            'ordering': ['order', 'title'],
        },
    ),
    migrations.CreateModel(
        name='EquipmentParameterValue',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('value_float', models.FloatField(blank=True, null=True, verbose_name='Значение (дробное)')),
            ('value_int', models.IntegerField(blank=True, null=True, verbose_name='Значение (целое)')),
            ('value_text', models.CharField(blank=True, max_length=500, verbose_name='Значение (текст)')),
            ('value_bool', models.BooleanField(blank=True, null=True, verbose_name='Да/Нет')),
            ('equipment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='parameter_values', to='equipment.equipment', verbose_name='Образец техники')),
            ('parameter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='values', to='equipment.equipmentparameterdefinition', verbose_name='Параметр')),
        ],
        options={
            'verbose_name': 'Значение ТТХ',
            'verbose_name_plural': 'Значения ТТХ',
            'db_table': 'formular_equipmentparametervalue',
        },
    ),
    migrations.CreateModel(
        name='TargetEquipment',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('quantity', models.PositiveIntegerField(blank=True, default=1, verbose_name='Количество')),
            ('notes', models.CharField(blank=True, max_length=250, verbose_name='Примечание')),
            ('equipment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deployments', to='equipment.equipment', verbose_name='Образец техники')),
            ('target', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deployed_equipment', to='formular.target', verbose_name='Объект разведки')),
        ],
        options={
            'verbose_name': 'Техника на объекте',
            'verbose_name_plural': 'Техника на объектах',
            'db_table': 'formular_targetequipment',
        },
    ),
    migrations.CreateModel(
        name='TargetEquipmentZone',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('radius_km', models.FloatField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0.0, message='Значение не может быть отрицательным')], verbose_name='Радиус, км')),
            ('is_enabled', models.BooleanField(default=True, verbose_name='Отображать на карте')),
            ('action_type', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='formular.actiontype', verbose_name='Тип зоны')),
            ('parameter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deployment_zones', to='equipment.equipmentparameterdefinition', verbose_name='Параметр ТТХ')),
            ('target_equipment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='zones', to='equipment.targetequipment', verbose_name='Техника на объекте')),
        ],
        options={
            'verbose_name': 'Зона техники на объекте',
            'verbose_name_plural': 'Зоны техники на объекте',
            'db_table': 'formular_targetequipmentzone',
        },
    ),
    migrations.AddIndex(
        model_name='equipmentcategory',
        index=models.Index(fields=['title'], name='formular_eq_title_9f22b0_idx'),
    ),
    migrations.AddIndex(
        model_name='equipment',
        index=models.Index(fields=['title'], name='formular_eq_title_2317e5_idx'),
    ),
    migrations.AddIndex(
        model_name='equipment',
        index=models.Index(fields=['designation'], name='formular_eq_designa_26158f_idx'),
    ),
    migrations.AddIndex(
        model_name='equipmentparametervalue',
        index=models.Index(fields=['equipment'], name='formular_eq_equipme_86b76f_idx'),
    ),
    migrations.AddIndex(
        model_name='equipmentparametervalue',
        index=models.Index(fields=['parameter'], name='formular_eq_paramet_0c2dbd_idx'),
    ),
    migrations.AlterUniqueTogether(
        name='equipmentparametervalue',
        unique_together={('equipment', 'parameter')},
    ),
    migrations.AddIndex(
        model_name='targetequipment',
        index=models.Index(fields=['target'], name='formular_ta_target__fe2017_idx'),
    ),
    migrations.AddIndex(
        model_name='targetequipment',
        index=models.Index(fields=['equipment'], name='formular_ta_equipme_5d4cd6_idx'),
    ),
    migrations.AddIndex(
        model_name='targetequipmentzone',
        index=models.Index(fields=['target_equipment'], name='formular_ta_target__f8db89_idx'),
    ),
    migrations.AlterUniqueTogether(
        name='targetequipmentzone',
        unique_together={('target_equipment', 'parameter')},
    ),
    migrations.AddIndex(
        model_name='equipmentparameterdefinition',
        index=models.Index(fields=['code'], name='formular_eq_code_2732c3_idx'),
    ),
    migrations.AddIndex(
        model_name='equipmentparameterdefinition',
        index=models.Index(fields=['title'], name='formular_eq_title_f501fa_idx'),
    ),
]


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('formular', '0036_equipment_catalog'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=STATE_OPERATIONS,
        ),
    ]
