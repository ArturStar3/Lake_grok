# Упрощение ТТХ: только float; зоны только из каталога.

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


def copy_float_to_value(apps, schema_editor):
    EquipmentParameterValue = apps.get_model('equipment', 'EquipmentParameterValue')
    for row in EquipmentParameterValue.objects.all():
        if row.value_float is not None:
            row.value = row.value_float
            row.save(update_fields=['value'])


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0001_move_equipment_to_app'),
    ]

    operations = [
        migrations.AddField(
            model_name='equipmentparametervalue',
            name='value',
            field=models.FloatField(default=0, verbose_name='Значение'),
            preserve_default=False,
        ),
        migrations.RunPython(copy_float_to_value, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='equipmentparametervalue',
            name='value_float',
        ),
        migrations.RemoveField(
            model_name='equipmentparametervalue',
            name='value_int',
        ),
        migrations.RemoveField(
            model_name='equipmentparametervalue',
            name='value_text',
        ),
        migrations.RemoveField(
            model_name='equipmentparametervalue',
            name='value_bool',
        ),
        migrations.RemoveField(
            model_name='equipmentparameterdefinition',
            name='data_type',
        ),
        migrations.DeleteModel(
            name='TargetEquipmentZone',
        ),
    ]
