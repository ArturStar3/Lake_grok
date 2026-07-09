from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0007_rename_formular_eq_equipme_idx_formular_eq_equipme_adec40_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='equipmentparameterdefinition',
            name='zone_color',
            field=models.CharField(
                blank=True,
                help_text='Пусто — наследуется из типа действия',
                max_length=7,
                null=True,
                verbose_name='Цвет зоны (переопределение)',
            ),
        ),
        migrations.AddField(
            model_name='equipmentparameterdefinition',
            name='zone_line_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('solid', 'Сплошная линия'),
                    ('dashed', 'Пунктирная линия'),
                    ('dash_dot', 'Тире точка'),
                    ('dash_x', 'Тире крест'),
                ],
                help_text='Пусто — наследуется из типа действия',
                max_length=20,
                null=True,
                verbose_name='Тип линии (переопределение)',
            ),
        ),
    ]
