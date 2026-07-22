# Generated manually for write_delete module level and removal of can_delete

from django.db import migrations, models

from accounts.enums import DELETE_CAPABLE_MODULES, ModuleLevel

MODULE_FIELD_NAMES = (
    'targets',
    'events',
    'formular',
    'country_dossier',
    'persons',
    'equipment',
    'operational_situations',
)

MODULE_VERBOSE = {
    'targets': 'Объекты',
    'events': 'События',
    'formular': 'Формуляр',
    'country_dossier': 'Досье страны',
    'persons': 'Персоналии',
    'equipment': 'Техника',
    'operational_situations': 'Оперативная обстановка',
}


def upgrade_can_delete_to_write_delete(apps, schema_editor):
    SecurityGroup = apps.get_model('accounts', 'SecurityGroup')
    write = ModuleLevel.WRITE
    write_delete = ModuleLevel.WRITE_DELETE
    for group in SecurityGroup.objects.filter(can_delete=True):
        update_fields = []
        for module in DELETE_CAPABLE_MODULES:
            if getattr(group, module) == write:
                setattr(group, module, write_delete)
                update_fields.append(module)
        if update_fields:
            group.save(update_fields=update_fields)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_alter_authauditlog_action'),
    ]

    operations = [
        *[
            migrations.AlterField(
                model_name='securitygroup',
                name=field_name,
                field=models.CharField(
                    choices=[
                        ('none', 'Нет доступа'),
                        ('read', 'Просмотр'),
                        ('write', 'Редактирование'),
                        ('write_delete', 'Редактирование и удаление'),
                    ],
                    default='none',
                    max_length=16,
                    verbose_name=MODULE_VERBOSE[field_name],
                ),
            )
            for field_name in MODULE_FIELD_NAMES
        ],
        migrations.RunPython(upgrade_can_delete_to_write_delete, noop_reverse),
        migrations.RemoveField(
            model_name='securitygroup',
            name='can_delete',
        ),
    ]
