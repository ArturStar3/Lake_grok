from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0002_simplify_parameters_and_remove_deployment_zones'),
        ('formular', '0038_target_equipment_m2m'),
    ]

    operations = [
        migrations.DeleteModel(
            name='TargetEquipment',
        ),
    ]
