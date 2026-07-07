from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('formular', '0046_zone_modes_refactor'),
        migrations.swappable_dependency('auth.user'),
    ]

    operations = [
        migrations.CreateModel(
            name='SecurityGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150, unique=True, verbose_name='Название')),
                ('description', models.TextField(blank=True, verbose_name='Описание')),
                ('targets', models.CharField(choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')], default='none', max_length=10, verbose_name='Объекты')),
                ('events', models.CharField(choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')], default='none', max_length=10, verbose_name='События')),
                ('formular', models.CharField(choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')], default='none', max_length=10, verbose_name='Формуляр')),
                ('country_dossier', models.CharField(choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')], default='none', max_length=10, verbose_name='Досье страны')),
                ('persons', models.CharField(choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')], default='none', max_length=10, verbose_name='Персоналии')),
                ('equipment', models.CharField(choices=[('none', 'Нет доступа'), ('read', 'Просмотр'), ('write', 'Редактирование')], default='none', max_length=10, verbose_name='Техника')),
                ('can_delete', models.BooleanField(default=False, verbose_name='Удаление записей')),
                ('can_manage_reference', models.BooleanField(default=False, verbose_name='Справочники')),
                ('can_manage_users', models.BooleanField(default=False, verbose_name='Управление пользователями')),
                ('can_approve_registrations', models.BooleanField(default=False, verbose_name='Одобрение регистраций')),
                ('countries', models.ManyToManyField(blank=True, help_text='Пустой список — нет доступа к данным стран', related_name='security_groups', to='formular.country', verbose_name='Доступные страны')),
            ],
            options={
                'verbose_name': 'Группа безопасности',
                'verbose_name_plural': 'Группы безопасности',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Ожидает одобрения'), ('active', 'Активен'), ('blocked', 'Заблокирован')], default='pending', max_length=20, verbose_name='Статус')),
                ('must_change_password', models.BooleanField(default=False, verbose_name='Требуется смена пароля')),
                ('full_name', models.CharField(blank=True, max_length=200, verbose_name='ФИО')),
                ('registration_note', models.TextField(blank=True, verbose_name='Комментарий при регистрации')),
                ('approved_at', models.DateTimeField(blank=True, null=True, verbose_name='Дата одобрения')),
                ('last_login_ip', models.GenericIPAddressField(blank=True, null=True, verbose_name='Последний IP')),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_users', to='auth.user', verbose_name='Одобрил')),
                ('security_groups', models.ManyToManyField(blank=True, related_name='users', to='accounts.securitygroup', verbose_name='Группы безопасности')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to='auth.user', verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Профиль пользователя',
                'verbose_name_plural': 'Профили пользователей',
            },
        ),
        migrations.CreateModel(
            name='AuthAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('login_success', 'Успешный вход'), ('login_failed', 'Неудачный вход'), ('logout', 'Выход'), ('register', 'Регистрация'), ('password_change', 'Смена пароля'), ('password_reset', 'Сброс пароля'), ('user_approved', 'Одобрение пользователя'), ('user_blocked', 'Блокировка пользователя')], max_length=30, verbose_name='Действие')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='IP')),
                ('details', models.TextField(blank=True, verbose_name='Детали')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Время')),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='auth_actions', to='auth.user', verbose_name='Инициатор')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='auth_audit_logs', to='auth.user', verbose_name='Пользователь')),
            ],
            options={
                'verbose_name': 'Запись аудита',
                'verbose_name_plural': 'Журнал аудита',
                'ordering': ['-created_at'],
            },
        ),
    ]
