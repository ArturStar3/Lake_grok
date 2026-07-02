# Техника на объекте — ManyToMany вместо отдельной модели TargetEquipment.

from django.db import migrations, models


def copy_target_equipment_to_m2m(apps, schema_editor):
    Target = apps.get_model('formular', 'Target')
    TargetEquipment = apps.get_model('equipment', 'TargetEquipment')
    for row in TargetEquipment.objects.all():
        target = Target.objects.get(pk=row.target_id)
        target.equipment.add(row.equipment_id)


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0037_move_equipment_to_app'),
        ('equipment', '0002_simplify_parameters_and_remove_deployment_zones'),
    ]

    operations = [
        migrations.AddField(
            model_name='target',
            name='equipment',
            field=models.ManyToManyField(
                blank=True,
                related_name='targets',
                to='equipment.equipment',
                verbose_name='Техника на объекте',
            ),
        ),
        migrations.RunPython(
            copy_target_equipment_to_m2m,
            migrations.RunPython.noop,
        ),
    ]
