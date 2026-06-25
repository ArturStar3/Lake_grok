# Перенос моделей техники в отдельное приложение (только состояние, таблицы БД не меняются).

from django.db import migrations


STATE_OPERATIONS = [
    migrations.RemoveIndex(
        model_name='equipment',
        name='formular_eq_title_2317e5_idx',
    ),
    migrations.RemoveIndex(
        model_name='equipment',
        name='formular_eq_designa_26158f_idx',
    ),
    migrations.RemoveIndex(
        model_name='equipmentcategory',
        name='formular_eq_title_9f22b0_idx',
    ),
    migrations.RemoveIndex(
        model_name='equipmentparameterdefinition',
        name='formular_eq_code_2732c3_idx',
    ),
    migrations.RemoveIndex(
        model_name='equipmentparameterdefinition',
        name='formular_eq_title_f501fa_idx',
    ),
    migrations.AlterUniqueTogether(
        name='equipmentparametervalue',
        unique_together=None,
    ),
    migrations.RemoveIndex(
        model_name='equipmentparametervalue',
        name='formular_eq_equipme_86b76f_idx',
    ),
    migrations.RemoveIndex(
        model_name='equipmentparametervalue',
        name='formular_eq_paramet_0c2dbd_idx',
    ),
    migrations.RemoveIndex(
        model_name='targetequipment',
        name='formular_ta_target__fe2017_idx',
    ),
    migrations.RemoveIndex(
        model_name='targetequipment',
        name='formular_ta_equipme_5d4cd6_idx',
    ),
    migrations.AlterUniqueTogether(
        name='targetequipmentzone',
        unique_together=None,
    ),
    migrations.RemoveIndex(
        model_name='targetequipmentzone',
        name='formular_ta_target__f8db89_idx',
    ),
    migrations.RemoveField(
        model_name='equipment',
        name='category',
    ),
    migrations.RemoveField(
        model_name='equipment',
        name='origin_country',
    ),
    migrations.RemoveField(
        model_name='equipmentparameterdefinition',
        name='action_type',
    ),
    migrations.RemoveField(
        model_name='equipmentparameterdefinition',
        name='categories',
    ),
    migrations.RemoveField(
        model_name='equipmentparameterdefinition',
        name='unit',
    ),
    migrations.RemoveField(
        model_name='equipmentparametervalue',
        name='equipment',
    ),
    migrations.RemoveField(
        model_name='equipmentparametervalue',
        name='parameter',
    ),
    migrations.RemoveField(
        model_name='targetequipment',
        name='equipment',
    ),
    migrations.RemoveField(
        model_name='targetequipment',
        name='target',
    ),
    migrations.RemoveField(
        model_name='targetequipmentzone',
        name='action_type',
    ),
    migrations.RemoveField(
        model_name='targetequipmentzone',
        name='parameter',
    ),
    migrations.RemoveField(
        model_name='targetequipmentzone',
        name='target_equipment',
    ),
    migrations.DeleteModel(
        name='EquipmentCategory',
    ),
    migrations.DeleteModel(
        name='UnitOfMeasure',
    ),
    migrations.DeleteModel(
        name='EquipmentParameterValue',
    ),
    migrations.DeleteModel(
        name='Equipment',
    ),
    migrations.DeleteModel(
        name='EquipmentParameterDefinition',
    ),
    migrations.DeleteModel(
        name='TargetEquipment',
    ),
    migrations.DeleteModel(
        name='TargetEquipmentZone',
    ),
]


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0036_equipment_catalog'),
        ('equipment', '0001_move_equipment_to_app'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=STATE_OPERATIONS,
        ),
    ]
