# Руководство по развёртыванию TileServer GL (офлайн)

Пошаговая инструкция для воспроизведения текущего проекта: офлайн-сервер векторных карт на базе **TileServer GL** с отображением границ стран, названий государств и населённых пунктов.

---

## 1. Что получится в итоге

- Локальный сервер карт без интернета на `http://localhost:8080`
- Векторные тайлы из файла `data/map.mbtiles` (формат OpenMapTiles)
- Два стиля отрисовки:
  - **borders-labels** — основной (границы + подписи)
  - **basic** — упрощённый
- Русские названия (`name:ru`) и подмена устаревших имён (например, Нур-Султан → Астана)
- Шрифты и стили хранятся локально в репозитории

---

## 2. Требования

| Компонент | Версия / примечание |
|---|---|
| Docker Desktop | с поддержкой `docker compose` |
| Docker-образ | `maptiler/tileserver-gl:latest` |
| Свободное место на диске | от 1 ГБ (демо) до ~100 ГБ (планета) |
| ОС | Windows / Linux / macOS |

Порт **8080** на хосте должен быть свободен.

---

## 3. Структура проекта

```
tileserver/
├── docker-compose.yml          # Запуск контейнера
├── config.json                 # Конфигурация TileServer GL
├── .gitignore                  # *.mbtiles в игноре, fonts/ в git
├── data/
│   ├── map.mbtiles             # Векторные тайлы (НЕ в git, скачивается отдельно)
│   └── name-overrides.json     # Правила подмены названий городов
├── fonts/                      # Глифы шрифтов Open Sans (в git)
├── sprites/                    # Спрайты для иконок (резерв)
├── styles/
│   ├── borders-labels.json     # Основной стиль карты
│   └── basic.json              # Базовый стиль
└── scripts/
    ├── download-data.ps1       # Скачивание MBTiles и test_data
    └── apply-name-overrides.ps1 # Применение подмены названий к стилям
```

---

## 4. Пошаговое развёртывание

### Шаг 1. Создать каталоги проекта

```bash
mkdir tileserver
cd tileserver
mkdir data styles fonts sprites scripts
```

### Шаг 2. Создать `docker-compose.yml`

```yaml
services:
  tileserver:
    image: maptiler/tileserver-gl:latest
    container_name: tileserver-gl
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - .:/data
    environment:
      TILESERVER_GL_ALLOWED_HOSTS: "localhost,127.0.0.1"
    command:
      - "--config"
      - "config.json"
      - "--public_url"
      - "http://localhost:8080/"
```

**Источник:** официальный образ [maptiler/tileserver-gl](https://hub.docker.com/r/maptiler/tileserver-gl)  
**Документация:** https://tileserver.readthedocs.io/

### Шаг 3. Создать `config.json`

Ключевые настройки:

- `paths.mbtiles` → папка `data`
- `paths.fonts` → папка `fonts`
- `paths.styles` → папка `styles`
- источник данных: `data/map.mbtiles` под именем `openmaptiles`
- стили: `borders-labels.json`, `basic.json`

Файл `config.json` из репозитория уже содержит все необходимые параметры.

### Шаг 4. Скачать шрифты (офлайн-глифы)

Шрифты берутся из тестового архива TileServer GL:

| Параметр | Значение |
|---|---|
| URL | https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip |
| Размер | ~34 МБ |
| Содержимое | `fonts/` (Open Sans Regular, Bold, Italic, Semibold), спрайты, демо-MBTiles |

**Команды (Windows):**

```powershell
curl.exe -L -o test_data.zip "https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip"
tar -xf test_data.zip
```

Либо автоматически через скрипт (шаг 6).

> **Важно:** папка `fonts/` коммитится в git. Файлы `.mbtiles` — нет.

### Шаг 5. Скачать векторные тайлы (MBTiles)

Файл должен лежать строго по пути:

```
data/map.mbtiles
```

Имя зафиксировано в `config.json` (`"mbtiles": "map.mbtiles"`).

#### Источники данных

| Регион | Команда | URL | Размер |
|---|---|---|---|
| Демо (Цюрих) | `-Region demo` | https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/zurich_switzerland.mbtiles | ~25 МБ |
| Центр. Америка | `-Region central-america` | https://www.limaps.org/MBTiles/2024-10-08-central-america.osm.mbtiles | ~1.3 ГБ |
| Европа | `-Region europe` | https://www.limaps.org/MBTiles/2024-10-08-europe.osm.mbtiles | ~30 ГБ |
| Азия (РФ, СНГ) | `-Region asia` | https://www.limaps.org/MBTiles/2024-10-08-asia.osm.mbtiles | ~36 ГБ |
| Планета | `-Region planet` | https://object.data.gouv.fr/openmaptiles/planet.mbtiles | ~94 ГБ |

**Формат:** OpenMapTiles vector MBTiles (слои `boundary`, `place`, `water`, `transportation` и др.)  
**Схема слоёв:** https://openmaptiles.org/schema/

Для России и СНГ рекомендуется регион **asia**.

**Ручная загрузка:**

```powershell
curl.exe -L -C - -o data\map.mbtiles "https://www.limaps.org/MBTiles/2024-10-08-asia.osm.mbtiles"
```

### Шаг 6. Запустить скрипт загрузки (опционально)

```powershell
.\scripts\download-data.ps1 -Region asia
```

Скрипт:
1. Скачивает `test_data.zip`, если нет шрифтов
2. Распаковывает `fonts/` в корень проекта
3. Скачивает `map.mbtiles` в `data/`

### Шаг 7. Настроить стили карты

Стили лежат в `styles/` и используют локальный источник:

```json
"url": "mbtiles://{openmaptiles}"
```

#### Визуальное оформление

Взято из референсного стиля `tileserver_temp/styles/basic.json`:

| Элемент | Цвет / параметры |
|---|---|
| Фон | `#f2efe9` |
| Вода | `#a3c4d9` |
| Границы стран | `#555555`, толщина по zoom, opacity 0.85 |
| Дороги | `#cccccc`, видны с zoom 5 |

#### Настройки надписей (не менять при обновлении визуала)

- Приоритет русского: `name:ru` → `name` → `name:latin`
- Подмена устаревших имён через `data/name-overrides.json`
- Разные слои для стран, регионов, городов, посёлков
- Шрифты: `Open Sans Regular`, `Open Sans Bold`

**Критично для работы шрифтов** — путь к глифам в стиле:

```json
"glyphs": "{fontstack}/{range}.pbf"
```

Не `fonts/{fontstack}/...` — префикс `fonts` уже задан в `config.json` → `paths.fonts`.  
Двойной префикс вызывает ошибку `Invalid range` при серверном рендеринге.

### Шаг 8. Настроить подмену названий городов

Файл `data/name-overrides.json`:

```json
{
  "overrides": [
    {
      "id": "astana",
      "display": "Астана",
      "match": {
        "name": ["Nur-Sultan", "Nur Sultan"],
        "name:ru": ["Нур-Султан", "Нур Султан"]
      }
    }
  ]
}
```

Применение к стилям:

```powershell
powershell -File scripts\apply-name-overrides.ps1
```

Подмена работает на уровне отображения (стиль), без изменения `map.mbtiles`.

### Шаг 9. Создать `.gitignore`

```
*.mbtiles
test_data.zip
.DS_Store
Thumbs.db
```

Шрифты `fonts/` **не** игнорируются и попадают в репозиторий.

### Шаг 10. Запустить сервер

```bash
docker compose up -d
```

Проверка:

```bash
docker compose ps
docker logs tileserver-gl --tail 20
```

Открыть в браузере: **http://localhost:8080**

Остановка:

```bash
docker compose down
```

Перезапуск после смены стилей или MBTiles:

```bash
docker compose restart
```

---

## 5. Проверка работоспособности

| Проверка | URL |
|---|---|
| Веб-интерфейс | http://localhost:8080 |
| Стиль borders-labels | http://localhost:8080/styles/borders-labels/style.json |
| Векторные тайлы | http://localhost:8080/data/openmaptiles/{z}/{x}/{y}.pbf |
| Растровые тайлы | http://localhost:8080/styles/borders-labels/{z}/{x}/{y}.png |
| Метаданные MBTiles | http://localhost:8080/data/openmaptiles.json |
| Шрифты | http://localhost:8080/fonts/Open%20Sans%20Regular/0-255.pbf |

Ожидаемые коды ответа: **200 OK** для интерфейса, стиля, шрифтов и существующих тайлов.

---

## 6. Использование в приложении

**TileJSON (для MapLibre GL / Leaflet):**

```
http://localhost:8080/data/openmaptiles.json
```

**Style JSON (для MapLibre GL JS):**

```
http://localhost:8080/styles/borders-labels/style.json
```

**Пример URL тайла (XYZ):**

```
http://localhost:8080/data/openmaptiles/6/38/20.pbf
```

Все URL локальные — после первоначальной загрузки данных интернет не нужен.

---

## 7. Типичные проблемы

### Карта пустая

- Убедитесь, что `data/map.mbtiles` существует и не пустой
- Демо-файл Цюриха покрывает только Швейцарию — для России нужен регион `asia` или `planet`
- Проверьте границы данных: http://localhost:8080/data/openmaptiles.json

### `ERR_CONNECTION_REFUSED` на порту 8080

- Контейнер не запущен: `docker compose up -d`
- Порт занят другим процессом — смените в `docker-compose.yml` на `8081:8080` и обновите `config.json` (`domains`, `allowedHosts`, `public_url`)

### `Invalid range` / ошибки шрифтов

- В стиле должно быть `"glyphs": "{fontstack}/{range}.pbf"` (без `fonts/`)
- Папка `fonts/Open Sans Regular/` должна содержать файлы `0-255.pbf` и др.
- Перезапустите: `docker compose restart`

### `Render error` / тайлы 500

- Проверьте логи: `docker logs tileserver-gl`
- Чаще всего — проблема со шрифтами (см. выше)

### Старое название города на карте

- Добавьте правило в `data/name-overrides.json`
- Запустите `scripts/apply-name-overrides.ps1`
- `docker compose restart`

---

## 8. Откуда что было взято (сводка)

| Компонент | Источник |
|---|---|
| Docker-образ | https://hub.docker.com/r/maptiler/tileserver-gl |
| Документация TileServer GL | https://tileserver.readthedocs.io/ |
| Шрифты Open Sans | https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/test_data.zip |
| Демо MBTiles (Цюрих) | https://github.com/maptiler/tileserver-gl/releases/download/v1.3.0/zurich_switzerland.mbtiles |
| Региональные MBTiles | https://www.limaps.org/MBTiles/ |
| Планетарный MBTiles | https://object.data.gouv.fr/openmaptiles/planet.mbtiles |
| Схема векторных слоёв | https://openmaptiles.org/schema/ |
| Визуальный стиль (цвета, границы) | Референс `tileserver_temp/styles/basic.json` |
| Спрайты | test_data.zip → osm-bright (папка `sprites/basic/`) |

---

## 9. Быстрый старт (краткий чеклист)

1. Клонировать репозиторий (шрифты и стили уже внутри)
2. Установить Docker
3. Скачать MBTiles: `.\scripts\download-data.ps1 -Region asia`
4. Запустить: `docker compose up -d`
5. Открыть: http://localhost:8080 → стиль **borders-labels**

---

## 10. Лицензии и атрибуция

Данные карт: **© OpenMapTiles © OpenStreetMap contributors**  
Использование данных OSM: https://www.openstreetmap.org/copyright  
OpenMapTiles schema: CC-BY (атрибуция обязательна)

---

*Документ описывает состояние проекта на момент развёртывания офлайн TileServer GL с векторными MBTiles, локальными шрифтами и кастомными стилями borders-labels / basic.*