"""
Заполнение всех моделей демонстрационными данными, приближенными к реальным.

Использование:
  python manage.py seed_demo_data
  python manage.py seed_demo_data --clear
"""

from datetime import datetime

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from equipment.models import Equipment, EquipmentImage
from formular.country_seed_data import SECTION_SPECS as COUNTRY_SECTION_SPECS
from formular.demo_seed_data import (
    COUNTRY_ATTACHMENT_SPECS,
    DEFAULT_FORMULAR_CONTENT,
    EVENT_SPECS,
    EVENT_TYPE_TITLES,
    FORMULAR_ATTACHMENT_SPECS,
    FORMULAR_CONTENT_BY_MARKER,
    FORMULAR_SECTION_SPECS,
    PERSON_PROFILES,
    PERSON_RELATIONS,
    PERSON_SECTION_SPECS,
    RELATION_TYPE_SPECS,
    SEED_TAG,
    TARGET_EQUIPMENT_SPECS,
)
from formular.models import (
    Country,
    CountryAttachment,
    CountrySections,
    Event,
    EventMarker,
    EventType,
    Formular,
    FormularAttachment,
    FormularSections,
    Person,
    PersonAttachment,
    PersonInfo,
    PersonPhoto,
    PersonRelation,
    PersonSections,
    RelationType,
    Target,
    TargetEquipment,
)
from formular.seed_placeholders import save_placeholder_image


DEMO_ATTACHMENT_PREFIX = '[демо] '
DEMO_PERSON_NAMES = {p['full_name'] for p in PERSON_PROFILES}


class Command(BaseCommand):
    help = 'Заполняет модели демонстрационными данными (изображения — заглушки)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Удалить ранее созданные демо-данные перед заполнением',
        )
        parser.add_argument(
            '--skip-country-info',
            action='store_true',
            help='Не вызывать seed_country_info',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self._clear_demo_data()

        with transaction.atomic():
            stats = {}
            stats['formular_sections'] = self._ensure_formular_sections()
            stats['person_sections'] = self._ensure_person_sections()
            stats['relation_types'] = self._ensure_relation_types()
            stats['event_types'] = self._ensure_event_types()
            stats['events'] = self._seed_events()
            stats['formular'] = self._seed_formular()
            stats['formular_attachments'] = self._seed_formular_attachments()
            stats['country_attachments'] = self._seed_country_attachments()
            stats['persons'] = self._seed_persons()
            stats['person_relations'] = self._seed_person_relations()
            stats['target_equipment'] = self._seed_target_equipment()
            stats['equipment_images'] = self._seed_equipment_images()
            self._remove_junk_test_data()

        if not options['skip_country_info']:
            call_command('seed_country_info')

        summary = ', '.join(f'{k}={v}' for k, v in stats.items())
        self.stdout.write(self.style.SUCCESS(f'Готово: {summary}'))

    def _clear_demo_data(self):
        deleted_events, _ = Event.objects.filter(
            description__contains=f'[{SEED_TAG}]',
        ).delete()
        deleted_persons, _ = Person.objects.filter(
            full_name__in=DEMO_PERSON_NAMES,
        ).delete()
        deleted_fa, _ = FormularAttachment.objects.filter(
            title__startswith=DEMO_ATTACHMENT_PREFIX,
        ).delete()
        deleted_ca, _ = CountryAttachment.objects.filter(
            title__startswith=DEMO_ATTACHMENT_PREFIX,
        ).delete()
        deleted_ei, _ = EquipmentImage.objects.filter(
            title__startswith=DEMO_ATTACHMENT_PREFIX,
        ).delete()

        demo_targets = self._demo_targets()
        deleted_formular, _ = Formular.objects.filter(target__in=demo_targets).delete()

        self.stdout.write(
            self.style.WARNING(
                f'Очищено: события={deleted_events}, лица={deleted_persons}, '
                f'формуляр={deleted_formular}, вложения формуляра={deleted_fa}, '
                f'вложения стран={deleted_ca}, изображения техники={deleted_ei}'
            )
        )

    def _remove_junk_test_data(self):
        removed, _ = Person.objects.filter(full_name__icontains='Банан').delete()
        if removed:
            self.stdout.write(f'  Удалены тестовые персоналии: {removed}')

    def _ensure_section_tree(self, specs, model):
        section_by_key = {}
        for spec in specs:
            if spec.get('children'):
                parent, _ = model.objects.update_or_create(
                    title=spec['title'],
                    parent=None,
                    defaults={'order': spec['order'], 'is_hidden': False},
                )
                for child_spec in spec['children']:
                    child, _ = model.objects.update_or_create(
                        title=child_spec['title'],
                        parent=parent,
                        defaults={
                            'order': child_spec['order'],
                            'is_hidden': False,
                        },
                    )
                    section_by_key[child_spec['key']] = child
            else:
                section, _ = model.objects.update_or_create(
                    title=spec['title'],
                    parent=None,
                    defaults={'order': spec['order'], 'is_hidden': False},
                )
                section_by_key[spec['key']] = section
        return section_by_key

    def _ensure_formular_sections(self):
        sections = self._ensure_section_tree(FORMULAR_SECTION_SPECS, FormularSections)
        self._formular_sections = sections
        return len(sections)

    def _ensure_person_sections(self):
        sections = self._ensure_section_tree(PERSON_SECTION_SPECS, PersonSections)
        self._person_sections = sections
        return len(sections)

    def _ensure_relation_types(self):
        count = 0
        for title, reverse_title in RELATION_TYPE_SPECS:
            _, created = RelationType.objects.update_or_create(
                title=title,
                defaults={'reverse_title': reverse_title},
            )
            if created:
                count += 1
        return RelationType.objects.count()

    def _ensure_event_types(self):
        for title in EVENT_TYPE_TITLES:
            EventType.objects.get_or_create(title=title)
        return EventType.objects.count()

    def _find_country(self, iso_code):
        return Country.objects.filter(iso_code__iexact=iso_code).order_by('id').first()

    def _find_target(self, title_part):
        return Target.objects.filter(title__icontains=title_part).order_by('id').first()

    def _demo_targets(self):
        titles = [
            'Авиабаза Энгельс',
            'РЛС Астана',
            'РЛС Алматы',
            'Стратегическое командование (РК-0352)',
        ]
        targets = []
        for part in titles:
            target = self._find_target(part)
            if target:
                targets.append(target)
        return targets

    def _formular_content_for_target(self, target):
        marker_title = target.marker.title if target.marker_id else ''
        for key, content_map in FORMULAR_CONTENT_BY_MARKER.items():
            if key in marker_title:
                return content_map
        if target.type_id and target.type.title:
            for key, content_map in FORMULAR_CONTENT_BY_MARKER.items():
                if key in target.type.title:
                    return content_map
        return DEFAULT_FORMULAR_CONTENT

    def _seed_formular(self):
        created = 0
        for target in self._demo_targets():
            content_map = self._formular_content_for_target(target)
            for section_key, section in self._formular_sections.items():
                text = content_map.get(section_key) or DEFAULT_FORMULAR_CONTENT.get(
                    section_key,
                )
                if not text:
                    continue
                _, was_created = Formular.objects.update_or_create(
                    target=target,
                    section=section,
                    defaults={'content': text},
                )
                if was_created:
                    created += 1
        return created

    def _seed_formular_attachments(self):
        created = 0
        for target_part, section_key, title, description in FORMULAR_ATTACHMENT_SPECS:
            target = self._find_target(target_part)
            section = self._formular_sections.get(section_key)
            if not target or not section:
                continue
            full_title = f'{DEMO_ATTACHMENT_PREFIX}{title}'
            attachment, was_created = FormularAttachment.objects.update_or_create(
                target=target,
                section=section,
                title=full_title,
                defaults={'description': description},
            )
            save_placeholder_image(
                attachment.image,
                f'demo_formular_{attachment.pk or "new"}.png',
            )
            attachment.save(update_fields=['image'])
            if was_created:
                created += 1
        return created

    def _country_sections_by_key(self):
        if hasattr(self, '_country_section_cache'):
            return self._country_section_cache

        section_by_key = {}
        for spec in COUNTRY_SECTION_SPECS:
            if spec.get('children'):
                parent = CountrySections.objects.filter(
                    title=spec['title'],
                    parent=None,
                ).first()
                for child_spec in spec['children']:
                    child = CountrySections.objects.filter(
                        title=child_spec['title'],
                        parent=parent,
                    ).first()
                    if child:
                        section_by_key[child_spec['key']] = child
            else:
                section = CountrySections.objects.filter(
                    title=spec['title'],
                    parent=None,
                ).first()
                if section:
                    section_by_key[spec['key']] = section

        self._country_section_cache = section_by_key
        return section_by_key

    def _seed_country_attachments(self):
        created = 0
        country_sections = self._country_sections_by_key()
        for iso, section_key, title, description in COUNTRY_ATTACHMENT_SPECS:
            country = self._find_country(iso)
            section = country_sections.get(section_key)
            if not country or not section:
                continue
            full_title = f'{DEMO_ATTACHMENT_PREFIX}{title}'
            attachment, was_created = CountryAttachment.objects.update_or_create(
                country=country,
                section=section,
                title=full_title,
                defaults={'description': description},
            )
            save_placeholder_image(
                attachment.image,
                f'demo_country_{attachment.pk or "new"}.png',
            )
            attachment.save(update_fields=['image'])
            if was_created:
                created += 1
        return created

    def _parse_date(self, value):
        if not value:
            return None
        return datetime.strptime(value, '%Y-%m-%d').date()

    def _parse_time(self, value):
        if not value:
            return None
        return datetime.strptime(value, '%H:%M:%S').time()

    def _seed_events(self):
        created = 0
        for spec in EVENT_SPECS:
            country = self._find_country(spec['country_iso'])
            event_type = EventType.objects.filter(title=spec['event_type']).first()
            marker = EventMarker.objects.filter(title=spec['marker_title']).first()
            _, was_created = Event.objects.update_or_create(
                title=spec['title'],
                defaults={
                    'object_name': spec['object_name'],
                    'description': spec['description'],
                    'event_type': event_type,
                    'country': country,
                    'marker': marker,
                    'color': spec['color'],
                    'date_start': self._parse_date(spec['date_start']),
                    'date_end': self._parse_date(spec.get('date_end')),
                    'time_start': self._parse_time(spec.get('time_start')),
                    'time_end': self._parse_time(spec.get('time_end')),
                    'shape': spec['shape'],
                },
            )
            if was_created:
                created += 1
        return created

    def _target_for_person_index(self, index):
        """Распределение лиц по ключевым объектам."""
        mapping = [
            ('Авиабаза Энгельс', 3),
            ('РЛС Астана', 2),
            ('Стратегическое командование (РК-0352)', 1),
        ]
        offset = 0
        for title_part, count in mapping:
            if index < offset + count:
                return self._find_target(title_part)
            offset += count
        return self._demo_targets()[0] if self._demo_targets() else None

    def _seed_persons(self):
        created = 0
        person_by_name = {}

        for index, profile in enumerate(PERSON_PROFILES):
            target = self._target_for_person_index(index)
            if not target:
                continue

            person, was_created = Person.objects.update_or_create(
                target=target,
                full_name=profile['full_name'],
                defaults={'position': profile['position']},
            )
            person_by_name[profile['full_name']] = person
            if was_created:
                created += 1

            for section_key, content in profile.get('info', {}).items():
                section = self._person_sections.get(section_key)
                if not section or not content:
                    continue
                PersonInfo.objects.update_or_create(
                    person=person,
                    section=section,
                    defaults={'content': content},
                )

            for photo_title, order in profile.get('photos', []):
                photo, _ = PersonPhoto.objects.update_or_create(
                    person=person,
                    order=order,
                    defaults={'title': photo_title},
                )
                save_placeholder_image(
                    photo.image,
                    f'demo_person_{person.pk}_{order}.png',
                )
                photo.save(update_fields=['image'])

            for att_title, att_desc in profile.get('attachments', []):
                section = self._person_sections.get('service') or next(
                    iter(self._person_sections.values()),
                    None,
                )
                if not section:
                    continue
                full_title = f'{DEMO_ATTACHMENT_PREFIX}{att_title}'
                attachment, _ = PersonAttachment.objects.update_or_create(
                    person=person,
                    section=section,
                    title=full_title,
                    defaults={'description': att_desc},
                )
                save_placeholder_image(
                    attachment.image,
                    f'demo_person_att_{attachment.pk or "new"}.png',
                )
                attachment.save(update_fields=['image'])

        self._person_by_name = person_by_name
        return created

    def _seed_person_relations(self):
        if not hasattr(self, '_person_by_name'):
            self._person_by_name = {
                p.full_name: p
                for p in Person.objects.filter(full_name__in=DEMO_PERSON_NAMES)
            }

        created = 0
        for from_name, to_name, rel_title, notes in PERSON_RELATIONS:
            person_from = self._person_by_name.get(from_name)
            person_to = self._person_by_name.get(to_name)
            relation_type = RelationType.objects.filter(title=rel_title).first()
            if not person_from or not person_to or not relation_type:
                continue
            _, was_created = PersonRelation.objects.update_or_create(
                person_from=person_from,
                person_to=person_to,
                relation_type=relation_type,
                defaults={'notes': notes},
            )
            if was_created:
                created += 1
        return created

    def _seed_target_equipment(self):
        created = 0
        for target_part, designation, quantity in TARGET_EQUIPMENT_SPECS:
            target = self._find_target(target_part)
            equipment = Equipment.objects.filter(designation=designation).first()
            if not target or not equipment:
                continue
            _, was_created = TargetEquipment.objects.update_or_create(
                target=target,
                equipment=equipment,
                defaults={'quantity': quantity},
            )
            if was_created:
                created += 1
        return created

    def _seed_equipment_images(self):
        created = 0
        for equipment in Equipment.objects.all():
            title = f'{DEMO_ATTACHMENT_PREFIX}{equipment.designation or equipment.title}'
            if EquipmentImage.objects.filter(equipment=equipment, title=title).exists():
                continue
            if equipment.images.exists():
                continue
            image = EquipmentImage.objects.create(
                equipment=equipment,
                title=title,
                order=0,
            )
            save_placeholder_image(
                image.image,
                f'demo_equipment_{equipment.pk}.png',
            )
            image.save(update_fields=['image'])
            created += 1
            if created >= 8:
                break
        return created
