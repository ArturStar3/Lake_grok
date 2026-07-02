from django.db import migrations, models


def migrate_equipment_image_to_images(apps, schema_editor):
    Equipment = apps.get_model('equipment', 'Equipment')
    EquipmentImage = apps.get_model('equipment', 'EquipmentImage')
    for equipment in Equipment.objects.all():
        if not equipment.image:
            continue
        EquipmentImage.objects.create(
            equipment_id=equipment.id,
            image=equipment.image,
            title='',
            order=0,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0005_equipment_image'),
    ]

    operations = [
        migrations.CreateModel(
            name='EquipmentImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(blank=True, max_length=250, verbose_name='Название')),
                ('image', models.ImageField(upload_to='equipment', verbose_name='Изображение')),
                ('order', models.PositiveSmallIntegerField(default=0, verbose_name='Порядок')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Создано')),
                ('equipment', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='images',
                    to='equipment.equipment',
                    verbose_name='Образец техники',
                )),
            ],
            options={
                'verbose_name': 'Изображение техники',
                'verbose_name_plural': 'Изображения техники',
                'db_table': 'formular_equipmentimage',
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='equipmentimage',
            index=models.Index(fields=['equipment'], name='formular_eq_equipme_idx'),
        ),
        migrations.RunPython(migrate_equipment_image_to_images, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='equipment',
            name='image',
        ),
    ]
