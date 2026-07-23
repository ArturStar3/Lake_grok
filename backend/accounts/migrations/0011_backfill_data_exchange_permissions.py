from django.db import migrations

from accounts.enums import ModuleLevel


def backfill_data_exchange(apps, schema_editor):
    SecurityGroup = apps.get_model('accounts', 'SecurityGroup')
    rank = {
        'none': 0,
        'read': 1,
        'write': 2,
        'write_delete': 3,
    }
    for group in SecurityGroup.objects.all():
        if group.data_exchange != 'none':
            continue
        if group.can_manage_users:
            group.data_exchange = ModuleLevel.WRITE_DELETE
            group.save(update_fields=['data_exchange'])
            continue
        targets_level = getattr(group, 'targets', 'none')
        if rank.get(targets_level, 0) >= rank['write']:
            group.data_exchange = ModuleLevel.WRITE
        elif rank.get(targets_level, 0) >= rank['read']:
            group.data_exchange = ModuleLevel.READ
        else:
            continue
        group.save(update_fields=['data_exchange'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_securitygroup_data_exchange'),
    ]

    operations = [
        migrations.RunPython(backfill_data_exchange, noop_reverse),
    ]
