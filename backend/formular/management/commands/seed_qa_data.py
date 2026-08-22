"""
Тестовые данные для проверки функциональности (страны СНГ).

Использование:
  python manage.py seed_qa_data
  python manage.py seed_qa_data --clear
"""

from __future__ import annotations

import random
import re
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.enums import ModuleLevel, UserStatus
from accounts.models import SecurityGroup, UserProfile
from equipment.models import (
    Equipment,
    EquipmentCategory,
    EquipmentImage,
    EquipmentParameterDefinition,
    EquipmentParameterValue,
    UnitOfMeasure,
)
from formular.demo_seed_data import (
    DEFAULT_FORMULAR_CONTENT,
    FORMULAR_CONTENT_BY_MARKER,
    FORMULAR_SECTION_SPECS,
    PERSON_SECTION_SPECS,
    RELATION_TYPE_SPECS,
)
from formular.enums import ZoneGeometryModes
from formular.models import (
    ActionType,
    Country,
    CountryAttachment,
    CountrySections,
    Event,
    EventMarker,
    EventType,
    Formular,
    FormularAttachment,
    FormularSections,
    MapDisplaySettings,
    Marker,
    MarkerColorPalette,
    OperationalSituation,
    OperationalSituationRevision,
    OperationalSituationRevisionChangeKind,
    Person,
    PersonAttachment,
    PersonInfo,
    PersonPhoto,
    PersonRelation,
    PersonSections,
    RelationType,
    Target,
    TargetAction,
    TargetEquipment,
    TargetType,
    TargetVulnerability,
)
from formular.qa_seed_data import (
    ACTION_TYPE_SPECS,
    CIS_COUNTRIES,
    COUNTRY_BOUNDS,
    EQUIPMENT_CATEGORY_TREE,
    EQUIPMENT_SPECS,
    EVENT_MARKER_FILES,
    EVENT_SPECS,
    EVENT_TYPE_TITLES,
    HYDRO_SITES,
    PERSON_PROFILES,
    PERSON_RELATIONS,
    QA_ATTACHMENT_PREFIX,
    QA_PASSWORD,
    QA_USERS,
    SEED_LABEL_PREFIX,
    SEED_TAG,
    SITUATION_SPECS,
    VULNERABILITY_SPECS,
    is_flag_title,
    is_hq_title,
    marker_title_from_filename,
)
from formular.seed_placeholders import save_placeholder_image

User = get_user_model()

HASHED_SVG_RE = re.compile(r'_[A-Za-z0-9]{7}\.svg$', re.IGNORECASE)
QA_PERSON_NAMES = {profile['full_name'] for profile in PERSON_PROFILES}


def _icons_dir():
    bundled = Path(__file__).resolve().parents[2] / 'seed_assets' / 'svg_markers'
    if bundled.exists():
        return bundled
    fallback = Path(__file__).resolve().parents[4] / 'svg_markers'
    return fallback


def _random_coord(bounds, rng):
    lat_min, lat_max, lng_min, lng_max = bounds
    return (
        round(rng.uniform(lat_min, lat_max), 6),
        round(rng.uniform(lng_min, lng_max), 6),
    )


def _parse_date(value):
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


def _parse_time(value):
    if not value:
        return None
    return datetime.strptime(value, '%H:%M:%S').time()


class Command(BaseCommand):
    help = (
        'Заполняет БД тестовыми данными: маркеры из SVG, 1000 объектов СНГ '
        'и по 5–10 записей в остальных моделях'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=1000,
            help='Количество Target (по умолчанию 1000)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help=f'Удалить ранее созданные данные с меткой {SEED_LABEL_PREFIX} и засеять заново',
        )
        parser.add_argument(
            '--seed',
            type=int,
            default=42,
            help='Seed генератора случайных координат',
        )

    def handle(self, *args, **options):
        count = options['count']
        if count <= 0:
            raise CommandError('--count должен быть больше 0')

        icons_dir = _icons_dir()
        if not icons_dir.exists():
            raise CommandError(f'Не найдена папка SVG-маркеров: {icons_dir}')

        rng = random.Random(options['seed'])
        stats = {}

        if options['clear']:
            self._clear_qa_data()

        with transaction.atomic():
            countries = self._ensure_countries()
            stats['countries'] = len(countries)
            marker_records = self._ensure_markers(icons_dir)
            stats['markers'] = len(marker_records)
            stats['event_markers'] = self._ensure_event_markers(icons_dir)
            action_types = self._ensure_action_types()
            stats['action_types'] = len(action_types)
            stats['targets'] = self._ensure_targets(
                count, countries, marker_records, action_types, rng,
            )
            stats['hydro'] = self._seed_hydro_targets(countries, marker_records)
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
            stats['equipment'] = self._seed_equipment(countries)
            stats['target_equipment'] = self._seed_target_equipment()
            stats['vulnerabilities'] = self._seed_vulnerabilities()
            stats['situations'] = self._seed_situations()
            stats['security_groups'] = self._seed_security_groups(countries)
            call_command('seed_security_groups')
            stats['users'] = self._seed_users()
            MapDisplaySettings.load()

        call_command('seed_country_info')
        call_command('seed_report_templates')
        call_command('seed_rls_demo')
        call_command('seed_hydro_inundation_demo')

        summary = ', '.join(f'{key}={value}' for key, value in stats.items())
        self.stdout.write(self.style.SUCCESS(f'Готово: {summary}'))
        self.stdout.write(
            f'Пользователи QA: qa_operator / qa_analyst, пароль: {QA_PASSWORD}'
        )

    def _clear_qa_data(self):
        deleted_targets, _ = Target.objects.filter(
            label__startswith=SEED_LABEL_PREFIX,
        ).delete()
        deleted_events, _ = Event.objects.filter(
            description__contains=f'[{SEED_TAG}]',
        ).delete()
        deleted_persons, _ = Person.objects.filter(
            full_name__in=QA_PERSON_NAMES,
        ).delete()
        deleted_fa, _ = FormularAttachment.objects.filter(
            title__startswith=QA_ATTACHMENT_PREFIX,
        ).delete()
        deleted_ca, _ = CountryAttachment.objects.filter(
            title__startswith=QA_ATTACHMENT_PREFIX,
        ).delete()
        deleted_ei, _ = EquipmentImage.objects.filter(
            title__startswith=QA_ATTACHMENT_PREFIX,
        ).delete()
        deleted_vuln, _ = TargetVulnerability.objects.filter(
            title__startswith=QA_ATTACHMENT_PREFIX,
        ).delete()

        qa_revisions = OperationalSituationRevision.objects.filter(
            title__contains=f'[{SEED_TAG}]',
        )
        situation_ids = list(qa_revisions.values_list('situation_id', flat=True))
        deleted_sit, _ = OperationalSituation.objects.filter(
            id__in=situation_ids,
        ).delete()

        User.objects.filter(username__in=[item['username'] for item in QA_USERS]).delete()
        SecurityGroup.objects.filter(name='СНГ').delete()

        self.stdout.write(self.style.WARNING(
            f'Очищено: targets={deleted_targets}, events={deleted_events}, '
            f'persons={deleted_persons}, formular_att={deleted_fa}, '
            f'country_att={deleted_ca}, equipment_img={deleted_ei}, '
            f'vulnerabilities={deleted_vuln}, situations={deleted_sit}'
        ))

    def _ensure_countries(self):
        result = []
        for spec in CIS_COUNTRIES:
            palette = MarkerColorPalette.objects.filter(title=spec['palette']).first()
            if palette is None:
                palette = MarkerColorPalette.objects.order_by('id').first()
            if palette is None:
                raise CommandError(
                    'Нет палитр MarkerColorPalette — примените миграции (0052)'
                )

            country = Country.objects.filter(iso_code__iexact=spec['iso_code']).first()
            if country is None:
                country = Country.objects.filter(title=spec['title']).first()
            if country is None:
                country = Country.objects.create(
                    title=spec['title'],
                    title_short=spec['title_short'],
                    iso_code=spec['iso_code'],
                    marker_palette=palette,
                )
            else:
                updated = False
                if country.title_short != spec['title_short']:
                    country.title_short = spec['title_short']
                    updated = True
                if country.iso_code != spec['iso_code']:
                    country.iso_code = spec['iso_code']
                    updated = True
                if country.marker_palette_id != palette.id:
                    country.marker_palette = palette
                    updated = True
                if updated:
                    country.save()
            result.append(country)
        return result

    def _iter_unique_svg_files(self, icons_dir: Path):
        files = sorted(icons_dir.glob('*.svg'), key=lambda path: path.name.lower())
        for path in files:
            if HASHED_SVG_RE.search(path.name):
                continue
            yield path

    def _ensure_markers(self, icons_dir: Path):
        result = []
        for order, path in enumerate(self._iter_unique_svg_files(icons_dir), start=1):
            title = marker_title_from_filename(path.name)
            target_type, _ = TargetType.objects.get_or_create(
                title=title,
                defaults={'order': order},
            )
            defaults = {
                'top': 0,
                'width': 100,
                'height': 50,
                'order': order,
                'scale': Decimal('1.0'),
                'is_flag': is_flag_title(title),
            }
            marker, created = Marker.objects.get_or_create(
                title=title,
                defaults=defaults,
            )
            if not created:
                Marker.objects.filter(pk=marker.pk).update(**defaults)
                marker.refresh_from_db()
            if not marker.path:
                with path.open('rb') as svg_file:
                    marker.path.save(path.name, File(svg_file), save=True)
            result.append({
                'marker': marker,
                'target_type': target_type,
                'title': title,
                'is_flag': marker.is_flag,
            })
        if not result:
            raise CommandError(f'В {icons_dir} нет уникальных SVG')
        return result

    def _ensure_event_markers(self, icons_dir: Path):
        created = 0
        for filename in EVENT_MARKER_FILES:
            path = icons_dir / filename
            if not path.exists():
                self.stdout.write(self.style.WARNING(f'Нет SVG события: {path}'))
                continue
            title = marker_title_from_filename(filename)
            marker, was_created = EventMarker.objects.get_or_create(title=title)
            if not marker.path:
                with path.open('rb') as svg_file:
                    marker.path.save(filename, File(svg_file), save=True)
            if was_created:
                created += 1
        return EventMarker.objects.count() if created else EventMarker.objects.filter(
            title__in=[marker_title_from_filename(name) for name in EVENT_MARKER_FILES],
        ).count()

    def _ensure_action_types(self):
        result = []
        for spec in ACTION_TYPE_SPECS:
            defaults = {
                'color': spec['color'],
                'line_type': spec['line_type'],
                'zone_mode': spec['zone_mode'],
                'is_inundation_zone': spec.get('is_inundation_zone', False),
                'min_elevation_deg': spec.get('min_elevation_deg'),
            }
            if spec['zone_mode'] != ZoneGeometryModes.LOS_RADAR:
                defaults['min_elevation_deg'] = None
            action_type, created = ActionType.objects.get_or_create(
                title=spec['title'],
                defaults=defaults,
            )
            if not created:
                for field, value in defaults.items():
                    setattr(action_type, field, value)
                action_type.save()
            result.append(action_type)
        return result

    def _ensure_targets(self, count, countries, marker_records, action_types, rng):
        existing = Target.objects.filter(label__startswith=SEED_LABEL_PREFIX).count()
        if existing >= count:
            self.stdout.write(
                f'Target с меткой {SEED_LABEL_PREFIX} уже {existing}, пропуск создания'
            )
            return existing

        hq_records = [item for item in marker_records if is_hq_title(item['title'])]
        if not hq_records:
            hq_records = marker_records[:1]

        flat_actions = [
            item for item in action_types
            if item.zone_mode == ZoneGeometryModes.FLAT and not item.is_inundation_zone
        ]
        hydro_record = next(
            (item for item in marker_records if 'Гидротех' in item['title']),
            marker_records[0],
        )

        parents_to_create = []
        children_to_create = []
        counter = 1
        per_country = count // len(countries)
        remainder = count % len(countries)

        for country_index, country in enumerate(countries):
            bounds = COUNTRY_BOUNDS[country.iso_code]
            country_count = per_country + (1 if country_index < remainder else 0)
            hq_info = hq_records[country_index % len(hq_records)]
            lat, lng = _random_coord(bounds, rng)
            parent = Target(
                country=country,
                title=f"{hq_info['title']} ({country.title_short}-{counter:04d})",
                label=f'{SEED_LABEL_PREFIX}:{counter:05d}',
                marker=hq_info['marker'],
                type=hq_info['target_type'],
                lat=lat,
                lng=lng,
            )
            parents_to_create.append(parent)
            counter += 1
            remaining = country_count - 1
            for child_index in range(max(0, remaining)):
                marker_info = marker_records[(counter - 1) % len(marker_records)]
                lat, lng = _random_coord(bounds, rng)
                hydro_fields = {}
                if 'Гидротех' in marker_info['title']:
                    hydro_fields = {
                        'crest_elevation_m': round(rng.uniform(80.0, 1100.0), 1),
                        'normal_pool_level_m': round(rng.uniform(70.0, 1070.0), 1),
                        'max_pool_level_m': round(rng.uniform(75.0, 1090.0), 1),
                    }
                action_radius = (
                    round(rng.uniform(15.0, 180.0), 1)
                    if marker_info['is_flag'] and rng.random() < 0.35
                    else None
                )
                parent_obj = parent if child_index < max(8, remaining // 4) else None
                children_to_create.append((
                    Target(
                        country=country,
                        title=(
                            f"{marker_info['title']} "
                            f"({country.title_short}-{counter:04d})"
                        ),
                        label=f'{SEED_LABEL_PREFIX}:{counter:05d}',
                        marker=marker_info['marker'],
                        type=marker_info['target_type'],
                        parent=parent_obj,
                        action_radius=action_radius,
                        lat=lat,
                        lng=lng,
                        **hydro_fields,
                    ),
                    marker_info,
                ))
                counter += 1

        created_parents = Target.objects.bulk_create(parents_to_create, batch_size=500)
        created_children = Target.objects.bulk_create(
            [item[0] for item in children_to_create],
            batch_size=500,
        )

        actions_to_create = []
        for target in list(created_parents) + list(created_children):
            if not target.action_radius:
                continue
            if not flat_actions:
                break
            chosen = rng.sample(flat_actions, k=min(2, len(flat_actions)))
            for action_type in chosen:
                actions_to_create.append(TargetAction(
                    target=target,
                    action_type=action_type,
                    radius=round(float(target.action_radius) * rng.uniform(0.6, 1.2), 1),
                ))
        if actions_to_create:
            TargetAction.objects.bulk_create(actions_to_create, batch_size=500)

        self._hydro_record = hydro_record
        return len(created_parents) + len(created_children)

    def _seed_hydro_targets(self, countries, marker_records):
        country_by_iso = {item.iso_code: item for item in countries}
        hydro_info = next(
            (item for item in marker_records if 'Гидротех' in item['title']),
            marker_records[0],
        )
        inundation = ActionType.objects.filter(is_inundation_zone=True).first()
        created = 0
        for index, spec in enumerate(HYDRO_SITES, start=1):
            country = country_by_iso.get(spec['iso_code'])
            if country is None:
                continue
            label = f'{SEED_LABEL_PREFIX}:hydro:{index:02d}'
            target, was_created = Target.objects.update_or_create(
                label=label,
                defaults={
                    'country': country,
                    'title': spec['title'],
                    'marker': hydro_info['marker'],
                    'type': hydro_info['target_type'],
                    'lat': spec['lat'],
                    'lng': spec['lng'],
                    'crest_elevation_m': spec['crest_elevation_m'],
                    'normal_pool_level_m': spec['normal_pool_level_m'],
                    'max_pool_level_m': spec['max_pool_level_m'],
                },
            )
            if was_created:
                created += 1
            if inundation and not target.actions.filter(action_type=inundation).exists():
                ring = [
                    [spec['lng'] - 0.04, spec['lat'] - 0.03],
                    [spec['lng'] + 0.05, spec['lat'] - 0.03],
                    [spec['lng'] + 0.05, spec['lat'] + 0.03],
                    [spec['lng'] - 0.04, spec['lat'] + 0.03],
                    [spec['lng'] - 0.04, spec['lat'] - 0.03],
                ]
                TargetAction.objects.create(
                    target=target,
                    action_type=inundation,
                    radius=None,
                    zone_geometry={'type': 'Polygon', 'coordinates': [ring]},
                    zone_metadata={
                        'water_level_m': spec['normal_pool_level_m'],
                        'scenario_label': 'НПУ',
                    },
                )
        return created

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
                        defaults={'order': child_spec['order'], 'is_hidden': False},
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
        self._formular_sections = self._ensure_section_tree(
            FORMULAR_SECTION_SPECS, FormularSections,
        )
        return len(self._formular_sections)

    def _ensure_person_sections(self):
        self._person_sections = self._ensure_section_tree(
            PERSON_SECTION_SPECS, PersonSections,
        )
        return len(self._person_sections)

    def _ensure_relation_types(self):
        for title, reverse_title in RELATION_TYPE_SPECS:
            RelationType.objects.update_or_create(
                title=title,
                defaults={'reverse_title': reverse_title},
            )
        return RelationType.objects.count()

    def _ensure_event_types(self):
        for title in EVENT_TYPE_TITLES:
            EventType.objects.get_or_create(title=title)
        return EventType.objects.count()

    def _qa_targets(self, limit=10):
        return list(
            Target.objects.filter(label__startswith=SEED_LABEL_PREFIX)
            .select_related('marker', 'type', 'country')
            .order_by('label')[:limit]
        )

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
        for target in self._qa_targets(8):
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
        section = self._formular_sections.get('location') or next(
            iter(self._formular_sections.values()), None,
        )
        if section is None:
            return 0
        for index, target in enumerate(self._qa_targets(6), start=1):
            title = f'{QA_ATTACHMENT_PREFIX}Схема объекта {index}'
            attachment, was_created = FormularAttachment.objects.update_or_create(
                target=target,
                section=section,
                title=title,
                defaults={'description': 'Тестовая схема расположения.'},
            )
            save_placeholder_image(attachment.image, f'qa_formular_{index}.png')
            attachment.save(update_fields=['image'])
            if was_created:
                created += 1
        return created

    def _seed_country_attachments(self):
        section = CountrySections.objects.filter(parent__isnull=False).order_by('id').first()
        if section is None:
            section = CountrySections.objects.order_by('id').first()
        if section is None:
            section, _ = CountrySections.objects.get_or_create(
                title='Общие сведения',
                parent=None,
                defaults={'order': 1},
            )
        created = 0
        for index, spec in enumerate(CIS_COUNTRIES[:5], start=1):
            country = Country.objects.filter(iso_code=spec['iso_code']).first()
            if country is None:
                continue
            title = f'{QA_ATTACHMENT_PREFIX}Карта {spec["title_short"]}'
            attachment, was_created = CountryAttachment.objects.update_or_create(
                country=country,
                section=section,
                title=title,
                defaults={'description': f'Тестовое вложение по стране {spec["title"]}.'},
            )
            save_placeholder_image(attachment.image, f'qa_country_{index}.png')
            attachment.save(update_fields=['image'])
            if was_created:
                created += 1
        return created

    def _seed_events(self):
        created = 0
        for spec in EVENT_SPECS:
            country = Country.objects.filter(iso_code=spec['country_iso']).first()
            event_type = EventType.objects.filter(title=spec['event_type']).first()
            marker_title = marker_title_from_filename(spec['marker_file'])
            marker = EventMarker.objects.filter(title=marker_title).first()
            _, was_created = Event.objects.update_or_create(
                title=spec['title'],
                defaults={
                    'object_name': spec['object_name'],
                    'description': spec['description'],
                    'event_type': event_type,
                    'country': country,
                    'marker': marker,
                    'color': spec['color'],
                    'date_start': _parse_date(spec['date_start']),
                    'date_end': _parse_date(spec.get('date_end')),
                    'time_start': _parse_time(spec.get('time_start')),
                    'time_end': _parse_time(spec.get('time_end')),
                    'shape': spec['shape'],
                },
            )
            if was_created:
                created += 1
        return created

    def _seed_persons(self):
        targets = self._qa_targets(8)
        if not targets:
            return 0
        created = 0
        person_by_name = {}
        for index, profile in enumerate(PERSON_PROFILES):
            target = targets[index % len(targets)]
            person, was_created = Person.objects.update_or_create(
                target=target,
                full_name=profile['full_name'],
                defaults={'position': profile['position'], 'order': index},
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
            photo, _ = PersonPhoto.objects.update_or_create(
                person=person,
                order=1,
                defaults={'title': 'Служебное фото'},
            )
            save_placeholder_image(photo.image, f'qa_person_{index}.png')
            photo.save(update_fields=['image'])
            section = self._person_sections.get('service') or next(
                iter(self._person_sections.values()), None,
            )
            if section:
                attachment, _ = PersonAttachment.objects.update_or_create(
                    person=person,
                    section=section,
                    title=f'{QA_ATTACHMENT_PREFIX}Досье {index + 1}',
                    defaults={'description': 'Тестовое вложение личного дела.'},
                )
                save_placeholder_image(
                    attachment.image, f'qa_person_att_{index}.png',
                )
                attachment.save(update_fields=['image'])
        self._person_by_name = person_by_name
        return created

    def _seed_person_relations(self):
        if not hasattr(self, '_person_by_name'):
            self._person_by_name = {
                person.full_name: person
                for person in Person.objects.filter(full_name__in=QA_PERSON_NAMES)
            }
        created = 0
        for from_name, to_name, rel_title in PERSON_RELATIONS:
            person_from = self._person_by_name.get(from_name)
            person_to = self._person_by_name.get(to_name)
            relation_type = RelationType.objects.filter(title=rel_title).first()
            if not person_from or not person_to or not relation_type:
                continue
            _, was_created = PersonRelation.objects.update_or_create(
                person_from=person_from,
                person_to=person_to,
                relation_type=relation_type,
                defaults={'notes': 'Тестовая связь'},
            )
            if was_created:
                created += 1
        return created

    def _seed_equipment(self, countries):
        country_by_iso = {item.iso_code: item for item in countries}
        unit, _ = UnitOfMeasure.objects.get_or_create(
            symbol='км',
            defaults={'title': 'Километр'},
        )
        UnitOfMeasure.objects.get_or_create(
            symbol='км/ч',
            defaults={'title': 'Километр в час'},
        )
        by_title = {}
        for title, parent_title, order in EQUIPMENT_CATEGORY_TREE:
            parent = by_title.get(parent_title) if parent_title else None
            category, _ = EquipmentCategory.objects.get_or_create(
                title=title,
                defaults={'parent': parent, 'order': order},
            )
            by_title[title] = category

        combat_radius = ActionType.objects.filter(title='Боевой радиус').first()
        param, _ = EquipmentParameterDefinition.objects.get_or_create(
            code='qa_combat_radius',
            defaults={
                'title': 'Боевой радиус (qa)',
                'unit': unit,
                'action_type': combat_radius,
            },
        )

        created = 0
        for spec in EQUIPMENT_SPECS:
            equipment, was_created = Equipment.objects.update_or_create(
                designation=spec['designation'],
                defaults={
                    'title': spec['title'],
                    'category': by_title.get(spec['category']),
                    'origin_country': country_by_iso.get(spec['iso']),
                    'description': spec['description'],
                },
            )
            EquipmentParameterValue.objects.update_or_create(
                equipment=equipment,
                parameter=param,
                defaults={'value': 150.0},
            )
            title = f'{QA_ATTACHMENT_PREFIX}{equipment.designation}'
            if not EquipmentImage.objects.filter(equipment=equipment, title=title).exists():
                image = EquipmentImage.objects.create(
                    equipment=equipment,
                    title=title,
                    order=0,
                )
                save_placeholder_image(image.image, f'qa_eq_{equipment.pk}.png')
                image.save(update_fields=['image'])
            if was_created:
                created += 1
        return created

    def _seed_target_equipment(self):
        equipment_list = list(Equipment.objects.filter(
            designation__in=[item['designation'] for item in EQUIPMENT_SPECS],
        )[:8])
        if not equipment_list:
            equipment_list = list(Equipment.objects.all()[:8])
        created = 0
        for index, target in enumerate(self._qa_targets(6)):
            equipment = equipment_list[index % len(equipment_list)]
            _, was_created = TargetEquipment.objects.update_or_create(
                target=target,
                equipment=equipment,
                defaults={'quantity': 2 + index},
            )
            if was_created:
                created += 1
        return created

    def _seed_vulnerabilities(self):
        created = 0
        targets = self._qa_targets(3)
        if not targets:
            return 0
        for index, (title, description) in enumerate(VULNERABILITY_SPECS):
            target = targets[index % len(targets)]
            full_title = f'{QA_ATTACHMENT_PREFIX}{title}'
            vuln, was_created = TargetVulnerability.objects.update_or_create(
                target=target,
                title=full_title,
                defaults={
                    'description': description,
                    'lat': target.lat + (index * 0.001),
                    'lng': target.lng + (index * 0.001),
                    'order': index,
                },
            )
            save_placeholder_image(vuln.image, f'qa_vuln_{index}.png')
            vuln.save(update_fields=['image'])
            if was_created:
                created += 1
        return created

    def _seed_situations(self):
        author = User.objects.filter(is_superuser=True).first()
        created = 0
        for spec in SITUATION_SPECS:
            revision = OperationalSituationRevision.objects.filter(
                title=spec['title'],
            ).select_related('situation').first()
            if revision:
                situation = revision.situation
            else:
                situation = OperationalSituation.objects.create(created_by=author)
                revision = OperationalSituationRevision.objects.create(
                    situation=situation,
                    version=1,
                    title=spec['title'],
                    description=spec['description'],
                    situation_date=timezone.now().date(),
                    color=spec['color'],
                    geometry=spec['geometry'],
                    change_kind=OperationalSituationRevisionChangeKind.INITIAL,
                    created_by=author,
                )
                situation.current_revision = revision
                situation.save(update_fields=['current_revision'])
                created += 1

            countries = Country.objects.filter(iso_code__in=spec['iso_codes'])
            revision.countries.set(countries)

            if spec.get('second_revision'):
                second_title = f"{spec['title']} v2"
                if not OperationalSituationRevision.objects.filter(title=second_title).exists():
                    second = OperationalSituationRevision.objects.create(
                        situation=situation,
                        version=2,
                        title=second_title,
                        description=spec['description'] + ' Уточнение.',
                        situation_date=timezone.now().date(),
                        color=spec['color'],
                        geometry=spec['geometry'],
                        change_kind=OperationalSituationRevisionChangeKind.NEW_STATE,
                        parent_revision=revision,
                        change_note='Тестовая вторая ревизия',
                        created_by=author,
                    )
                    second.countries.set(countries)
                    situation.current_revision = second
                    situation.save(update_fields=['current_revision'])
        return created

    def _seed_security_groups(self, countries):
        group, created = SecurityGroup.objects.get_or_create(
            name='СНГ',
            defaults={
                'description': 'Доступ к данным стран СНГ для тестирования',
                'targets': ModuleLevel.WRITE,
                'events': ModuleLevel.WRITE,
                'operational_situations': ModuleLevel.WRITE,
                'formular': ModuleLevel.WRITE,
                'country_dossier': ModuleLevel.READ,
                'persons': ModuleLevel.READ,
                'equipment': ModuleLevel.READ,
                'reports': ModuleLevel.WRITE,
                'data_exchange': ModuleLevel.READ,
            },
        )
        group.countries.set(countries)
        return 1 if created else 0

    def _seed_users(self):
        created = 0
        for spec in QA_USERS:
            user, was_created = User.objects.get_or_create(
                username=spec['username'],
                defaults={
                    'is_staff': spec['is_staff'],
                    'is_active': True,
                    'first_name': spec['full_name'].split()[0],
                    'last_name': spec['full_name'].split()[-1],
                },
            )
            if was_created:
                user.set_password(QA_PASSWORD)
                user.save()
                created += 1
            else:
                user.set_password(QA_PASSWORD)
                user.is_active = True
                user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.status = UserStatus.ACTIVE
            profile.must_change_password = True
            profile.full_name = spec['full_name']
            profile.approved_at = timezone.now()
            profile.save()
            group = SecurityGroup.objects.filter(name=spec['group']).first()
            if group:
                profile.security_groups.add(group)
        return created
