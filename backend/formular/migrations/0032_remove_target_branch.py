# Generated for removal of branch field (now using only type -> TargetType)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0031_alter_targettype_options_alter_target_action_radius'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='target',
            name='branch',
        ),
    ]
