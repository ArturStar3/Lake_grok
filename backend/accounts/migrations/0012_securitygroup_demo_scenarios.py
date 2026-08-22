from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_backfill_data_exchange_permissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='securitygroup',
            name='demo_scenarios',
            field=models.CharField(
                choices=[
                    ('none', 'Нет доступа'),
                    ('read', 'Просмотр'),
                    ('write', 'Редактирование'),
                    ('write_delete', 'Редактирование и удаление'),
                ],
                default='none',
                max_length=16,
                verbose_name='Сценарии демонстрации',
            ),
        ),
    ]
