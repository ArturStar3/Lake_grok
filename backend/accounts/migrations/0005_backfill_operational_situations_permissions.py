from django.db import migrations


def backfill_operational_situations(apps, schema_editor):
    SecurityGroup = apps.get_model('accounts', 'SecurityGroup')
    for group in SecurityGroup.objects.filter(operational_situations='none'):
        # Наследуем уровень доступа от «События» — типичный сценарий для оперативной обстановки.
        events_level = getattr(group, 'events', 'none')
        targets_level = getattr(group, 'targets', 'none')
        level_rank = {'none': 0, 'read': 1, 'write': 2}
        best = events_level
        if level_rank.get(targets_level, 0) > level_rank.get(best, 0):
            best = targets_level
        if level_rank.get(best, 0) > 0:
            group.operational_situations = best
            group.save(update_fields=['operational_situations'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_securitygroup_operational_situations'),
    ]

    operations = [
        migrations.RunPython(backfill_operational_situations, migrations.RunPython.noop),
    ]
