# Generated manually for consolidation: MilitaryBranch -> TargetType
# TargetType now carries the 'countries' M2M and branch FK now points to it.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0029_militarybranch_target_branch_and_more'),
    ]

    operations = [
        # Add countries M2M to TargetType (Django will create the through table automatically)
        migrations.AddField(
            model_name='targettype',
            name='countries',
            field=models.ManyToManyField(
                blank=True,
                help_text='Если список пуст — тип применим ко всем странам',
                related_name='applicable_target_types',
                to='formular.country',
                verbose_name='Применимо к странам'
            ),
        ),
        # Alter Target.branch FK target model from (removed) MilitaryBranch to TargetType
        migrations.AlterField(
            model_name='target',
            name='branch',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='targets',
                to='formular.targettype',
                verbose_name='Вид / род войск'
            ),
        ),
        # Delete the obsolete MilitaryBranch model + its table
        migrations.DeleteModel(
            name='MilitaryBranch',
        ),
        # IMPORTANT:
        # - Existing branch assignments on Target objects will be lost (FK targets change).
        # - After `migrate`, re-assign "Вид / род войск" in admin if you had data.
        # - Run: python manage.py makemigrations  (if you want Django to adjust this file)
        #   then python manage.py migrate
    ]
