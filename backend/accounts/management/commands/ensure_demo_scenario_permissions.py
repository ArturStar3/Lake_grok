"""Выдаёт право «Сценарии демонстрации» группам, у которых есть доступ к объектам."""

from django.core.management.base import BaseCommand

from accounts.enums import ModuleLevel
from accounts.models import SecurityGroup

RANK = {
    ModuleLevel.NONE: 0,
    ModuleLevel.READ: 1,
    ModuleLevel.WRITE: 2,
    ModuleLevel.WRITE_DELETE: 3,
}


class Command(BaseCommand):
    help = 'Заполнить demo_scenarios у групп по уровню доступа к объектам'

    def handle(self, *args, **options):
        updated = 0
        for group in SecurityGroup.objects.all():
            desired = ModuleLevel.NONE
            if group.can_manage_users:
                desired = ModuleLevel.WRITE_DELETE
            else:
                targets_level = RANK.get(group.targets, 0)
                if targets_level >= RANK[ModuleLevel.WRITE]:
                    desired = ModuleLevel.WRITE
                elif targets_level >= RANK[ModuleLevel.READ]:
                    desired = ModuleLevel.READ
            if RANK.get(group.demo_scenarios, 0) >= RANK.get(desired, 0) or desired == ModuleLevel.NONE:
                continue
            group.demo_scenarios = desired
            group.save(update_fields=['demo_scenarios'])
            updated += 1
            self.stdout.write(f'  {group.name}: {desired}')
        self.stdout.write(self.style.SUCCESS(f'Обновлено групп: {updated}'))
