# Каталог вооружения — оффлайн-перенос (данные и ТТХ)

Справочник техники (категории, параметры ТТХ, образцы) переносится **без изображений**.  
Файлы в `catalog/images/` и `bundle/media/` не удаляются при очистке каталога — остаются на диске.

## Что затрагивается

| Операция | Модели / данные |
|----------|-----------------|
| Загрузка / экспорт / импорт / очистка | `EquipmentCategory`, `EquipmentParameterDefinition`, `UnitOfMeasure`, `Equipment`, `EquipmentParameterValue`, `EquipmentImage` |
| При загрузке и импорте (get_or_create) | `Country` — только недостающие страны по ISO |
| При загрузке (get_or_create) | `ActionType` — только если параметру нужен тип зоны |

## Что НЕ затрагивается

| Раздел | Модели |
|--------|--------|
| Объекты карты | `Target`, маркеры, геометрия |
| События и формуляры | события, формуляры, связанные записи |
| Справочники | `Country` (существующие не удаляются), `ActionType` |
| Файлы на диске | `equipment/catalog/images/` — локальные JPG не трогаются |

При очистке каталога связи **`TargetEquipment`** на объектах удаляются автоматически (CASCADE).  
Сами объекты (`Target`) остаются.

---

## 1. Загрузка в БД (основной путь)

```bash
docker compose exec backend python manage.py migrate

# 49 образца: СНГ, NATO, EU, США — категории, ТТХ, без фото
docker compose exec backend python manage.py load_equipment_catalog --clear-first
```

Флаги `load_equipment_catalog`:

| Флаг | Назначение |
|------|------------|
| `--clear-first` | Очистить каталог вооружения перед загрузкой |
| `--with-images` | Прикрепить фото из `catalog/images/`, если файлы уже есть |
| `--download-images` | Скачать фото из Wikimedia и загрузить с `--with-images` |

Изображения опциональны. Уже скачанные файлы в `catalog/images/` сохраняются; для привязки к образцам:  
`load_equipment_catalog --clear-first --with-images`.

---

## 2. Фикстура в репозитории (без БД)

В каталоге `equipment/catalog/fixtures/` лежат `catalog.json` и `manifest.json`, собранные из `data.py`.

Пересобрать после правок в `data.py`:

```bash
docker compose exec backend python manage.py build_equipment_catalog_fixture
```

Импорт фикстуры на любой машине (в т.ч. без интернета):

```bash
docker compose exec backend python manage.py migrate

docker compose exec backend python manage.py import_equipment_catalog \
  --input equipment/catalog/fixtures
```

По умолчанию перед импортом выполняется очистка каталога. Чтобы добавить к существующим: `--no-clear`.

---

## 3. Экспорт из БД (если данные правили в UI)

```bash
# Только данные и ТТХ (без media/)
docker compose exec backend python manage.py export_equipment_catalog \
  --output equipment/catalog/bundle

# С изображениями из media/equipment/
docker compose exec backend python manage.py export_equipment_catalog \
  --output equipment/catalog/bundle --include-images
```

Структура bundle:

```
bundle/
  manifest.json      # метаданные
  catalog.json       # категории, параметры, образцы, ТТХ
  media/equipment/   # только при --include-images
```

Скопируйте каталог `bundle/` или `fixtures/` на оффлайн-машину.

Импорт bundle:

```bash
docker compose exec backend python manage.py import_equipment_catalog \
  --input equipment/catalog/bundle
```

С изображениями из bundle: `--with-images`.

---

## 4. Удаление только каталога вооружения

```bash
docker compose exec backend python manage.py clear_equipment_catalog --yes
```

Без `--yes` — интерактивное подтверждение.

Удаляется только каталог техники в БД и файлы в `media/equipment/`.  
Остальные разделы базы (объекты, события, страны, типы зон) **не затрагиваются**.

`--keep-units` — не удалять единицы измерения (км, км/ч).

---

## Команды — шпаргалка

| Команда | Назначение |
|---------|------------|
| `build_equipment_catalog_fixture` | Собрать `fixtures/catalog.json` из `data.py` |
| `load_equipment_catalog` | Загрузить из `data.py` в БД (по умолчанию без фото) |
| `export_equipment_catalog` | Экспорт из БД в bundle (по умолчанию без media) |
| `import_equipment_catalog` | Импорт из fixtures или bundle |
| `clear_equipment_catalog` | Удалить только каталог вооружения |
| `download_equipment_catalog_images` | Скачать JPG в `catalog/images/` (опционально) |

Демо-размещение техники на карте (`seed_equipment_demo`) — отдельная команда, не входит в bundle.

---

## Источники данных

- ТТХ — ориентировочные публичные значения (Википедия, открытые справочники).
- Список образцов: `backend/equipment/catalog/data.py`.
- Метаданные фото (опционально): `backend/equipment/catalog/data_images.py`.
