"""Аудит зон из ТТХ размещённой техники (диагностика для офлайн/прод)."""

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.services.permissions import get_allowed_country_ids
from equipment.services.zone_audit import (
    ISSUE_LABELS,
    ISSUE_MISSING_ACTION_TYPE,
    audit_equipment_zones,
    audit_parameter_values_without_zones,
    audit_parameters_missing_action_type,
)


class Command(BaseCommand):
    help = (
        'Проверить, почему зоны из параметров ТТХ техники не попадают в каталог «Зоны действия». '
        'Типичная причина: у параметра не заполнен «Тип зоны действия» в справочнике ТТХ.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--country',
            type=str,
            default=None,
            help='Фильтр по названию страны (как в obj.country.title)',
        )
        parser.add_argument(
            '--issue',
            type=str,
            default=None,
            help=f'Фильтр по коду проблемы: {", ".join(ISSUE_LABELS)}',
        )

        parser.add_argument(
            '--username',
            type=str,
            default=None,
            help='Проверить видимость объектов для пользователя (права на страны)',
        )

    def handle(self, *args, **options):
        country = options['country']
        issue_filter = options['issue']
        username = options['username']
        allowed = None

        if username:
            User = get_user_model()
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'Пользователь {username!r} не найден'))
                return
            allowed = get_allowed_country_ids(user)
            if allowed is None:
                self.stdout.write(self.style.SUCCESS(f'Пользователь {username}: доступ ко всем странам (superuser)'))
            elif not allowed:
                self.stdout.write(self.style.WARNING(f'Пользователь {username}: нет доступа ни к одной стране'))
            else:
                from formular.models import Country
                titles = list(
                    Country.objects.filter(pk__in=allowed).order_by('title').values_list('title', flat=True)
                )
                self.stdout.write(
                    self.style.NOTICE(
                        f'Пользователь {username}: доступ к {len(titles)} странам — {", ".join(titles[:12])}'
                        + (' …' if len(titles) > 12 else '')
                    )
                )
            self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('=== Параметры ТТХ без типа зоны (км) ==='))
        missing_defs = audit_parameters_missing_action_type()
        if missing_defs:
            for param in missing_defs:
                self.stdout.write(
                    f'  param #{param.id} {param.code!r} — {param.title} (unit: {param.unit.symbol})'
                )
        else:
            self.stdout.write('  OK — таких шаблонов параметров нет')

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('=== Значения ТТХ > 0 без action_type (потерянные зоны) ==='))
        lost_values = audit_parameter_values_without_zones()
        if lost_values:
            for pv in lost_values:
                eq = pv.equipment
                self.stdout.write(
                    f'  {eq.designation or eq.title}: {pv.parameter.title} = {pv.value} км '
                    f'(param #{pv.parameter_id}, code={pv.parameter.code})'
                )
        else:
            self.stdout.write('  OK — потерянных значений нет')

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('=== Развёрнутая техника на объектах ==='))
        rows = audit_equipment_zones(country_title=country)
        if issue_filter:
            rows = [r for r in rows if r.issue_code == issue_filter]

        if username and allowed is not None:
            from formular.models import Country
            allowed_titles = set(
                Country.objects.filter(pk__in=allowed).values_list('title', flat=True)
            )
            hidden = [r for r in rows if r.country_title not in allowed_titles]
            rows = [r for r in rows if r.country_title in allowed_titles]
            if hidden:
                self.stdout.write(
                    self.style.WARNING(
                        f'  Скрыто правами для {username}: {len(hidden)} проблем в других странах'
                    )
                )

        if not rows:
            self.stdout.write(self.style.SUCCESS('  OK — проблем на объектах не найдено'))
            return

        by_country = defaultdict(list)
        for row in rows:
            by_country[row.country_title].append(row)

        for c_title in sorted(by_country):
            self.stdout.write(self.style.WARNING(f'\n  [{c_title}]'))
            for row in by_country[c_title]:
                label = ISSUE_LABELS.get(row.issue_code, row.issue_code)
                self.stdout.write(
                    f'    {row.target_label} / {row.equipment_title}: '
                    f'{row.parameter_title} ({row.parameter_code}) = {row.value} — {label}'
                )

        self.stdout.write('')
        self.stdout.write(
            self.style.NOTICE(
                'Исправление: Django admin → Параметры техники → укажите «Тип зоны действия» '
                'и единицу «км»; на образце техники — значение радиуса > 0.'
            )
        )
