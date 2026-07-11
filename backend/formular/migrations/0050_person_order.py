from django.db import migrations, models


def assign_person_order(apps, schema_editor):
    Person = apps.get_model('formular', 'Person')
    target_ids = Person.objects.values_list('target_id', flat=True).distinct()
    for target_id in target_ids:
        persons = Person.objects.filter(target_id=target_id).order_by('full_name', 'id')
        for index, person in enumerate(persons, start=1):
            person.order = index
            person.save(update_fields=['order'])


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0049_rename_formular_os_sitdate_idx_formular_op_situati_2cbc23_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='person',
            name='order',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Порядок отображения в списке персоналий объекта',
                verbose_name='Порядок',
            ),
        ),
        migrations.AlterModelOptions(
            name='person',
            options={
                'ordering': ('order', 'full_name'),
                'verbose_name': 'Лицо',
                'verbose_name_plural': 'Список лиц',
            },
        ),
        migrations.RunPython(assign_person_order, migrations.RunPython.noop),
    ]
