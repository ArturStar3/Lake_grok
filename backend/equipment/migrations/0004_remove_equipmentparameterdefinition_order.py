from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0003_remove_targetequipment'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='equipmentparameterdefinition',
            options={
                'ordering': ['title'],
                'verbose_name': 'Параметр техники',
                'verbose_name_plural': 'Параметры техники',
            },
        ),
        migrations.RemoveField(
            model_name='equipmentparameterdefinition',
            name='order',
        ),
    ]
