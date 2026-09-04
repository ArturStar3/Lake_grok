from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0060_demo_stages_data'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='demoscenariostep',
            constraint=models.UniqueConstraint(
                fields=('stage', 'order'),
                name='uniq_demo_scenario_stage_step_order',
            ),
        ),
        migrations.AddIndex(
            model_name='demoscenariostep',
            index=models.Index(fields=['stage', 'order'], name='formular_de_stage_order_idx'),
        ),
    ]
