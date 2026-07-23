from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_backfill_reports_permissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='securitygroup',
            name='data_exchange',
            field=models.CharField(
                choices=[
                    ('none', 'Нет доступа'),
                    ('read', 'Просмотр'),
                    ('write', 'Редактирование'),
                    ('write_delete', 'Редактирование и удаление'),
                ],
                default='none',
                max_length=16,
                verbose_name='Импорт/экспорт данных',
            ),
        ),
    ]
