from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_passwordresetrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='securitygroup',
            name='operational_situations',
            field=models.CharField(
                choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')],
                default='none',
                max_length=10,
                verbose_name='Оперативная обстановка',
            ),
        ),
    ]
