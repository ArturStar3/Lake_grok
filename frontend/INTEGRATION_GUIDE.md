## Инструкция по использованию улучшенного функционала кластеризации

### Шаг 1: Убедитесь, что API возвращает правильные данные

API должен возвращать объекты со следующей структурой:

```json
[
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77a",
    "title": "Название объекта",
    "label": "Текст на маркере",
    "lat": 41.3,
    "lng": 69.2,
    "country": {
      "title": "Узбекистан",
      "color": "blue"
    },
    "marker": {
      "path": "http://localhost:8000/media/markers/Headquarters_CCOy7PV.svg",
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 1,
      "scale": "1.0",
      "is_flag": true
    }
  }
]
```

**Важные поля:**

- `marker.is_flag` - должен быть `true` для объектов, которые нужно группировать
- `marker.order` - приоритет (1 = высший приоритет, меньше значение = выше приоритет)
- `marker.scale` - масштаб маркера (используется для расчета размера иконки)
- `marker.height`, `marker.width` - размеры области для текста маркера
- `country.title` - названия страны для группировки
- `country.color` - цвет для окраски иконок

### Шаг 2: Убедитесь, что компоненты правильно интегрированы

В [Formular.jsx](frontend/src/components/Formular/Formular.jsx):

- Данные загружаются через API
- Передаются в `MapComponent` как `objects`
- Передаются в `ObjectsTable` как `data`

### Шаг 3: Как это работает

#### Процесс отображения маркеров:

```
1. Formular.jsx загружает данные с API
   ↓
2. Передает objects в MapComponent и ObjectsTable
   ↓
3. MapComponent передает objects в LabelGeneration (MapUtils)
   ↓
4. LabelGeneration:
   a) Применяет processMarkerClustering(objects, mapInstance)
   b) Группирует объекты по странам
   c) Фильтрует только объекты с is_flag=true
   d) Сортирует по marker.order
   e) Создает кластеры близких объектов
   f) Рассчитывает offsetY для каждого маркера
   ↓
5. Возвращает { iconsById, clusteredObjects }
   ↓
6. MapComponent отображает маркеры с применеными смещениями
```

#### Визуальное представление кластера:

Если есть 4 объекта на одной точке с order=[1, 2, 2, 4]:

```
Без кластеризации (в одной точке):
████ (все четыре на одном месте)

После кластеризации (выстроены вертикально):
  ▓▓▓▓  (1 маркер - order=1, главный)
  ░░░░  (2 маркер - order=2)
  ░░░░  (3 маркер - order=2)
▒▒▒▒    (4 маркер - order=4)
```

### Шаг 4: Тестирование

1. Откройте приложение
2. Посмотрите на карту
3. Объекты с `is_flag=true` должны быть сгруппированы по странам
4. Если несколько объектов находятся близко друг к другу, они должны быть выстроены вертикально

**Для отладки:**

В консоли браузера добавьте:

```javascript
// В markerClusteringUtils.js в функции processMarkerClustering
console.log("=== Кластеризация начата ===");
console.log("Объекты всего:", objects.length);
console.log("Сгруппировано по странам:", groupedByCountry);
console.log("Результат кластеризации:", result);
```

### Шаг 5: Настройка радиуса группировки

По умолчанию объекты группируются, если расстояние между ними < 1 см на карте.

Чтобы изменить это значение, отредактируйте [markerClusteringUtils.js](frontend/src/components/MapComponent/markerClusteringUtils.js):

```javascript
const CLUSTER_DISTANCE_CM = 2; // Изменить с 1 на 2 сантиметра
const CLUSTER_DISTANCE_PX = CLUSTER_DISTANCE_CM * CM_TO_PIXELS; // Автоматически пересчитается
```

### Шаг 6: Изменение порядка сортировки

Маркеры сортируются по `marker.order` по возрастанию (1, 2, 3...).

Если нужна другая логика, измените в [markerClusteringUtils.js](frontend/src/components/MapComponent/markerClusteringUtils.js):

```javascript
export const sortByOrder = (objects) => {
  return [...objects].sort((a, b) => {
    const orderA = parseInt(a.marker?.order) || 999;
    const orderB = parseInt(b.marker?.order) || 999;
    return orderA - orderB; // Для убывания: orderB - orderA
  });
};
```

### Шаг 7: Кастомизация визуального отображения

Маркеры позиционируются с помощью CSS transform:

```javascript
// В MapUtils.jsx в useMemo
style = "... transform: translateY(${markerPosition.top}px);";
```

Если нужно изменить выравнивание или отступы, отредактируйте [calculateMarkerPosition](frontend/src/components/MapComponent/markerClusteringUtils.js):

```javascript
export const calculateMarkerPosition = (obj, scale = 1) => {
  if (!obj.offsetY) {
    return { top: 0, left: 0 };
  }

  const markerScale = obj.marker?.scale || 1;
  const offsetPixels = obj.offsetY * markerScale;

  return {
    top: offsetPixels,
    left: 0, // Можно добавить левое смещение если нужно
  };
};
```

### Шаг 8: Структура файлов

Новые файлы, добавленные для кластеризации:

```
frontend/src/components/MapComponent/
├── markerClusteringUtils.js      - Логика кластеризации
├── BubbleClusterLayer.jsx        - Пузырьковая кластеризация
├── MapUtils.jsx                   - Классическая кластеризация
├── MapComponent.jsx               (MODIFIED) - Использует кластеризацию
└── ...

frontend/
└── CLUSTERING_DOCUMENTATION.md    (NEW) - Полная документация
```

### Возможные проблемы и их решения

**Проблема**: Маркеры не отображаются

- **Решение**: Проверьте в консоли браузера, что API возвращает данные с `is_flag: true`

**Проблема**: Маркеры отображаются, но не сгруппированы

- **Решение**: Убедитесь, что `mapInstance.current` передается в `LabelGeneration`

**Проблема**: Маркеры расположены неправильно

- **Решение**: Проверьте значения `marker.order` в API ответе

**Проблема**: Консоль показывает ошибки импорта

- **Решение**: Убедитесь, что файл `markerClusteringUtils.js` находится в той же папке

### Примеры использования отдельных функций

Если нужно использовать функции кластеризации отдельно:

```javascript
import {
  groupByCountryAndFilter,
  sortByOrder,
  createClusters,
  calculateClusterOffsets,
  applyClusterOffsets,
} from "./markerClusteringUtils";

// Используйте их в своем коде
const grouped = groupByCountryAndFilter(objects);
const sorted = sortByOrder(grouped["Узбекистан"]);
const clusters = createClusters(sorted, mapInstance);
```

Подробные примеры собраны выше и в `frontend/CLUSTERING_DOCUMENTATION.md`. Отдельного файла `clusteringExamples.js` в дереве нет.
