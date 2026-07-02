from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0040_rename_formular_te_target__a1f2c3_idx_formular_ta_target__849e33_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='targettype',
            name='order',
            field=models.PositiveSmallIntegerField(default=1, verbose_name='Порядок'),
        ),
        migrations.AddField(
            model_name='targettype',
            name='parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='children',
                to='formular.targettype',
                verbose_name='Родительский тип',
            ),
        ),
        migrations.AlterModelOptions(
            name='targettype',
            options={
                'ordering': ['order', 'title'],
                'verbose_name': 'Тип объекта разведки',
                'verbose_name_plural': 'Типы объектов разведки',
            },
        ),
    ]
