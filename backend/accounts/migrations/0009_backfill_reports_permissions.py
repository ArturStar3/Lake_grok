from django.db import migrations

from accounts.enums import ModuleLevel


def backfill_reports(apps, schema_editor):
    SecurityGroup = apps.get_model('accounts', 'SecurityGroup')
    rank = {
        'none': 0,
        'read': 1,
        'write': 2,
        'write_delete': 3,
    }
    for group in SecurityGroup.objects.all():
        if group.reports != 'none':
            continue
        # Админы с manage_users — полный доступ к отчётам
        if group.can_manage_users:
            group.reports = ModuleLevel.WRITE_DELETE
            group.save(update_fields=['reports'])
            continue
        # Иначе наследуем от targets (рабочий доступ к данным)
        targets_level = getattr(group, 'targets', 'none')
        if rank.get(targets_level, 0) >= rank['write']:
            group.reports = ModuleLevel.WRITE
        elif rank.get(targets_level, 0) >= rank['read']:
            group.reports = ModuleLevel.READ
        else:
            continue
        group.save(update_fields=['reports'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_securitygroup_reports'),
    ]

    operations = [
        migrations.RunPython(backfill_reports, noop_reverse),
    ]
