from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('formular', '0047_operational_situations'),
    ]

    operations = [
        migrations.AddField(
            model_name='operationalsituationrevision',
            name='situation_time',
            field=models.TimeField(blank=True, null=True, verbose_name='Время обстановки'),
        ),
    ]
