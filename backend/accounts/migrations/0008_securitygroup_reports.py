from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_module_write_delete'),
    ]

    operations = [
        migrations.AddField(
            model_name='securitygroup',
            name='reports',
            field=models.CharField(
                choices=[
                    ('none', 'Нет доступа'),
                    ('read', 'Просмотр'),
                    ('write', 'Редактирование'),
                    ('write_delete', 'Редактирование и удаление'),
                ],
                default='none',
                max_length=16,
                verbose_name='Отчёты',
            ),
        ),
    ]
