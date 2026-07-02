from django.core.management.base import BaseCommand
from django.db import transaction

from formular.country_seed_data import (
    COUNTRY_CONTENT,
    DEFAULT_CONTENT,
    SECTION_SPECS,
)
from formular.models import Country, CountryInfo, CountrySections


class Command(BaseCommand):
    help = "Создать разделы информации по странам и заполнить демонстрационными данными"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Удалить существующие CountryInfo перед заполнением",
        )
        parser.add_argument(
            "--iso",
            nargs="*",
            help="Заполнить только указанные ISO-коды (например: RU US CN)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["clear"]:
            deleted, _ = CountryInfo.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Удалено записей CountryInfo: {deleted}"))

        section_by_key = self._ensure_sections()
        countries = Country.objects.all().order_by("iso_code", "id")

        if options["iso"]:
            iso_filter = {code.upper() for code in options["iso"]}
            countries = countries.filter(iso_code__in=iso_filter)

        if not countries.exists():
            self.stdout.write(self.style.ERROR("Страны не найдены в базе данных"))
            return

        created = 0
        updated = 0

        for country in countries:
            iso = (country.iso_code or "").upper()
            content_map = COUNTRY_CONTENT.get(iso, DEFAULT_CONTENT)

            for section_key, section in section_by_key.items():
                text = content_map.get(section_key) or DEFAULT_CONTENT.get(section_key, "")
                if not text:
                    continue

                obj, was_created = CountryInfo.objects.update_or_create(
                    country=country,
                    section=section,
                    defaults={"content": text},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

            self.stdout.write(f"  {country.title} ({iso})")

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово: разделов {len(section_by_key)}, создано {created}, обновлено {updated}"
            )
        )

    def _ensure_sections(self):
        section_by_key = {}

        for spec in SECTION_SPECS:
            if spec.get("children"):
                parent, _ = CountrySections.objects.update_or_create(
                    title=spec["title"],
                    parent=None,
                    defaults={
                        "order": spec["order"],
                        "is_hidden": False,
                    },
                )

                for child_spec in spec["children"]:
                    child, _ = CountrySections.objects.update_or_create(
                        title=child_spec["title"],
                        parent=parent,
                        defaults={
                            "order": child_spec["order"],
                            "is_hidden": False,
                        },
                    )
                    section_by_key[child_spec["key"]] = child
            else:
                section, _ = CountrySections.objects.update_or_create(
                    title=spec["title"],
                    parent=None,
                    defaults={
                        "order": spec["order"],
                        "is_hidden": False,
                    },
                )
                section_by_key[spec["key"]] = section

        return section_by_key
