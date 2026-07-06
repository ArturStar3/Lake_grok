import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0043_person_domain'),
    ]

    operations = [
        migrations.CreateModel(
            name='PersonPhoto',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True, verbose_name='Уникальный идентификатор')),
                ('title', models.CharField(blank=True, default='', max_length=250, verbose_name='Название')),
                ('image', models.ImageField(upload_to='person_photos', verbose_name='Изображение')),
                ('order', models.PositiveIntegerField(default=1, help_text='Фото с order=1 используется как аватар', verbose_name='Порядок')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('person', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='photos', to='formular.person', verbose_name='Лицо')),
            ],
            options={
                'verbose_name': 'Фото лица',
                'verbose_name_plural': 'Фото лиц',
                'ordering': ['order', 'created_at'],
                'indexes': [models.Index(fields=['person', 'order'], name='formular_pe_person__a8f4c2_idx')],
            },
        ),
    ]
