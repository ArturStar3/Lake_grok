from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0004_remove_equipmentparameterdefinition_order'),
    ]

    operations = [
        migrations.AddField(
            model_name='equipment',
            name='image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='equipment',
                verbose_name='Изображение',
            ),
        ),
    ]
