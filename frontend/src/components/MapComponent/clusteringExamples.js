/**
 * Примеры использования и тестирование функций кластеризации маркеров
 */


import {
  groupByCountryAndFilter,
  sortByOrder,
  latLngToPixel,
  calcDistancePx,
  findNearbyObjects,
  createClusters,
  calculateClusterOffsets,
  applyClusterOffsets,
  processMarkerClustering
} from './markerClusteringUtils';
import { API_URL } from '../../config/api';

/**
 * Пример тестовых данных
 */
export const testData = [
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77a",
    "title": "ГКомат",
    "label": "объект 1",
    "lat": 41.3,
    "lng": 69.2,
    "country": {
      "title": "Узбекистан",
      "color": "blue"
    },
    "marker": {
      "path": `${API_URL}/media/markers/Headquarters.svg`,
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 1,
      "scale": "1.0",
      "is_flag": true
    }
  },
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77b",
    "title": "Объект 2",
    "label": "объект 2",
    "lat": 41.305, // Очень близко к объекту 1
    "lng": 69.205,
    "country": {
      "title": "Узбекистан",
      "color": "blue"
    },
    "marker": {
      "path": `${API_URL}/media/markers/Headquarters.svg`,
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 2,
      "scale": "1.0",
      "is_flag": true
    }
  },
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77c",
    "title": "Объект 3",
    "label": "объект 3",
    "lat": 41.3,
    "lng": 69.2,
    "country": {
      "title": "Узбекистан",
      "color": "blue"
    },
    "marker": {
      "path": "http://localhost:8000/media/markers/Headquarters.svg",
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 2,
      "scale": "1.0",
      "is_flag": true
    }
  },
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77d",
    "title": "Объект 4",
    "label": "объект 4",
    "lat": 41.1,
    "lng": 69.0,
    "country": {
      "title": "Узбекистан",
      "color": "blue"
    },
    "marker": {
      "path": "http://localhost:8000/media/markers/Headquarters.svg",
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 4,
      "scale": "1.0",
      "is_flag": true
    }
  },
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77e",
    "title": "Объект в Казахстане",
    "label": "объект 5",
    "lat": 50.0,
    "lng": 60.0,
    "country": {
      "title": "Казахстан",
      "color": "red"
    },
    "marker": {
      "path": "http://localhost:8000/media/markers/Headquarters.svg",
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 1,
      "scale": "1.0",
      "is_flag": true
    }
  },
  {
    "id": "739ac49f-e3cb-42f0-bf30-12d02d31d77f",
    "title": "Объект без флага",
    "label": "объект 6",
    "lat": 42.0,
    "lng": 70.0,
    "country": {
      "title": "Узбекистан",
      "color": "blue"
    },
    "marker": {
      "path": "http://localhost:8000/media/markers/Headquarters.svg",
      "top": 5,
      "width": 100,
      "height": 50,
      "order": 1,
      "scale": "1.0",
      "is_flag": false
    }
  }
];

/**
 * Примеры использования отдельных функций
 */
export function exampleUsage() {
  console.log("=== Примеры использования функций кластеризации ===\n");

  // 1. Группировка по странам и фильтрация
  console.log("1. Группировка по странам (is_flag=true):");
  const grouped = groupByCountryAndFilter(testData);
  console.log(grouped);
  console.log("\n");

  // 2. Сортировка по order
  console.log("2. Сортировка объектов Узбекистана по order:");
  const sorted = sortByOrder(grouped["Узбекистан"]);
  sorted.forEach(obj => {
    console.log(`${obj.label}: order=${obj.marker.order}`);
  });
  console.log("\n");

  // 3. Вычисление офсетов для кластера
  console.log("3. Вычисление офсетов для кластера:");
  const cluster = sorted.slice(0, 3); // Берем первые 3 объекта
  const offsets = calculateClusterOffsets(cluster);
  console.log("Офсеты:", offsets);
  console.log("\n");

  // 4. Применение офсетов
  console.log("4. Применение офсетов к кластеру:");
  const processedCluster = applyClusterOffsets(cluster, offsets);
  processedCluster.forEach(obj => {
    console.log(`${obj.label}: lat=${obj.lat}, lng=${obj.lng}, offsetY=${obj.offsetY}`);
  });
}

/**
 * Документация по использованию в компонентах
 */
export const USAGE_GUIDE = `
## Использование системы кластеризации маркеров

### 1. Основной поток:

В MapUtils.jsx:
- Импортируем processMarkerClustering
- В useEffect вызываем processMarkerClustering(objects, mapInstance)
- Сохраняем результат в state (clusteredObjects)
- В useMemo используем clusteredObjects вместо objects

В MapComponent.jsx:
- Получаем { iconsById, clusteredObjects } из LabelGeneration
- Используем clusteredObjects для отображения маркеров

### 2. Алгоритм кластеризации:

a) Фильтрация: Отбираем объекты с is_flag=true
b) Группировка: Группируем по country.title
c) Сортировка: Сортируем каждую группу по marker.order (возрастание)
d) Кластеризация: 
   - Берем объект с наивысшим приоритетом (мин order)
   - Находим все объекты в радиусе 1 см (37.8px при 96 DPI)
   - Группируем их в кластер
   - Повторяем для оставшихся объектов
e) Расчет позиций:
   - Все объекты в кластере получают координаты главного объекта
   - Каждому объекту назначается offsetY для вертикального смещения
   - offsetY рассчитывается так, чтобы маркеры были выровнены вертикально

### 3. Расчет offsetY:

Пример: кластер [obj1, obj2, obj3, obj4] с order=[1, 2, 2, 4]

Высоты маркеров: 50px (по умолчанию)

Расчет (от конца к началу):
- obj4.offsetY = 0
- obj3.offsetY = 50 (height объекта 4)
- obj2.offsetY = 100 (height объекта 4 + объекта 3)
- obj1.offsetY = 150 (height объектов 4 + 3 + 2)

После нормализации (центрирование):
- Общая высота = 200px
- Смещение = -100px (для центрирования)
- obj4.offsetY = -100
- obj3.offsetY = -50
- obj2.offsetY = 0
- obj1.offsetY = 50

### 4. Параметры кластеризации:

- CLUSTER_DISTANCE_CM = 1 см (задается в markerClusteringUtils.js)
- Преобразуется в пиксели: 1 см ≈ 37.8 px (96 DPI)
- Расстояние считается от центра одного маркера до центра другого

### 5. Что изменяется в данных объектов:

После кластеризации каждый объект в кластере содержит:
- lat, lng: координаты главного объекта (одинаковые для всех в кластере)
- offsetY: смещение по вертикали (для позиционирования)
- isInCluster: флаг, что объект в кластере
- clusterId: ID главного объекта кластера

### 6. CSS для позиционирования:

Маркер применяет transform:
\`\`\`
transform: translateY(\${offsetY}px)
\`\`\`

Это сдвигает маркер вверх/вниз на offsetY пикселей.

### 7. Отладка:

Для отладки кластеризации можно:
1. Добавить console.log в processMarkerClustering
2. Проверить clusteredObjects в React DevTools
3. Проверить данные сетевого запроса API
4. Убедиться, что marker.is_flag = true для нужных объектов
5. Проверить marker.order для правильной сортировки
`;
