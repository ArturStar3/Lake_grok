from django.db import migrations

from accounts.enums import ModuleLevel

RANK = {
    'none': 0,
    'read': 1,
    'write': 2,
    'write_delete': 3,
}


def backfill_demo_scenarios(apps, schema_editor):
    """Показ демонстрации доступен всем, кто видит объекты; настройка — редакторам."""
    SecurityGroup = apps.get_model('accounts', 'SecurityGroup')
    for group in SecurityGroup.objects.all():
        if group.demo_scenarios != 'none':
            continue
        if group.can_manage_users:
            group.demo_scenarios = ModuleLevel.WRITE_DELETE
        else:
            targets_level = RANK.get(getattr(group, 'targets', 'none'), 0)
            if targets_level >= RANK['write']:
                group.demo_scenarios = ModuleLevel.WRITE
            elif targets_level >= RANK['read']:
                group.demo_scenarios = ModuleLevel.READ
            else:
                continue
        group.save(update_fields=['demo_scenarios'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_securitygroup_demo_scenarios'),
    ]

    operations = [
        migrations.RunPython(backfill_demo_scenarios, noop_reverse),
    ]
