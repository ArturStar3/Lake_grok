# Generated manually

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0046_zone_modes_refactor'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OperationalSituation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, verbose_name='Уникальный идентификатор')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания серии')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='operational_situations_created', to=settings.AUTH_USER_MODEL, verbose_name='Автор')),
            ],
            options={
                'verbose_name': 'Оперативная обстановка',
                'verbose_name_plural': 'Оперативные обстановки',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='OperationalSituationRevision',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, verbose_name='Уникальный идентификатор')),
                ('version', models.PositiveIntegerField(verbose_name='Версия')),
                ('title', models.CharField(max_length=255, verbose_name='Название')),
                ('description', models.TextField(blank=True, verbose_name='Описание')),
                ('situation_date', models.DateField(blank=True, null=True, verbose_name='Дата обстановки')),
                ('color', models.CharField(default='#2f80ed', max_length=7, verbose_name='Цвет')),
                ('geometry', models.JSONField(blank=True, default=dict, verbose_name='Геометрия (GeoJSON)')),
                ('change_kind', models.CharField(choices=[('initial', 'Создание'), ('correction', 'Исправление'), ('new_state', 'Новое состояние'), ('fork', 'На основе другой обстановки')], default='initial', max_length=20, verbose_name='Тип изменения')),
                ('change_note', models.TextField(blank=True, verbose_name='Комментарий к изменению')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата фиксации')),
                ('countries', models.ManyToManyField(blank=True, related_name='operational_situation_revisions', to='formular.country', verbose_name='Затронутые страны')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='operational_situation_revisions_created', to=settings.AUTH_USER_MODEL, verbose_name='Автор')),
                ('parent_revision', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='child_revisions', to='formular.operationalsituationrevision', verbose_name='Предыдущая ревизия')),
                ('situation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='revisions', to='formular.operationalsituation', verbose_name='Обстановка')),
            ],
            options={
                'verbose_name': 'Ревизия оперативной обстановки',
                'verbose_name_plural': 'Ревизии оперативной обстановки',
                'ordering': ['situation_id', 'version'],
            },
        ),
        migrations.AddField(
            model_name='operationalsituation',
            name='current_revision',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='formular.operationalsituationrevision', verbose_name='Текущая ревизия'),
        ),
        migrations.AddIndex(
            model_name='operationalsituationrevision',
            index=models.Index(fields=['situation_date'], name='formular_os_sitdate_idx'),
        ),
        migrations.AddIndex(
            model_name='operationalsituationrevision',
            index=models.Index(fields=['created_at'], name='formular_os_created_idx'),
        ),
        migrations.AddConstraint(
            model_name='operationalsituationrevision',
            constraint=models.UniqueConstraint(fields=('situation', 'version'), name='uniq_operational_situation_version'),
        ),
    ]
