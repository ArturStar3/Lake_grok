# Generated manually for per-user map favorites

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_backfill_demo_scenarios_permissions'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MapFavorite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(
                    choices=[
                        ('object', 'Объект'),
                        ('event', 'Событие'),
                        ('formular', 'Формуляр'),
                        ('situation', 'Обстановка'),
                    ],
                    max_length=16,
                    verbose_name='Тип',
                )),
                ('entity_id', models.CharField(max_length=128, verbose_name='Идентификатор сущности')),
                ('card_id', models.CharField(blank=True, default='', max_length=128, verbose_name='Раздел формуляра')),
                ('title', models.CharField(max_length=160, verbose_name='Подпись')),
                ('source_title', models.CharField(blank=True, default='', max_length=160, verbose_name='Исходное название')),
                ('subtitle', models.CharField(blank=True, default='', max_length=160, verbose_name='Подзаголовок')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создан')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Обновлён')),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='map_favorites',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Пользователь',
                )),
            ],
            options={
                'verbose_name': 'Избранное карты',
                'verbose_name_plural': 'Избранное карты',
                'ordering': ['created_at', 'id'],
            },
        ),
        migrations.AddConstraint(
            model_name='mapfavorite',
            constraint=models.UniqueConstraint(
                fields=('user', 'kind', 'entity_id', 'card_id'),
                name='uniq_map_favorite_user_entity',
            ),
        ),
    ]
