from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reports', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='reportsection',
            name='section_type',
            field=models.CharField(
                choices=[
                    ('countries', 'Страны'),
                    ('targets', 'Объекты'),
                    ('equipment', 'Вооружение и техника'),
                    ('events', 'События'),
                    ('situations', 'Оперативная обстановка'),
                    ('zones', 'Зоны действия'),
                    ('vulnerabilities', 'Уязвимости'),
                    ('country_full', 'Полный отчёт по стране'),
                    ('objects_full', 'Полный отчёт по объектам'),
                ],
                max_length=32,
                verbose_name='Тип раздела',
            ),
        ),
    ]
