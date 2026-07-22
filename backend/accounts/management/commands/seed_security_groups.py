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
            },
        )
        if not created:
            group.operational_situations = ModuleLevel.WRITE
            group.save(update_fields=['operational_situations'])
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
            },
        )
        if not created:
            group_level = operators.operational_situations
            if group_level == ModuleLevel.NONE:
                operators.operational_situations = ModuleLevel.READ
                operators.save(update_fields=['operational_situations'])
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
                'can_manage_reference': True,
                'can_manage_users': True,
                'can_approve_registrations': True,
            },
        )
        if not created:
            admins.operational_situations = ModuleLevel.WRITE
            admins.save(update_fields=['operational_situations'])
        if created:
            admins.countries.set(Country.objects.all())
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{admins.name}»"
        ))
