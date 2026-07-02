from django.core.management.base import BaseCommand
from django.db import transaction

from formular.models import Country, Target
from formular.target_hierarchy import assign_hierarchy_for_country, command_level


class Command(BaseCommand):
    help = (
        'Перестраивает иерархию подчинённости Target.parent внутри каждой страны: '
        'многоуровневое дерево командования и привязка инфраструктуры к звеньям.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--iso',
            type=str,
            default='',
            help='Обработать только страну с указанным ISO-кодом',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Только показать статистику без сохранения',
        )

    def handle(self, *args, **options):
        iso = (options['iso'] or '').strip().upper()
        dry_run = options['dry_run']

        countries = Country.objects.all().order_by('title')
        if iso:
            countries = countries.filter(iso_code=iso)
            if not countries.exists():
                self.stderr.write(self.style.ERROR(f'Страна {iso} не найдена'))
                return

        total_updated = 0

        with transaction.atomic():
            for country in countries:
                targets = list(
                    Target.objects.filter(country=country).select_related('type', 'parent')
                )
                if not targets:
                    continue

                assignments = assign_hierarchy_for_country(targets)
                to_update = []

                for target in targets:
                    new_parent_id = assignments.get(target.id)
                    if target.parent_id != new_parent_id:
                        target.parent_id = new_parent_id
                        to_update.append(target)

                if not dry_run and to_update:
                    Target.objects.bulk_update(to_update, ['parent'], batch_size=500)

                total_updated += len(to_update)
                self._print_country_stats(
                    country, targets, assignments, len(to_update), dry_run
                )

        verb = 'Будет обновлено' if dry_run else 'Обновлено'
        self.stdout.write(self.style.SUCCESS(f'{verb} связей parent: {total_updated}'))

    def _print_country_stats(self, country, targets, assignments, changed, dry_run):
        roots = sum(1 for t in targets if assignments.get(t.id) is None)
        with_parent = len(targets) - roots

        children_count = {t.id: 0 for t in targets}
        for target in targets:
            parent_id = assignments.get(target.id)
            if parent_id:
                children_count[parent_id] = children_count.get(parent_id, 0) + 1

        max_children = max(children_count.values()) if children_count else 0
        top_parent = None
        for target_id, count in children_count.items():
            if count == max_children and count > 0:
                top_parent = next((t for t in targets if t.id == target_id), None)
                break

        level_counts = {}
        for target in targets:
            level = command_level(target.type.title if target.type_id else '')
            key = f'L{level}' if level is not None else 'infra'
            level_counts[key] = level_counts.get(key, 0) + 1

        prefix = '[dry-run] ' if dry_run else ''
        self.stdout.write(
            f"{prefix}{country.iso_code} ({country.title}): "
            f"объектов={len(targets)}, корней={roots}, с родителем={with_parent}, "
            f"изменено={changed}"
        )
        if top_parent and max_children > 5:
            self.stdout.write(
                f"  max children: {max_children} -> {top_parent.title[:60]}"
            )
        self.stdout.write(f"  уровни: {dict(sorted(level_counts.items()))}")

        samples = [
            t for t in targets
            if t.type_id and t.type.title in (
                'Дивизия', 'ПУ полка', 'ПУ батальона', 'Авиабаза', 'Оперативное командование',
            )
        ][:5]
        for sample in samples:
            parent_id = assignments.get(sample.id)
            if parent_id:
                parent_title = next(
                    (t.title for t in targets if t.id == parent_id),
                    '—',
                )
            else:
                parent_title = '—'
            self.stdout.write(
                f"  {sample.type.title}: {sample.title[:35]} -> {parent_title[:35]}"
            )
