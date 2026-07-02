"""Загрузка, экспорт, импорт и очистка каталога вооружения."""

from __future__ import annotations

import json
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.db import transaction

from equipment.models import (
    Equipment,
    EquipmentCategory,
    EquipmentImage,
    EquipmentParameterDefinition,
    EquipmentParameterValue,
    UnitOfMeasure,
)
from formular.models import ActionType, Country

from .data import (
    ACTION_TYPE_SPECS,
    CATALOG_VERSION,
    CATEGORY_TREE,
    COUNTRY_SPECS,
    EQUIPMENT_ITEMS,
    PARAMETER_SPECS,
)
from .data_images import EQUIPMENT_IMAGE_SOURCES

CATALOG_DIR = Path(__file__).resolve().parent
IMAGES_DIR = CATALOG_DIR / 'images'
FIXTURES_DIR = CATALOG_DIR / 'fixtures'
BUNDLE_MANIFEST = 'manifest.json'
BUNDLE_CATALOG = 'catalog.json'
BUNDLE_MEDIA_SUBDIR = Path('media') / 'equipment'

UNIT_SPECS = [('км', 'Километр'), ('км/ч', 'Километр в час')]


def copy_local_seed_images(stdout=None) -> int:
    """Копирует фото из папки «Изображения техники» в catalog/images/."""
    project_root = CATALOG_DIR.parent.parent.parent
    local_dir = project_root / 'Изображения техники'
    if not local_dir.is_dir():
        return 0
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    copies = [
        ('Су-34.jpg', 'su-34_1.jpg'),
        ('Су-34 (1).jpg', 'su-34_2.jpg'),
        ('MAKS2015part1-10_(cropped).jpg', 'su-35s_1.jpg'),
    ]
    copied = 0
    for src_name, dest_name in copies:
        src = local_dir / src_name
        dest = IMAGES_DIR / dest_name
        if src.is_file():
            shutil.copy2(src, dest)
            copied += 1
            if stdout:
                stdout.write(f'  ✓ локально: {dest_name}\n')
    return copied


def catalog_images_dir() -> Path:
    return IMAGES_DIR


def _commons_download_url(file_title: str, width: int = 1280) -> str | None:
    """URL уменьшенной копии файла Wikimedia Commons."""
    params = urllib.parse.urlencode({
        'action': 'query',
        'titles': f'File:{file_title}',
        'prop': 'imageinfo',
        'iiprop': 'url',
        'iiurlwidth': str(width),
        'format': 'json',
    })
    api_url = f'https://commons.wikimedia.org/w/api.php?{params}'
    req = urllib.request.Request(
        api_url,
        headers={'User-Agent': 'InfoLake/1.0 (equipment catalog; contact: local-admin)'},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode('utf-8'))
    pages = payload.get('query', {}).get('pages', {})
    for page in pages.values():
        if page.get('missing'):
            return None
        info = (page.get('imageinfo') or [{}])[0]
        return info.get('thumburl') or info.get('url')
    return None


def download_catalog_images(
    force: bool = False,
    stdout=None,
    delay_sec: float = 5.0,
    max_retries: int = 3,
) -> tuple[int, int]:
    """Скачивает изображения из data.py в catalog/images/."""
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    ok, failed = 0, 0
    for designation, images in EQUIPMENT_IMAGE_SOURCES.items():
        for img in images:
            dest = IMAGES_DIR / img['file']
            if dest.exists() and not force:
                ok += 1
                continue
            url = img.get('url')
            commons = img.get('commons')
            if commons and not url:
                for attempt in range(max_retries):
                    try:
                        url = _commons_download_url(commons)
                        time.sleep(delay_sec)
                        break
                    except urllib.error.HTTPError as exc:
                        if exc.code == 429 and attempt + 1 < max_retries:
                            wait = delay_sec * (attempt + 2)
                            if stdout:
                                stdout.write(f'  … пауза {wait:.0f}s (429) {img["file"]}\n')
                            time.sleep(wait)
                            continue
                        if stdout:
                            stdout.write(f'  ✗ API {img["file"]}: {exc}\n')
                        url = None
                        break
                    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
                        if stdout:
                            stdout.write(f'  ✗ API {img["file"]}: {exc}\n')
                        url = None
                        break
            if not url:
                failed += 1
                continue
            for attempt in range(max_retries):
                try:
                    req = urllib.request.Request(
                        url,
                        headers={'User-Agent': 'InfoLake/1.0 (equipment catalog; contact: local-admin)'},
                    )
                    with urllib.request.urlopen(req, timeout=90) as resp:
                        dest.write_bytes(resp.read())
                    ok += 1
                    if stdout:
                        stdout.write(f'  ✓ {img["file"]}\n')
                    time.sleep(delay_sec)
                    break
                except urllib.error.HTTPError as exc:
                    if exc.code == 429 and attempt + 1 < max_retries:
                        time.sleep(delay_sec * (attempt + 2))
                        continue
                    failed += 1
                    if stdout:
                        stdout.write(f'  ✗ {img["file"]}: {exc}\n')
                    break
                except (urllib.error.URLError, OSError) as exc:
                    failed += 1
                    if stdout:
                        stdout.write(f'  ✗ {img["file"]}: {exc}\n')
                    break
    return ok, failed


@transaction.atomic
def clear_equipment_catalog(*, delete_orphan_units: bool = True) -> dict:
    """
    Удаляет только данные каталога вооружения:
    образцы, изображения (БД + media/equipment/), значения ТТХ, параметры, категории.
    Не затрагивает ActionType, Country, Target, события, формуляры.
    Папка catalog/images/ на диске не удаляется.
    Связи TargetEquipment удаляются через CASCADE при удалении Equipment.
    """
    stats = {
        'images': 0,
        'parameter_values': 0,
        'equipment': 0,
        'parameters': 0,
        'categories': 0,
        'units': 0,
    }

    for img in EquipmentImage.objects.all():
        if img.image:
            img.image.delete(save=False)
        stats['images'] += 1
    EquipmentImage.objects.all().delete()

    stats['parameter_values'] = EquipmentParameterValue.objects.count()
    EquipmentParameterValue.objects.all().delete()

    stats['equipment'] = Equipment.objects.count()
    Equipment.objects.all().delete()

    stats['parameters'] = EquipmentParameterDefinition.objects.count()
    EquipmentParameterDefinition.objects.all().delete()

    stats['categories'] = EquipmentCategory.objects.count()
    EquipmentCategory.objects.all().delete()

    if delete_orphan_units:
        stats['units'] = UnitOfMeasure.objects.count()
        UnitOfMeasure.objects.all().delete()

    return stats


def _ensure_countries():
    result = {}
    for iso, title, short, color in COUNTRY_SPECS:
        country, _ = Country.objects.get_or_create(
            iso_code=iso,
            defaults={
                'title': title,
                'title_short': short,
                'color': color,
            },
        )
        updates = {}
        if country.title != title:
            updates['title'] = title
        if country.title_short != short:
            updates['title_short'] = short
        if updates:
            for k, v in updates.items():
                setattr(country, k, v)
            country.save(update_fields=list(updates.keys()))
        result[iso] = country
    return result


def build_catalog_fixture_from_data(*, include_images: bool = False) -> dict:
    """Собирает catalog.json из data.py без обращения к БД."""
    categories = [
        {'title': title, 'parent_title': parent, 'order': order}
        for title, parent, order in CATEGORY_TREE
    ]
    parameters = [
        {
            'code': p['code'],
            'title': p['title'],
            'unit_symbol': p.get('unit'),
            'action_type_title': p.get('zone'),
            'category_titles': p.get('categories') or [],
        }
        for p in PARAMETER_SPECS
    ]
    countries = [
        {
            'iso_code': iso,
            'title': title,
            'title_short': short,
            'color': color,
        }
        for iso, title, short, color in COUNTRY_SPECS
    ]
    units = [{'symbol': s, 'title': t} for s, t in UNIT_SPECS]
    equipment = []
    for spec in EQUIPMENT_ITEMS:
        images = []
        if include_images:
            for img in EQUIPMENT_IMAGE_SOURCES.get(spec['designation'], []):
                images.append({
                    'filename': img['file'],
                    'title': img.get('title') or '',
                    'order': img.get('order', 0),
                })
        equipment.append({
            'designation': spec['designation'],
            'title': spec['title'],
            'category': spec['category'],
            'origin_country_iso': spec['iso'],
            'description': spec.get('description') or '',
            'values': spec.get('values') or {},
            'images': images,
        })
    return {
        'version': CATALOG_VERSION,
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'units': units,
        'countries': countries,
        'categories': categories,
        'parameters': parameters,
        'equipment': equipment,
    }


def write_catalog_fixture(output_dir: Path, *, include_images: bool = False) -> Path:
    """Записывает catalog.json и manifest.json (без media/)."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    catalog = build_catalog_fixture_from_data(include_images=include_images)
    catalog_path = output_dir / BUNDLE_CATALOG
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    images_count = sum(len(eq.get('images') or []) for eq in catalog['equipment'])
    manifest = {
        'version': CATALOG_VERSION,
        'exported_at': catalog['exported_at'],
        'equipment_count': len(catalog['equipment']),
        'images_count': images_count,
        'catalog_file': BUNDLE_CATALOG,
        'media_dir': str(BUNDLE_MEDIA_SUBDIR).replace('\\', '/'),
        'source': 'data.py',
        'includes_media': include_images,
    }
    (output_dir / BUNDLE_MANIFEST).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    return output_dir


def _ensure_units():
    result = {}
    for symbol, title in UNIT_SPECS:
        unit, _ = UnitOfMeasure.objects.get_or_create(
            symbol=symbol,
            defaults={'title': title},
        )
        result[symbol] = unit
    return result


def _ensure_categories():
    by_title = {}
    for title, parent_title, order in CATEGORY_TREE:
        parent = by_title.get(parent_title) if parent_title else None
        category, _ = EquipmentCategory.objects.get_or_create(
            title=title,
            defaults={'parent': parent, 'order': order},
        )
        changed = []
        if category.parent_id != (parent.id if parent else None):
            category.parent = parent
            changed.append('parent')
        if category.order != order:
            category.order = order
            changed.append('order')
        if changed:
            category.save(update_fields=changed)
        by_title[title] = category
    return by_title


def _ensure_action_types():
    result = {}
    for title, color, line_type in ACTION_TYPE_SPECS:
        action_type, _ = ActionType.objects.get_or_create(
            title=title,
            defaults={'color': color, 'line_type': line_type},
        )
        result[title] = action_type
    return result


def _ensure_parameters(categories, units, action_types):
    result = {}
    for spec in PARAMETER_SPECS:
        zone_title = spec['zone']
        param, created = EquipmentParameterDefinition.objects.get_or_create(
            code=spec['code'],
            defaults={
                'title': spec['title'],
                'unit': units[spec['unit']],
                'action_type': action_types.get(zone_title) if zone_title else None,
            },
        )
        if not created:
            param.title = spec['title']
            param.unit = units[spec['unit']]
            param.action_type = action_types.get(zone_title) if zone_title else None
            param.save(update_fields=['title', 'unit', 'action_type'])

        param.categories.set([categories[c] for c in spec['categories']])
        result[spec['code']] = param
    return result


def _attach_images(equipment, image_specs, *, source_dir: Path, replace: bool = True):
    if replace:
        for old in equipment.images.all():
            if old.image:
                old.image.delete(save=False)
            old.delete()

    for order, img in enumerate(image_specs or []):
        filename = img.get('file') or img.get('filename')
        if not filename:
            continue
        src = source_dir / filename
        if not src.is_file():
            bundle_src = img.get('bundle_path')
            if bundle_src and Path(bundle_src).is_file():
                src = Path(bundle_src)
            else:
                continue
        with src.open('rb') as fh:
            EquipmentImage.objects.create(
                equipment=equipment,
                title=img.get('title') or '',
                order=order,
                image=File(fh, name=filename),
            )


@transaction.atomic
def load_equipment_catalog(
    *,
    clear_first: bool = False,
    attach_images: bool = False,
    images_dir: Path | None = None,
    replace_images: bool = True,
) -> dict:
    if clear_first:
        clear_equipment_catalog()

    countries = _ensure_countries()
    units = _ensure_units()
    categories = _ensure_categories()
    action_types = _ensure_action_types()
    parameters = _ensure_parameters(categories, units, action_types)

    img_dir = images_dir or IMAGES_DIR
    equipment_count = 0
    image_count = 0

    for spec in EQUIPMENT_ITEMS:
        equipment, _ = Equipment.objects.update_or_create(
            designation=spec['designation'],
            defaults={
                'title': spec['title'],
                'category': categories[spec['category']],
                'origin_country': countries[spec['iso']],
                'description': spec['description'],
            },
        )
        equipment_count += 1
        for code, value in spec.get('values', {}).items():
            EquipmentParameterValue.objects.update_or_create(
                equipment=equipment,
                parameter=parameters[code],
                defaults={'value': value},
            )
        if attach_images:
            image_specs = EQUIPMENT_IMAGE_SOURCES.get(spec['designation'], [])
            if image_specs:
                _attach_images(
                    equipment,
                    image_specs,
                    source_dir=img_dir,
                    replace=replace_images,
                )
                image_count += equipment.images.count()

    return {
        'equipment': equipment_count,
        'categories': len(categories),
        'parameters': len(parameters),
        'images': image_count,
    }


def _serialize_catalog() -> dict:
    categories = {
        c.title: c
        for c in EquipmentCategory.objects.select_related('parent').order_by('order', 'title')
    }
    cat_payload = []
    for title, cat in categories.items():
        cat_payload.append({
            'title': title,
            'parent_title': cat.parent.title if cat.parent_id else None,
            'order': cat.order,
        })

    param_payload = []
    for param in EquipmentParameterDefinition.objects.prefetch_related('categories').select_related(
        'unit', 'action_type',
    ):
        param_payload.append({
            'code': param.code,
            'title': param.title,
            'unit_symbol': param.unit.symbol if param.unit_id else None,
            'action_type_title': param.action_type.title if param.action_type_id else None,
            'category_titles': [c.title for c in param.categories.all()],
        })

    equipment_payload = []
    for eq in Equipment.objects.select_related('category', 'origin_country').prefetch_related(
        'parameter_values__parameter',
        'images',
    ).order_by('title'):
        values = {
            pv.parameter.code: pv.value
            for pv in eq.parameter_values.all()
        }
        images = []
        for img in eq.images.all():
            images.append({
                'filename': Path(img.image.name).name,
                'title': img.title,
                'order': img.order,
            })
        equipment_payload.append({
            'designation': eq.designation,
            'title': eq.title,
            'category': eq.category.title if eq.category_id else None,
            'origin_country_iso': eq.origin_country.iso_code if eq.origin_country_id else None,
            'description': eq.description,
            'values': values,
            'images': images,
        })

    units = [
        {'symbol': u.symbol, 'title': u.title}
        for u in UnitOfMeasure.objects.order_by('symbol')
    ]

    isos = {
        eq.origin_country.iso_code
        for eq in Equipment.objects.select_related('origin_country').exclude(origin_country__isnull=True)
    }
    countries = []
    for c in Country.objects.filter(iso_code__in=isos).order_by('title'):
        countries.append({
            'iso_code': c.iso_code,
            'title': c.title,
            'title_short': c.title_short,
            'color': c.color,
        })

    return {
        'version': CATALOG_VERSION,
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'units': units,
        'countries': countries,
        'categories': cat_payload,
        'parameters': param_payload,
        'equipment': equipment_payload,
    }


def export_equipment_catalog(output_dir: Path, *, include_images: bool = False) -> Path:
    """Экспорт каталога в bundle; media/equipment/ — только при include_images=True."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    catalog = _serialize_catalog()
    if not include_images:
        for eq in catalog['equipment']:
            eq['images'] = []

    catalog_path = output_dir / BUNDLE_CATALOG
    catalog_path.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )

    copied = 0
    if include_images:
        media_dest = output_dir / BUNDLE_MEDIA_SUBDIR
        media_dest.mkdir(parents=True, exist_ok=True)
        media_root = Path(settings.MEDIA_ROOT) / 'equipment'
        for eq in catalog['equipment']:
            for img in eq.get('images') or []:
                name = img['filename']
                src = media_root / name
                if src.is_file():
                    shutil.copy2(src, media_dest / name)
                    copied += 1

    manifest = {
        'version': CATALOG_VERSION,
        'exported_at': catalog['exported_at'],
        'equipment_count': len(catalog['equipment']),
        'images_count': copied,
        'catalog_file': BUNDLE_CATALOG,
        'media_dir': str(BUNDLE_MEDIA_SUBDIR).replace('\\', '/'),
        'includes_media': include_images,
    }
    (output_dir / BUNDLE_MANIFEST).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    return output_dir


@transaction.atomic
def import_equipment_catalog(
    input_dir: Path,
    *,
    clear_first: bool = True,
    attach_images: bool = False,
) -> dict:
    """Импорт bundle на машине без интернета."""
    input_dir = Path(input_dir)
    catalog_path = input_dir / BUNDLE_CATALOG
    if not catalog_path.is_file():
        raise FileNotFoundError(f'Не найден {catalog_path}')

    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    media_src = input_dir / BUNDLE_MEDIA_SUBDIR

    if clear_first:
        clear_equipment_catalog()

    countries = {}
    for c in catalog.get('countries') or []:
        country, _ = Country.objects.get_or_create(
            iso_code=c['iso_code'],
            defaults={
                'title': c['title'],
                'title_short': c['title_short'],
                'color': c['color'],
            },
        )
        countries[c['iso_code']] = country

    units = {}
    for u in catalog.get('units') or []:
        unit, _ = UnitOfMeasure.objects.get_or_create(
            symbol=u['symbol'],
            defaults={'title': u['title']},
        )
        units[u['symbol']] = unit

    action_types = _ensure_action_types()

    categories = {}
    for cat in catalog.get('categories') or []:
        parent = categories.get(cat['parent_title']) if cat.get('parent_title') else None
        category, _ = EquipmentCategory.objects.get_or_create(
            title=cat['title'],
            defaults={'parent': parent, 'order': cat.get('order', 0)},
        )
        category.parent = parent
        category.order = cat.get('order', 0)
        category.save(update_fields=['parent', 'order'])
        categories[cat['title']] = category

    parameters = {}
    for p in catalog.get('parameters') or []:
        param, _ = EquipmentParameterDefinition.objects.get_or_create(
            code=p['code'],
            defaults={
                'title': p['title'],
                'unit': units.get(p['unit_symbol']) if p.get('unit_symbol') else None,
                'action_type': (
                    ActionType.objects.filter(title=p['action_type_title']).first()
                    if p.get('action_type_title') else None
                ),
            },
        )
        param.title = p['title']
        if p.get('unit_symbol'):
            param.unit = units[p['unit_symbol']]
        param.action_type = (
            ActionType.objects.filter(title=p['action_type_title']).first()
            if p.get('action_type_title') else None
        )
        param.save()
        param.categories.set([categories[t] for t in p.get('category_titles') or [] if t in categories])
        parameters[p['code']] = param

    equipment_count = 0
    image_count = 0
    for spec in catalog.get('equipment') or []:
        iso = spec.get('origin_country_iso')
        equipment, _ = Equipment.objects.update_or_create(
            designation=spec['designation'],
            defaults={
                'title': spec['title'],
                'category': categories.get(spec['category']),
                'origin_country': countries.get(iso) if iso else None,
                'description': spec.get('description') or '',
            },
        )
        equipment_count += 1
        for code, value in (spec.get('values') or {}).items():
            if code in parameters:
                EquipmentParameterValue.objects.update_or_create(
                    equipment=equipment,
                    parameter=parameters[code],
                    defaults={'value': value},
                )
        if attach_images:
            image_specs = []
            for img in spec.get('images') or []:
                fname = img['filename']
                bundle_file = media_src / fname
                image_specs.append({
                    'file': fname,
                    'title': img.get('title') or '',
                    'bundle_path': str(bundle_file) if bundle_file.is_file() else None,
                })
            if image_specs:
                _attach_images(equipment, image_specs, source_dir=media_src, replace=True)
                image_count += equipment.images.count()

    return {
        'equipment': equipment_count,
        'images': image_count,
    }
