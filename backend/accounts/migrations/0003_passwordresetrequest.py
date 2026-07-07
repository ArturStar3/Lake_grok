# Generated manually for password reset requests

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_create_profiles_for_existing_users'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PasswordResetRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('note', models.TextField(blank=True, verbose_name='Комментарий пользователя')),
                ('status', models.CharField(
                    choices=[('pending', 'Ожидает'), ('resolved', 'Выполнен'), ('rejected', 'Отклонён')],
                    default='pending',
                    max_length=20,
                    verbose_name='Статус',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создан')),
                ('resolved_at', models.DateTimeField(blank=True, null=True, verbose_name='Обработан')),
                ('resolved_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='handled_password_reset_requests',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Обработал',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='password_reset_requests',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Пользователь',
                )),
            ],
            options={
                'verbose_name': 'Запрос сброса пароля',
                'verbose_name_plural': 'Запросы сброса пароля',
                'ordering': ['-created_at'],
            },
        ),
    ]
