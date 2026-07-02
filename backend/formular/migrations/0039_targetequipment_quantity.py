from django.core.validators import MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('equipment', '0004_remove_equipmentparameterdefinition_order'),
        ('formular', '0038_target_equipment_m2m'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE formular_target_equipment '
                'ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1'
            ),
            reverse_sql=(
                'ALTER TABLE formular_target_equipment '
                'DROP COLUMN IF EXISTS quantity'
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.CreateModel(
                    name='TargetEquipment',
                    fields=[
                        (
                            'id',
                            models.BigAutoField(
                                auto_created=True,
                                primary_key=True,
                                serialize=False,
                                verbose_name='ID',
                            ),
                        ),
                        (
                            'quantity',
                            models.PositiveIntegerField(
                                default=1,
                                validators=[
                                    MinValueValidator(
                                        1,
                                        message='Количество должно быть не меньше 1',
                                    ),
                                ],
                                verbose_name='Количество',
                            ),
                        ),
                        (
                            'equipment',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='target_links',
                                to='equipment.equipment',
                                verbose_name='Образец техники',
                            ),
                        ),
                        (
                            'target',
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='equipment_links',
                                to='formular.target',
                                verbose_name='Объект разведки',
                            ),
                        ),
                    ],
                    options={
                        'verbose_name': 'Техника на объекте',
                        'verbose_name_plural': 'Вооружение и техника',
                        'db_table': 'formular_target_equipment',
                        'indexes': [
                            models.Index(
                                fields=['target'],
                                name='formular_te_target__a1f2c3_idx',
                            ),
                            models.Index(
                                fields=['equipment'],
                                name='formular_te_equipme_b4d5e6_idx',
                            ),
                        ],
                        'constraints': [
                            models.UniqueConstraint(
                                fields=('target', 'equipment'),
                                name='formular_target_equipment_unique',
                            ),
                        ],
                    },
                ),
                migrations.AlterField(
                    model_name='target',
                    name='equipment',
                    field=models.ManyToManyField(
                        blank=True,
                        related_name='targets',
                        through='formular.TargetEquipment',
                        to='equipment.equipment',
                        verbose_name='Техника на объекте',
                    ),
                ),
            ],
        ),
    ]
