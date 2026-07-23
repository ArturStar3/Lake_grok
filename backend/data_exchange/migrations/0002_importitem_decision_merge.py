from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('data_exchange', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='importitem',
            name='decision',
            field=models.CharField(
                choices=[
                    ('pending', 'Ожидает'),
                    ('keep_local', 'Оставить локальное'),
                    ('use_imported', 'Использовать импортированное'),
                    ('merge', 'Объединить'),
                ],
                default='pending',
                max_length=16,
            ),
        ),
    ]
