from django.core.management.base import BaseCommand

from reports.models import ReportSection, ReportTemplate

SYSTEM_TEMPLATES = (
    {
        'name': 'Полный отчёт по стране',
        'description': 'Досье выбранных стран и подробные формуляры всех объектов этих стран.',
        'section_type': ReportSection.SectionType.COUNTRY_FULL,
    },
    {
        'name': 'Полный отчёт по объектам',
        'description': 'Подробные формуляры выбранных объектов: разделы, зоны, техника, уязвимости.',
        'section_type': ReportSection.SectionType.OBJECTS_FULL,
    },
)


class Command(BaseCommand):
    help = 'Создать системные шаблоны полных отчётов (по стране / по объектам)'

    def handle(self, *args, **options):
        for spec in SYSTEM_TEMPLATES:
            template, created = ReportTemplate.objects.get_or_create(
                name=spec['name'],
                defaults={
                    'description': spec['description'],
                    'created_by': None,
                },
            )
            if not created and not template.description:
                template.description = spec['description']
                template.save(update_fields=['description'])

            section = template.sections.filter(section_type=spec['section_type']).first()
            if section is None:
                template.sections.all().delete()
                ReportSection.objects.create(
                    template=template,
                    section_type=spec['section_type'],
                    title=spec['name'],
                    order=0,
                    filters={},
                    page_break_before=False,
                )
                action = 'создан' if created else 'обновлён'
            else:
                action = 'уже есть' if not created else 'создан'

            self.stdout.write(self.style.SUCCESS(
                f"Шаблон «{template.name}» — {action}"
            ))
