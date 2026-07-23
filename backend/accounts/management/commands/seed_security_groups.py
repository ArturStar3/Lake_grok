from django.core.management.base import BaseCommand

from accounts.enums import ModuleLevel
from accounts.models import SecurityGroup
from formular.models import Country

MIDDLE_EAST_ISO = {
  'IRQ', 'IRN', 'ISR', 'JOR', 'KWT', 'LBN', 'OMN', 'PSE', 'QAT', 'SAU', 'SYR', 'TUR', 'ARE', 'YEM',
}


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
            },
        )
        if not created:
            update_fields = []
            if group.operational_situations == ModuleLevel.NONE:
                group.operational_situations = ModuleLevel.WRITE
                update_fields.append('operational_situations')
            if group.reports == ModuleLevel.NONE:
                group.reports = ModuleLevel.WRITE
                update_fields.append('reports')
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
            },
        )
        if not created:
            update_fields = []
            if operators.operational_situations == ModuleLevel.NONE:
                operators.operational_situations = ModuleLevel.READ
                update_fields.append('operational_situations')
            if operators.reports == ModuleLevel.NONE:
                operators.reports = ModuleLevel.READ
                update_fields.append('reports')
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
                'can_manage_reference': True,
                'can_manage_users': True,
                'can_approve_registrations': True,
            },
        )
        if not created:
            update_fields = []
            if admins.operational_situations == ModuleLevel.NONE:
                admins.operational_situations = ModuleLevel.WRITE
                update_fields.append('operational_situations')
            if admins.reports in (ModuleLevel.NONE, ModuleLevel.READ, ModuleLevel.WRITE):
                if admins.reports != ModuleLevel.WRITE_DELETE:
                    admins.reports = ModuleLevel.WRITE_DELETE
                    update_fields.append('reports')
            if update_fields:
                admins.save(update_fields=update_fields)
        if created:
            admins.countries.set(Country.objects.all())
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{admins.name}»"
        ))
