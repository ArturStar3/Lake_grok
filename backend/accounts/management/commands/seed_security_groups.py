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
                'formular': ModuleLevel.WRITE,
                'country_dossier': ModuleLevel.READ,
                'persons': ModuleLevel.READ,
                'equipment': ModuleLevel.READ,
                'can_delete': False,
            },
        )
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
                'formular': ModuleLevel.READ,
                'country_dossier': ModuleLevel.READ,
                'persons': ModuleLevel.READ,
                'equipment': ModuleLevel.READ,
            },
        )
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{operators.name}»"
        ))

        admins, created = SecurityGroup.objects.get_or_create(
            name='Администраторы',
            defaults={
                'description': 'Полный доступ ко всем странам и управление пользователями',
                'targets': ModuleLevel.WRITE,
                'events': ModuleLevel.WRITE,
                'formular': ModuleLevel.WRITE,
                'country_dossier': ModuleLevel.WRITE,
                'persons': ModuleLevel.WRITE,
                'equipment': ModuleLevel.WRITE,
                'can_delete': True,
                'can_manage_reference': True,
                'can_manage_users': True,
                'can_approve_registrations': True,
            },
        )
        if created:
            admins.countries.set(Country.objects.all())
        self.stdout.write(self.style.SUCCESS(
            f"{'Создана' if created else 'Обновлена'} группа «{admins.name}»"
        ))
