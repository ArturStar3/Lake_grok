from django.core.management.base import BaseCommand

from accounts.enums import ModuleLevel
from accounts.models import SecurityGroup
from formular.models import Country

MIDDLE_EAST_ISO = {
  'IRQ', 'IRN', 'ISR', 'JOR', 'KWT', 'LBN', 'OMN', 'PSE', 'QAT', 'SAU', 'SYR', 'TUR', 'ARE', 'YEM',
}


def _ensure_module(group, field, desired, update_fields, *, upgrade_only=False):
    current = getattr(group, field)
    if current == ModuleLevel.NONE:
        setattr(group, field, desired)
        update_fields.append(field)
        return
    if upgrade_only and current != desired:
        rank = {ModuleLevel.NONE: 0, ModuleLevel.READ: 1, ModuleLevel.WRITE: 2, ModuleLevel.WRITE_DELETE: 3}
        if rank.get(current, 0) < rank.get(desired, 0):
            setattr(group, field, desired)
            update_fields.append(field)


class Command(BaseCommand):
    help = 'Создать базовые группы безопасности'

    def handle(self, *args, **options):
        me_countries = Country.objects.filter(iso_code__in=MIDDLE_EAST_ISO)
        group, created = SecurityGroup.objects.get_or_create(
            name='Ближний Восток',
            defaults={
                'description': 'Доступ к данным стран Ближнего Востока (просмотр и редактирование)',
                'targets': ModuleLevel.WRITE,
                'events': ModuleLevel.WRITE,
                'operational_situations': ModuleLevel.WRITE,
                'formular': ModuleLevel.WRITE,
                'country_dossier': ModuleLevel.READ,
                'persons': ModuleLevel.READ,
                'equipment': ModuleLevel.READ,
                'reports': ModuleLevel.WRITE,
                'data_exchange': ModuleLevel.WRITE,
            },
        )
        if not created:
            update_fields = []
            _ensure_module(group, 'operational_situations', ModuleLevel.WRITE, update_fields)
            _ensure_module(group, 'reports', ModuleLevel.WRITE, update_fields)
            _ensure_module(group, 'data_exchange', ModuleLevel.WRITE, update_fields)
            if update_fields:
                group.save(update_fields=update_fields)
        if me_countries.exists():
            group.countries.set(me_countries)
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{group.name}» ({group.countries.count()} стран)"
        ))

        operators, created = SecurityGroup.objects.get_or_create(
            name='Операторы (только чтение)',
            defaults={
                'description': 'Просмотр объектов и событий по назначенным странам',
                'targets': ModuleLevel.READ,
                'events': ModuleLevel.READ,
                'operational_situations': ModuleLevel.READ,
                'formular': ModuleLevel.READ,
                'country_dossier': ModuleLevel.READ,
                'persons': ModuleLevel.READ,
                'equipment': ModuleLevel.READ,
                'reports': ModuleLevel.READ,
                'data_exchange': ModuleLevel.READ,
            },
        )
        if not created:
            update_fields = []
            _ensure_module(operators, 'operational_situations', ModuleLevel.READ, update_fields)
            _ensure_module(operators, 'reports', ModuleLevel.READ, update_fields)
            _ensure_module(operators, 'data_exchange', ModuleLevel.READ, update_fields)
            if update_fields:
                operators.save(update_fields=update_fields)
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{operators.name}»"
        ))

        admins, created = SecurityGroup.objects.get_or_create(
            name='Администраторы',
            defaults={
                'description': 'Полный доступ ко всем странам и управление пользователями',
                'targets': ModuleLevel.WRITE_DELETE,
                'events': ModuleLevel.WRITE_DELETE,
                'operational_situations': ModuleLevel.WRITE_DELETE,
                'formular': ModuleLevel.WRITE,
                'country_dossier': ModuleLevel.WRITE,
                'persons': ModuleLevel.WRITE_DELETE,
                'equipment': ModuleLevel.WRITE,
                'reports': ModuleLevel.WRITE_DELETE,
                'data_exchange': ModuleLevel.WRITE_DELETE,
                'can_manage_reference': True,
                'can_manage_users': True,
                'can_approve_registrations': True,
            },
        )
        if not created:
            update_fields = []
            _ensure_module(admins, 'operational_situations', ModuleLevel.WRITE, update_fields)
            _ensure_module(admins, 'reports', ModuleLevel.WRITE_DELETE, update_fields, upgrade_only=True)
            _ensure_module(admins, 'data_exchange', ModuleLevel.WRITE_DELETE, update_fields, upgrade_only=True)
            if update_fields:
                admins.save(update_fields=update_fields)
        if created:
            admins.countries.set(Country.objects.all())
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{admins.name}»"
        ))
