# Синхронизация имён индексов TargetEquipment в state Django.
# Таблица formular_target_equipment уже имеет индексы по FK (0038/0039);
# явные индексы из 0039 в БД не создавались (SeparateDatabaseAndState).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0039_targetequipment_quantity'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveIndex(
                    model_name='targetequipment',
                    name='formular_te_target__a1f2c3_idx',
                ),
                migrations.RemoveIndex(
                    model_name='targetequipment',
                    name='formular_te_equipme_b4d5e6_idx',
                ),
                migrations.AddIndex(
                    model_name='targetequipment',
                    index=models.Index(
                        fields=['target'],
                        name='formular_ta_target__849e33_idx',
                    ),
                ),
                migrations.AddIndex(
                    model_name='targetequipment',
                    index=models.Index(
                        fields=['equipment'],
                        name='formular_ta_equipme_4c72a7_idx',
                    ),
                ),
            ],
        ),
    ]
