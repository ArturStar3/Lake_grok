import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0042_los_radar_zone_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='PersonSections',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=250, verbose_name='Название раздела')),
                ('order', models.PositiveSmallIntegerField(default=1, verbose_name='Порядок')),
                ('is_hidden', models.BooleanField(default=False, verbose_name='Скрыть раздел')),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='children', to='formular.personsections', verbose_name='Родительский раздел')),
            ],
            options={
                'verbose_name': 'Раздел персоналий',
                'verbose_name_plural': 'Разделы персоналий',
                'ordering': ['order', 'title'],
            },
        ),
        migrations.CreateModel(
            name='RelationType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=150, verbose_name='Название (прямое)')),
                ('reverse_title', models.CharField(blank=True, help_text='Если пусто — совпадает с прямым (симметричная связь)', max_length=150, verbose_name='Название (обратное)')),
            ],
            options={
                'verbose_name': 'Характер связи',
                'verbose_name_plural': 'Характеры связей',
                'ordering': ['title'],
            },
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True, verbose_name='Уникальный идентификатор')),
                ('full_name', models.CharField(max_length=250, verbose_name='ФИО')),
                ('position', models.CharField(blank=True, max_length=250, verbose_name='Должность')),
                ('target', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='persons', to='formular.target', verbose_name='Объект')),
            ],
            options={
                'verbose_name': 'Лицо',
                'verbose_name_plural': 'Список лиц',
            },
        ),
        migrations.CreateModel(
            name='PersonInfo',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True, verbose_name='Уникальный идентификатор')),
                ('content', models.TextField(blank=True, null=True, verbose_name='Содержание')),
                ('person', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='info', to='formular.person', verbose_name='Лицо')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='person_sections', to='formular.personsections', verbose_name='Раздел')),
            ],
            options={
                'verbose_name': 'Данные по лицу',
                'verbose_name_plural': 'Данные по лицам',
            },
        ),
        migrations.CreateModel(
            name='PersonAttachment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True, verbose_name='Уникальный идентификатор')),
                ('title', models.CharField(max_length=250, verbose_name='Название')),
                ('description', models.TextField(blank=True, null=True, verbose_name='Описание')),
                ('image', models.ImageField(upload_to='person_attachments', verbose_name='Изображение')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('person', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='formular.person', verbose_name='Лицо')),
                ('section', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='formular.personsections', verbose_name='Раздел')),
            ],
            options={
                'verbose_name': 'Изображение персоналии',
                'verbose_name_plural': 'Изображения персоналий',
            },
        ),
        migrations.CreateModel(
            name='PersonRelation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notes', models.CharField(blank=True, max_length=250, verbose_name='Примечание')),
                ('person_from', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='relations_from', to='formular.person', verbose_name='Лицо (от)')),
                ('person_to', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='relations_to', to='formular.person', verbose_name='Лицо (к)')),
                ('relation_type', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='relations', to='formular.relationtype', verbose_name='Характер связи')),
            ],
            options={
                'verbose_name': 'Связь между лицами',
                'verbose_name_plural': 'Связи между лицами',
            },
        ),
        migrations.AddIndex(
            model_name='personsections',
            index=models.Index(fields=['title'], name='formular_pe_title_8a1f2c_idx'),
        ),
        migrations.AddIndex(
            model_name='person',
            index=models.Index(fields=['target'], name='formular_pe_target__b3c4d5_idx'),
        ),
        migrations.AddIndex(
            model_name='personinfo',
            index=models.Index(fields=['person'], name='formular_pe_person__e6f7a8_idx'),
        ),
        migrations.AddIndex(
            model_name='personinfo',
            index=models.Index(fields=['section'], name='formular_pe_section_9b0c1d_idx'),
        ),
        migrations.AddIndex(
            model_name='personattachment',
            index=models.Index(fields=['person'], name='formular_pe_person__2e3f4a_idx'),
        ),
        migrations.AddIndex(
            model_name='personattachment',
            index=models.Index(fields=['section'], name='formular_pe_section_5b6c7d_idx'),
        ),
        migrations.AddIndex(
            model_name='personrelation',
            index=models.Index(fields=['person_from'], name='formular_pe_person__8e9f0a_idx'),
        ),
        migrations.AddIndex(
            model_name='personrelation',
            index=models.Index(fields=['person_to'], name='formular_pe_person__1b2c3d_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='personrelation',
            unique_together={('person_from', 'person_to', 'relation_type')},
        ),
    ]
